-- Recordatorios por WhatsApp 24 horas y 2 horas antes de la cita.
--
-- Cada 10 minutos pg_cron llama (con pg_net) a la función de Vercel api/send-reminders, que
-- decide a quién recordarle. Se activa después de guardar la dirección y la clave:
--   UPDATE notification_settings
--      SET reminders_endpoint = 'https://SU-DOMINIO/api/send-reminders',
--          reminders_secret = '<el mismo valor de REMINDERS_SECRET en Vercel>';

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS reminder_24h_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS reminder_2h_sent_at timestamptz;

ALTER TABLE notification_settings
  ADD COLUMN IF NOT EXISTS reminders_endpoint text,
  ADD COLUMN IF NOT EXISTS reminders_secret text;

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION run_whatsapp_reminders()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_endpoint text;
  v_secret text;
BEGIN
  SELECT reminders_endpoint, reminders_secret INTO v_endpoint, v_secret FROM notification_settings WHERE id;
  IF coalesce(v_endpoint, '') = '' OR coalesce(v_secret, '') = '' THEN
    RETURN;
  END IF;
  PERFORM net.http_post(
    url := v_endpoint,
    body := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', v_secret),
    timeout_milliseconds := 30000
  );
END;
$$;

REVOKE ALL ON FUNCTION run_whatsapp_reminders() FROM PUBLIC, anon, authenticated;

-- Si ya existía, se reemplaza
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'recordatorios-whatsapp';
SELECT cron.schedule('recordatorios-whatsapp', '*/10 * * * *', 'SELECT public.run_whatsapp_reminders()');
