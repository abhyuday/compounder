-- Compounder reminders — twice-daily schedule (morning + evening).
-- Run AFTER the send-reminders Edge Function is deployed with its secrets.
--
-- Set the two cron hours to when you want each reminder, expressed in UTC.
--   UTC hour = your local hour + your UTC offset. Examples:
--     US Eastern (UTC-4, summer): 8:00 AM -> 12 UTC,  9:00 PM -> 1 UTC
--     US Pacific (UTC-7, summer): 8:00 AM -> 15 UTC,  9:00 PM -> 4 UTC
--     IST (UTC+5:30):             8:00 AM -> 3 UTC,   9:00 PM -> 15 UTC  (rounded)
--     UK (UTC+1, summer):         8:00 AM -> 7 UTC,   9:00 PM -> 20 UTC
-- Replace <MORNING_UTC>, <EVENING_UTC>, and <YOUR_SERVICE_ROLE_KEY> below.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Remove any earlier jobs.
select cron.unschedule('compounder-reminders')         where exists (select 1 from cron.job where jobname = 'compounder-reminders');
select cron.unschedule('compounder-reminders-morning') where exists (select 1 from cron.job where jobname = 'compounder-reminders-morning');
select cron.unschedule('compounder-reminders-evening') where exists (select 1 from cron.job where jobname = 'compounder-reminders-evening');

-- Morning reminder.
select cron.schedule('compounder-reminders-morning', '0 <MORNING_UTC> * * *', $$
  select net.http_post(
    url     := 'https://qgovfymvmhcqlpmwdddw.supabase.co/functions/v1/send-reminders',
    body    := jsonb_build_object('kind', 'morning'),
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer <YOUR_SERVICE_ROLE_KEY>')
  );
$$);

-- Evening reminder.
select cron.schedule('compounder-reminders-evening', '0 <EVENING_UTC> * * *', $$
  select net.http_post(
    url     := 'https://qgovfymvmhcqlpmwdddw.supabase.co/functions/v1/send-reminders',
    body    := jsonb_build_object('kind', 'evening'),
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer <YOUR_SERVICE_ROLE_KEY>')
  );
$$);
