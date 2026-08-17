-- Compounder reminders — hourly schedule.
-- Run AFTER the Edge Function "send-reminders" is deployed and its secrets are set.
-- Replace <YOUR_SERVICE_ROLE_KEY> with your project's service_role key
-- (Project Settings → API → service_role). Do NOT commit the real key.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- (Re)create the hourly job. The function itself decides who is due this hour.
select cron.unschedule('compounder-reminders')
  where exists (select 1 from cron.job where jobname = 'compounder-reminders');

select cron.schedule(
  'compounder-reminders',
  '0 * * * *',                      -- top of every hour (UTC)
  $$
  select net.http_post(
    url := 'https://qgovfymvmhcqlpmwdddw.supabase.co/functions/v1/send-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <YOUR_SERVICE_ROLE_KEY>'
    )
  );
  $$
);
