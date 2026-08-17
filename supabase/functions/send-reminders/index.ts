// Compounder reminder sender — a Supabase Edge Function.
// Invoked hourly by pg_cron; sends a web-push to everyone whose reminder hour
// (stored in UTC on user_settings.reminders) matches the current UTC hour.
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

Deno.serve(async () => {
  const utcHour = new Date().getUTCHours();

  const { data: settings, error } = await sb.from("user_settings").select("user_id,reminders");
  if (error) return new Response("settings error: " + error.message, { status: 500 });

  // user_id -> reminder kind due this hour
  const due = new Map<string, string>();
  for (const s of settings ?? []) {
    const rows = Array.isArray(s.reminders) ? s.reminders : [];
    const hit = rows.find((r: any) => r && r.utc === utcHour);
    if (hit) due.set(s.user_id, hit.kind);
  }
  if (due.size === 0) return new Response("no reminders at UTC " + utcHour);

  const { data: subs } = await sb.from("push_subscriptions").select("*").in("user_id", [...due.keys()]);

  let sent = 0;
  for (const s of subs ?? []) {
    const kind = due.get(s.user_id) ?? "evening";
    const m = MESSAGES[kind] ?? MESSAGES.evening;
    const payload = JSON.stringify({
      title: m.title,
      body: m.body,
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
  return new Response("sent " + sent + " at UTC " + utcHour);
});
