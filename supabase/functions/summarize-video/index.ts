// Compounder — YouTube video summarizer (Supabase Edge Function).
//
// Fetches a YouTube transcript server-side (free, no Python) and summarizes it
// with Claude, so the feature works from any device — not just a local laptop.
//
// Bring-your-own-key: the feature is only for signed-in users, and each user sets
// their OWN Anthropic key in the app. The key is saved to their (RLS-protected)
// user_settings row so it syncs across every device; this function reads it back
// with the caller's own credentials. No shared key, no per-device local storage.
//
// Optional secret:
//   CLAUDE_MODEL        — defaults to a cheap, capable model
// SUPABASE_URL and SUPABASE_ANON_KEY are injected automatically.
//
// Deploy (must be --no-verify-jwt so the browser's CORS preflight isn't rejected;
// this function does its own auth via getUser() below):
//   supabase functions deploy summarize-video --no-verify-jwt
// (No ANTHROPIC_API_KEY secret needed — users bring their own.)
//
// NOTE ON TRANSCRIPTS: YouTube frequently bot-challenges datacenter IPs (which is
// where Edge Functions run). If transcript fetching starts failing, swap
// getCaptionTracks() for a paid transcript API (TranscriptAPI, Supadata, etc.) —
// only that one function changes; everything else stays.

import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const INNERTUBE_KEY_FALLBACK = "AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8"; // used if the page key can't be read
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

// Caption tracks via the ANDROID InnerTube player API — the WEB/watch-page caption
// URLs now require a proof-of-origin token and return empty, but the ANDROID
// client's caption URLs still serve content. Mirrors youtube-transcript-api.
async function getCaptionTracks(videoId: string): Promise<any[]> {
  // 1) Read the page's InnerTube API key (falls back to the well-known one).
  let apiKey = INNERTUBE_KEY_FALLBACK;
  try {
    const html = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: { "User-Agent": UA, "Accept-Language": "en-US,en;q=0.9" },
    }).then((r) => r.text());
    const m = html.match(/"INNERTUBE_API_KEY":\s*"([a-zA-Z0-9_-]+)"/);
    if (m) apiKey = m[1];
  } catch { /* use fallback key */ }

  // 2) ANDROID player request → caption tracks.
  const data = await fetch(`https://www.youtube.com/youtubei/v1/player?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "User-Agent": UA },
    body: JSON.stringify({
      context: { client: { clientName: "ANDROID", clientVersion: "20.10.38" } },
      videoId,
    }),
  }).then((r) => r.json());
  const tracks = data?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
  return Array.isArray(tracks) ? tracks : [];
}

function pickTrack(tracks: any[]): any {
  return (
    tracks.find((t) => (t.languageCode || "").startsWith("en") && t.kind !== "asr") ||
    tracks.find((t) => (t.languageCode || "").startsWith("en")) ||
    tracks[0]
  );
}

function decodeEntities(s: string): string {
  return s
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCharCode(parseInt(n, 16)));
}

async function fetchTranscript(videoId: string): Promise<string> {
  const tracks = await getCaptionTracks(videoId);
  if (!tracks.length) return "";
  const track = pickTrack(tracks);
  const url = (track?.baseUrl || "").replace("&fmt=srv3", "");
  if (!url || url.includes("&exp=xpe")) return ""; // xpe variant needs a po-token → returns empty
  const xml = await fetch(url, { headers: { "User-Agent": UA } }).then((r) => r.text());
  const parts: string[] = [];
  const re = /<text[^>]*>([\s\S]*?)<\/text>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) parts.push(decodeEntities(m[1]));
  return cleanTranscript(parts.join(" "));
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

  // Gate to signed-in users so the paid LLM endpoint isn't open to the world.
  const authHeader = req.headers.get("Authorization") || "";
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return json(401, { error: "Sign in to Compounder to use the summarizer." });

  // Bring-your-own-key: read the user's own key from their settings (RLS: own row).
  const { data: settingsRow } = await supabase
    .from("user_settings").select("anthropic_key").eq("user_id", user.id).maybeSingle();
  const apiKey = (settingsRow?.anthropic_key || "").trim();
  if (!apiKey) return json(400, { error: "Add your Anthropic API key in the app to summarize." });

  let url = "";
  try { url = (await req.json()).url || ""; } catch { /* ignore */ }
  const videoId = extractVideoId(url);
  if (!videoId) return json(400, { error: "Couldn't find a YouTube video id in that URL." });

  let transcript = "";
  try {
    transcript = await fetchTranscript(videoId);
  } catch (e) {
    return json(502, { error: "Transcript fetch failed: " + (e?.message ?? e) });
  }
  if (!transcript) {
    return json(422, { error: "No transcript available for this video (captions off, or YouTube blocked the request)." });
  }
  const truncated = transcript.length > MAX_CHARS;
  if (truncated) transcript = transcript.slice(0, MAX_CHARS);

  let summary = "";
  try {
    summary = await summarize(transcript, apiKey, Deno.env.get("CLAUDE_MODEL") ?? "claude-haiku-4-5-20251001");
  } catch (e) {
    return json(502, { error: "Summarization failed: " + (e?.message ?? e) });
  }
  if (truncated) summary += "\n\n_(Long video — summary based on the first part of the transcript.)_";

  return json(200, { video_id: videoId, summary });
});
