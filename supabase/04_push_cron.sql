-- =====================================================================
-- 04 PUSH CRON — programa la Edge Function "enviar-push" para que corra
-- sola una vez al día, sin que nadie tenga que abrir la app.
--
-- ANTES DE CORRER ESTO: la función tiene que estar ya desplegada
-- (supabase functions deploy enviar-push) — ver README_PUSH.md.
--
-- Reemplaza estos 2 valores antes de correr:
--   TU_PROJECT_REF  → lo ves en la URL de tu proyecto Supabase
--                      (https://TU_PROJECT_REF.supabase.co)
--   TU_ANON_KEY     → Settings → API → anon public key
-- =====================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule('enviar-push-diario') where exists (select 1 from cron.job where jobname = 'enviar-push-diario');

-- '0 14 * * *' = todos los días a las 14:00 UTC = 9:00 AM hora Colombia.
-- Cambia la hora si quieres que llegue en otro momento del día.
select cron.schedule(
  'enviar-push-diario',
  '0 14 * * *',
  $$
  select net.http_post(
    url := 'https://TU_PROJECT_REF.supabase.co/functions/v1/enviar-push',
    headers := jsonb_build_object('Authorization', 'Bearer TU_ANON_KEY', 'Content-Type', 'application/json')
  );
  $$
);
