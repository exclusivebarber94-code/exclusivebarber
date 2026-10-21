-- «Ya es hora de volver»: detecta cada cuánto viene cada cliente y le recuerda agendar.
--
-- Con las visitas completadas del último año (varias citas el mismo día = una visita), se mira
-- el tiempo entre visitas. Si el cliente tiene al menos 3 visitas, un ritmo regular (la
-- desviación no pasa del 40 % del promedio) y viene cada 5 a 45 días, el día que le toca y no
-- ha vuelto ni tiene cita, la función de Vercel api/send-reminders le escribe por WhatsApp.
--
-- Un solo recordatorio por ciclo (hasta que vuelva), máximo uno por semana (Ley 2300 de 2023)
-- y nunca a quien respondió NO (recall_opt_out).

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS recall_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS recall_opt_out boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS recall_opt_out_at timestamptz;

CREATE OR REPLACE FUNCTION public.recall_candidates(p_today date DEFAULT (now() AT TIME ZONE 'America/Bogota')::date)
RETURNS TABLE (
  phone text,
  client_phone text,
  client_name text,
  visits int,
  every_days int,
  last_visit date,
  days_since int,
  due_date date,
  last_service_id uuid,
  last_service_name text,
  last_barber text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH visit AS (
    SELECT normalize_phone(b.client_phone) AS phone, b.date
    FROM bookings b
    WHERE b.status = 'completed'
      AND b.date BETWEEN p_today - 365 AND p_today
      AND length(normalize_phone(b.client_phone)) >= 7
    GROUP BY 1, 2
  ),
  gaps AS (
    SELECT phone,
           date - lag(date) OVER (PARTITION BY phone ORDER BY date) AS gap,
           row_number() OVER (PARTITION BY phone ORDER BY date DESC) AS rn
    FROM visit
  ),
  stats AS (
    -- Los últimos 6 intervalos de cada cliente
    SELECT phone,
           count(*)::int AS n,
           percentile_cont(0.5) WITHIN GROUP (ORDER BY gap) AS med,
           avg(gap) AS mean,
           coalesce(stddev_samp(gap), 0) AS sd
    FROM gaps
    WHERE gap IS NOT NULL AND rn <= 6
    GROUP BY phone
  ),
  last AS (
    SELECT DISTINCT ON (normalize_phone(b.client_phone))
           normalize_phone(b.client_phone) AS phone, b.client_phone, b.client_name, b.date,
           b.service_id, b.service_name, b.barber_name
    FROM bookings b
    WHERE b.status = 'completed' AND b.date <= p_today AND length(normalize_phone(b.client_phone)) >= 7
    ORDER BY normalize_phone(b.client_phone), b.date DESC, b.time ASC
  )
  SELECT s.phone,
         l.client_phone,
         l.client_name,
         s.n + 1,
         round(s.med)::int,
         l.date,
         p_today - l.date,
         l.date + round(s.med)::int,
         l.service_id,
         l.service_name,
         l.barber_name
  FROM stats s
  JOIN last l ON l.phone = s.phone
  LEFT JOIN clients c ON c.phone = s.phone
  WHERE s.n >= 2
    AND s.med BETWEEN 5 AND 45
    AND s.sd <= 0.4 * s.mean
    -- Ya le toca, pero no hace tanto (después de esa ventana se deja de insistir)
    AND p_today >= l.date + round(s.med)::int
    AND p_today <= l.date + round(s.med)::int + least(14, greatest(3, round(s.med / 2)::int))
    AND NOT coalesce(c.recall_opt_out, false)
    -- Un recordatorio por ciclo y máximo uno por semana
    AND (c.recall_sent_at IS NULL
         OR ((c.recall_sent_at AT TIME ZONE 'America/Bogota')::date <= l.date
             AND c.recall_sent_at < now() - interval '7 days'))
    -- Sin cita pendiente
    AND NOT EXISTS (
      SELECT 1 FROM bookings f
      WHERE normalize_phone(f.client_phone) = s.phone
        AND f.status IN ('pending', 'confirmed')
        AND f.date >= p_today)
  ORDER BY l.date + round(s.med)::int, l.client_name;
$$;

REVOKE ALL ON FUNCTION public.recall_candidates(date) FROM PUBLIC, anon, authenticated;

-- Para el panel: a quién le llegaría hoy (solo administradores)
CREATE OR REPLACE FUNCTION public.admin_recall_preview()
RETURNS SETOF json
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'NOT_ADMIN';
  END IF;
  RETURN QUERY SELECT row_to_json(r) FROM recall_candidates() r;
END $$;

REVOKE ALL ON FUNCTION public.admin_recall_preview() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_recall_preview() TO authenticated;
