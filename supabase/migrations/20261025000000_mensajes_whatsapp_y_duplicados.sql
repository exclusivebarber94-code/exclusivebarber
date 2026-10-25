-- 1) Mensajes que los clientes le escriben al número de avisos (WhatsApp).
--    api/whatsapp-incoming los guarda en contact_messages (source = 'whatsapp') para verlos en
--    Panel → Mensajes, y api/send-reminders se los reenvía al WhatsApp de la barbería agrupados
--    por cliente (forwarded_at marca los ya reenviados).
ALTER TABLE contact_messages
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'web',
  ADD COLUMN IF NOT EXISTS forwarded_at timestamptz;

CREATE INDEX IF NOT EXISTS contact_messages_forward_idx
  ON contact_messages (created_at) WHERE source = 'whatsapp' AND forwarded_at IS NULL;

-- 2) Reserva duplicada: antes de confirmar, la web pregunta si ese celular ya tiene cita ese día.
--    Solo devuelve las horas (nada de datos personales) y solo para el celular que se escribió.
CREATE OR REPLACE FUNCTION public.client_bookings_on(p_phone text, p_date date)
RETURNS text[]
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT coalesce(array_agg(b.time ORDER BY b.time), '{}')
  FROM bookings b
  WHERE length(normalize_phone(p_phone)) >= 7
    AND normalize_phone(b.client_phone) = normalize_phone(p_phone)
    AND b.date = p_date
    AND b.status IN ('pending', 'confirmed');
$$;

REVOKE ALL ON FUNCTION public.client_bookings_on(text, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.client_bookings_on(text, date) TO anon, authenticated;
