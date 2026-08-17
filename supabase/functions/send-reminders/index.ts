// Compounder reminder sender — a Supabase Edge Function.
// Invoked twice a day by pg_cron. The cron passes { "kind": "morning" | "evening" }
// in the body; this sends that reminder to everyone who has that slot enabled.
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

Deno.serve(async (req) => {
  // Which reminder to send — the cron passes { "kind": "morning" | "evening" }.
  let kind = "evening";
  try { const b = await req.json(); if (b && typeof b.kind === "string") kind = b.kind; } catch { /* default */ }
  const m = MESSAGES[kind] ?? MESSAGES.evening;

  const { data: settings, error } = await sb.from("user_settings").select("user_id,reminders");
  if (error) return new Response("settings error: " + error.message, { status: 500 });

  // Users who have this reminder slot enabled.
  const users = (settings ?? [])
    .filter((s) => Array.isArray(s.reminders) && s.reminders.some((r: any) => r && r.kind === kind))
    .map((s) => s.user_id);
  if (users.length === 0) return new Response("no users for " + kind);

  const { data: subs } = await sb.from("push_subscriptions").select("*").in("user_id", users);

  const payload = JSON.stringify({
    title: m.title,
    body: m.body,
    url: "https://abhyuday.github.io/compounder/",
    tag: "compounder-" + kind,
  });

  let sent = 0;
  for (const s of subs ?? []) {
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
