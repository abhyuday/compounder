// Compounder — YouTube video summarizer (Supabase Edge Function).
//
// Fetches a YouTube transcript via TranscriptAPI (transcriptapi.com — works from
// datacenter IPs, unlike scraping YouTube directly) and summarizes it with Claude.
//
// Bring-your-own-keys, per signed-in user: each user sets BOTH their TranscriptAPI
// key and their Anthropic key in the app. Both are saved on the user's own
// RLS-protected user_settings row and read back here with the caller's own
// credentials. Nothing is shared and nothing is stored by this function.
//
// SUPABASE_URL and SUPABASE_ANON_KEY are injected automatically.
// Optional secret: CLAUDE_MODEL (defaults to a cheap, capable model).
//
// Deploy (must be --no-verify-jwt so the browser's CORS preflight isn't rejected;
// this function does its own auth via getUser() below):
//   supabase functions deploy summarize-video --no-verify-jwt

import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const MAX_CHARS = 60000; // cap transcript sent to the LLM (cost/latency)

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

function extractVideoId(url: string): string | null {
  url = (url || "").trim();
  const m = url.match(/(?:v=|\/shorts\/|youtu\.be\/|\/embed\/|\/v\/|\/live\/)([A-Za-z0-9_-]{11})/);
  if (m) return m[1];
  if (/^[A-Za-z0-9_-]{11}$/.test(url)) return url;
  return null;
}

function cleanTranscript(t: string): string {
  if (!t) return "";
  return t
    .replace(/\[.*?\]/g, "")      // [Music], [Applause]
    .replace(/\(.*?\)/g, "")      // (Music)
    .replace(/\s+([.,!?;:])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

// Transcript via TranscriptAPI — the user's own key (Authorization: Bearer).
async function fetchTranscript(videoId: string, apiKey: string): Promise<string> {
  const u = `https://transcriptapi.com/api/v2/youtube/transcript?video_url=${encodeURIComponent(videoId)}&include_timestamp=false&language=en,asr`;
  const res = await fetch(u, { headers: { Authorization: "Bearer " + apiKey } });
  const bodyText = await res.text();
  if (!res.ok) {
    let msg = bodyText.slice(0, 300);
    try { const jb = JSON.parse(bodyText); msg = jb.error || jb.message || jb.detail || msg; } catch { /* keep raw */ }
    throw new Error(`TranscriptAPI ${res.status}: ${msg}`);
  }
  let data: any = {};
  try { data = JSON.parse(bodyText); } catch { return ""; }
  const arr = Array.isArray(data?.transcript) ? data.transcript : [];
  const text = arr.map((s: any) => (typeof s === "string" ? s : (s?.text || ""))).join(" ");
  return cleanTranscript(text);
}

const SUMMARY_PROMPT = `You are summarizing a YouTube video transcript for someone who wants its value without watching. Write a tight, skimmable summary in markdown with exactly these sections:

## TL;DR
Two or three sentences capturing the core message.

## Key Points
- The main ideas, arguments, and claims, as bullets.

## Actionable Takeaways
- Concrete things the viewer can do or apply.

Stay faithful to the transcript, be concise, and cut filler. Here is the transcript:

{text}`;

async function summarize(text: string, apiKey: string, model: string): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 2000,
      temperature: 0.7,
      system: "You are a helpful assistant that creates clear, concise, well-structured summaries of content.",
      messages: [{ role: "user", content: SUMMARY_PROMPT.replace("{text}", text) }],
    }),
  });
  if (!res.ok) throw new Error(`Claude API ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  return (data.content || []).filter((b: any) => b.type === "text").map((b: any) => b.text).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  // Gate to signed-in users.
  const authHeader = req.headers.get("Authorization") || "";
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return json(401, { error: "Sign in to Compounder to use the summarizer." });

  // Bring-your-own-keys: read the user's own keys from their settings (RLS: own row).
  const { data: settingsRow } = await supabase
    .from("user_settings").select("anthropic_key, transcript_api_key").eq("user_id", user.id).maybeSingle();
  const transcriptKey = (settingsRow?.transcript_api_key || "").trim();
  const anthropicKey = (settingsRow?.anthropic_key || "").trim();
  if (!transcriptKey) return json(400, { error: "Add your TranscriptAPI key in the app to summarize." });
  if (!anthropicKey) return json(400, { error: "Add your Anthropic API key in the app to summarize." });

  let url = "";
  try { url = (await req.json()).url || ""; } catch { /* ignore */ }
  const videoId = extractVideoId(url);
  if (!videoId) return json(400, { error: "Couldn't find a YouTube video id in that URL." });

  let transcript = "";
  try {
    transcript = await fetchTranscript(videoId, transcriptKey);
  } catch (e) {
    return json(502, { error: "Transcript fetch failed: " + (e?.message ?? e) });
  }
  if (!transcript) return json(422, { error: "No transcript available for this video (captions may be off)." });

  const truncated = transcript.length > MAX_CHARS;
  if (truncated) transcript = transcript.slice(0, MAX_CHARS);

  let summary = "";
  try {
    summary = await summarize(transcript, anthropicKey, Deno.env.get("CLAUDE_MODEL") ?? "claude-haiku-4-5-20251001");
  } catch (e) {
    return json(502, { error: "Summarization failed: " + (e?.message ?? e) });
  }
  if (truncated) summary += "\n\n_(Long video — summary based on the first part of the transcript.)_";

  return json(200, { video_id: videoId, summary });
});
