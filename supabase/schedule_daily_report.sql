-- Runs the send-daily-report Edge Function every day at 23:59 Georgia time.
-- Georgia is fixed UTC+4 year-round (no DST), so 23:59 local = 19:59 UTC -- the
-- "19:59" below is intentional, not a mistake.
-- Run this ONLY after the Edge Function is deployed and a manual test invocation from
-- the Dashboard has confirmed the email actually arrives correctly.

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'send-daily-report-jvari-tskaltubo',
  '59 19 * * *',
  $$
  select net.http_post(
    url := 'https://dgwposrzxzycoownpcdk.supabase.co/functions/v1/send-daily-report',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer sb_publishable_vrRcFEJadOB1BlYa32ZkvA_fQ1wy_5s'
    ),
    body := '{}'::jsonb
  ) as request_id;
  $$
);
