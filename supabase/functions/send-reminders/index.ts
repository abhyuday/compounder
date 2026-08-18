// Compounder reminder sender — a Supabase Edge Function.
// Invoked twice a day by pg_cron. The cron passes { "kind": "morning" | "evening" }
// in the body; this sends that reminder to everyone who has that slot enabled.
//
// Morning is a generic nudge. Evening/midday are PERSONALIZED: the message names
// the dimensions you still have open today, so the cue points at the actual gap.
//
// Required secrets (Edge Function → Secrets):
//   VAPID_PUBLIC, VAPID_PRIVATE, VAPID_SUBJECT (e.g. mailto:you@example.com)
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically.

import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2";

const sb = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

webpush.setVapidDetails(
  Deno.env.get("VAPID_SUBJECT") ?? "mailto:reminders@compounder.app",
  Deno.env.get("VAPID_PUBLIC")!,
  Deno.env.get("VAPID_PRIVATE")!,
);

const MESSAGES: Record<string, { title: string; body: string }> = {
  morning: { title: "Compounder", body: "New day. What good will you do? Log your first point." },
  midday:  { title: "Compounder", body: "Midday check — keep the momentum going." },
  evening: { title: "Compounder", body: "Lock in today's points before they reset at midnight." },
};

// The five domains and how each earns its point (mirrors the app's scoring).
function openDomains(row: any): string[] {
  if (!row) return ["Comfort Zone", "Money", "Health", "Family", "Self"];
  const healthDone = [row.hmove, row.heat, row.hsleep].filter(Boolean).length >= 2;
  const selfDone = [row.vind, row.vsin, row.vtrq, row.vrest].filter(Boolean).length >= 2;
  const done: Record<string, boolean> = {
    "Comfort Zone": !!row.hard,
    "Money": !!row.money,
    "Health": healthDone,
    "Family": !!row.family,
    "Self": selfDone,
  };
  return Object.keys(done).filter((k) => !done[k]);
}

function personalBody(open: string[]): string {
  const total = 5, doneN = total - open.length;
  if (doneN === total) return "All five in today. 🎯 Rest easy.";
  if (doneN === 0)     return "Nothing logged yet — lock in today before midnight.";
  if (open.length === 1) return `Only ${open[0]} left — one point to a clean 5.`;
  if (open.length === 2) return `${open[0]} + ${open[1]} still open — 2 to hit today's 5.`;
  return `${doneN}/5 so far. ${open.length} still open before midnight.`;
}

// Each user's *local* calendar date, derived from the UTC/local hours stored on
// their reminder row, so "today" is right even when the cron fires past UTC midnight.
function localDateFor(row: any): string {
  let off = 0; // hours to add to local to reach UTC
  if (row && typeof row.utc === "number" && typeof row.hour === "number") {
    let raw = row.utc - row.hour;
    while (raw > 12) raw -= 24;
    while (raw <= -12) raw += 24;
    off = raw;
  }
  return new Date(Date.now() - off * 3600 * 1000).toISOString().slice(0, 10);
}

Deno.serve(async (req) => {
  let kind = "evening";
  try { const b = await req.json(); if (b && typeof b.kind === "string") kind = b.kind; } catch { /* default */ }
  const m = MESSAGES[kind] ?? MESSAGES.evening;
  const personalize = kind === "evening" || kind === "midday";

  const { data: settings, error } = await sb.from("user_settings").select("user_id,reminders");
  if (error) return new Response("settings error: " + error.message, { status: 500 });

  // Users who have this reminder slot enabled, plus each one's local "today".
  const enabled = (settings ?? []).filter(
    (s) => Array.isArray(s.reminders) && s.reminders.some((r: any) => r && r.kind === kind),
  );
  const users = enabled.map((s) => s.user_id);
  if (users.length === 0) return new Response("no users for " + kind);

  // Personalized bodies: read each user's day row and compute what's still open.
  const bodyByUser: Record<string, string> = {};
  if (personalize) {
    const localDays: Record<string, string> = {};
    for (const s of enabled) {
      const row = (s.reminders as any[]).find((r) => r && r.kind === kind);
      localDays[s.user_id] = localDateFor(row);
    }
    const dayset = [...new Set(Object.values(localDays))];
    const { data: dayRows } = await sb
      .from("days")
      .select("user_id,day,hard,money,hmove,heat,hsleep,family,vind,vsin,vtrq,vrest")
      .in("user_id", users)
      .in("day", dayset);
    const rowByUser: Record<string, any> = {};
    for (const r of dayRows ?? []) { if (r.day === localDays[r.user_id]) rowByUser[r.user_id] = r; }
    for (const uid of users) bodyByUser[uid] = personalBody(openDomains(rowByUser[uid]));
  }

  const { data: subs } = await sb.from("push_subscriptions").select("*").in("user_id", users);

  let sent = 0;
  for (const s of subs ?? []) {
    const body = (personalize && bodyByUser[s.user_id]) ? bodyByUser[s.user_id] : m.body;
    const payload = JSON.stringify({
      title: m.title,
      body,
      url: "https://abhyuday.github.io/compounder/",
      tag: "compounder-" + kind,
    });
    try {
      await webpush.sendNotification(s.subscription, payload);
      sent++;
    } catch (e: any) {
      // Prune dead subscriptions.
      if (e && (e.statusCode === 404 || e.statusCode === 410)) {
        await sb.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
      }
    }
  }
  return new Response("sent " + sent + " " + kind);
});
