-- «Cliente nuevo» desde el portal del barbero.
--
-- El barbero (con su PIN, validado aquí) registra un cliente que ya atendió o le agenda una cita
-- con fecha y hora. La cita siempre queda a su nombre y los precios salen del catálogo (el barbero
-- no los puede cambiar, porque de ellos depende su comisión). Los servicios van uno detrás de otro
-- desde la hora elegida. No pasa por el horario del negocio (el barbero puede atender fuera de
-- horario), pero sí revisa que no choque con otra cita suya.
--
-- Devuelve {"ok": true, "count": n, "date": ..., "start": ..., "end": ...}
--       o {"error": "INVALID_PIN" | "PIN_LOCKED" | "INVALID_NAME" | "INVALID_PHONE" | "NO_SERVICES"
--                   | "TOO_MANY_SERVICES" | "SERVICE_NOT_FOUND" | "WRONG_PROFESSIONAL" | "INVALID_TIME"
--                   | "PAST_TIME" | "TOO_FAR" | "SLOT_TAKEN", "time": "HH:MM"}

CREATE OR REPLACE FUNCTION public.barber_create_bookings(
  p_barber_id uuid,
  p_pin text,
  p_client_name text,
  p_client_phone text,
  p_date date,
  p_start text,
  p_service_ids uuid[],
  p_completed boolean
)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_login text;
  v_barber barbers%ROWTYPE;
  v_now timestamp := now() AT TIME ZONE 'America/Bogota';
  v_today date := (now() AT TIME ZONE 'America/Bogota')::date;
  v_name text := btrim(coalesce(p_client_name, ''));
  v_phone text := btrim(coalesce(p_client_phone, ''));
  v_digits text := regexp_replace(coalesce(p_client_phone, ''), '\D', '', 'g');
  v_start int;
  v_cursor int;
  v_service services%ROWTYPE;
  v_id uuid;
  v_clash text;
  v_status text := CASE WHEN p_completed THEN 'completed' ELSE 'confirmed' END;
  v_time text;
  v_rows int := 0;
BEGIN
  v_login := barber_login(p_barber_id, p_pin);
  IF v_login <> 'OK' THEN
    RETURN json_build_object('error', v_login);
  END IF;
  SELECT * INTO v_barber FROM barbers WHERE id = p_barber_id;

  IF char_length(v_name) < 2 OR char_length(v_name) > 80 THEN
    RETURN json_build_object('error', 'INVALID_NAME');
  END IF;
  -- Celular opcional: 10 dígitos de Colombia o «+indicativo» de otro país
  IF v_phone <> '' AND NOT (
       (left(v_phone, 1) <> '+' AND char_length(v_digits) = 10)
    OR (left(v_phone, 1) = '+' AND char_length(v_digits) BETWEEN 8 AND 15)) THEN
    RETURN json_build_object('error', 'INVALID_PHONE');
  END IF;
  IF v_phone <> '' THEN
    v_phone := CASE WHEN left(v_phone, 1) = '+' THEN '+' || v_digits ELSE v_digits END;
  END IF;

  IF p_service_ids IS NULL OR cardinality(p_service_ids) = 0 THEN
    RETURN json_build_object('error', 'NO_SERVICES');
  END IF;
  IF cardinality(p_service_ids) > 10 THEN
    RETURN json_build_object('error', 'TOO_MANY_SERVICES');
  END IF;

  IF p_start IS NULL OR p_start !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' THEN
    RETURN json_build_object('error', 'INVALID_TIME');
  END IF;
  v_start := split_part(p_start, ':', 1)::int * 60 + split_part(p_start, ':', 2)::int;

  IF p_completed THEN
    -- Ya atendido: hoy (o ayer, si se le olvidó registrarlo), nunca en el futuro
    IF p_date NOT BETWEEN v_today - 1 AND v_today OR (p_date + make_interval(mins => v_start)) > v_now + interval '5 minutes' THEN
      RETURN json_build_object('error', 'INVALID_TIME');
    END IF;
  ELSE
    IF (p_date + make_interval(mins => v_start)) < v_now - interval '5 minutes' THEN
      RETURN json_build_object('error', 'PAST_TIME');
    END IF;
    IF p_date > v_today + 60 THEN
      RETURN json_build_object('error', 'TOO_FAR');
    END IF;
  END IF;

  -- Primero se revisa todo; luego se guarda (todo o nada)
  v_cursor := v_start;
  FOR i IN 1 .. cardinality(p_service_ids) LOOP
    SELECT * INTO v_service FROM services WHERE id = p_service_ids[i] AND active;
    IF NOT FOUND THEN
      RETURN json_build_object('error', 'SERVICE_NOT_FOUND');
    END IF;
    IF (v_service.category = 'manicura') <> (v_barber.role = 'manicurista') THEN
      RETURN json_build_object('error', 'WRONG_PROFESSIONAL');
    END IF;
    IF v_cursor + v_service.duration > 24 * 60 THEN
      RETURN json_build_object('error', 'INVALID_TIME');
    END IF;
    IF NOT p_completed THEN
      SELECT b.time INTO v_clash
      FROM bookings b
      LEFT JOIN services s ON s.id = b.service_id
      WHERE b.barber_id = p_barber_id
        AND b.date = p_date
        AND b.status IN ('pending', 'confirmed')
        AND (split_part(b.time, ':', 1)::int * 60 + split_part(b.time, ':', 2)::int) < v_cursor + v_service.duration
        AND (split_part(b.time, ':', 1)::int * 60 + split_part(b.time, ':', 2)::int) + coalesce(s.duration, 30) > v_cursor
      ORDER BY b.time
      LIMIT 1;
      IF v_clash IS NOT NULL THEN
        RETURN json_build_object('error', 'SLOT_TAKEN', 'time', v_clash);
      END IF;
    END IF;
    v_cursor := v_cursor + v_service.duration;
  END LOOP;

  v_cursor := v_start;
  FOR i IN 1 .. cardinality(p_service_ids) LOOP
    SELECT * INTO v_service FROM services WHERE id = p_service_ids[i];
    v_time := lpad((v_cursor / 60)::text, 2, '0') || ':' || lpad((v_cursor % 60)::text, 2, '0');
    INSERT INTO bookings (client_name, client_phone, client_email, service_id, service_name, barber_id, barber_name,
                          date, time, price, status, whatsapp_sent_at)
    VALUES (v_name, v_phone, '', v_service.id, v_service.name, p_barber_id, v_barber.short_name,
            p_date, v_time, v_service.price, v_status,
            -- Ya atendido: no se manda confirmación ni recordatorios
            CASE WHEN p_completed THEN now() END);
    v_rows := v_rows + 1;
    v_cursor := v_cursor + v_service.duration;
  END LOOP;

  RETURN json_build_object(
    'ok', true, 'count', v_rows, 'date', p_date, 'start', p_start,
    'end', lpad((v_cursor / 60)::text, 2, '0') || ':' || lpad((v_cursor % 60)::text, 2, '0'));
EXCEPTION WHEN unique_violation THEN
  RETURN json_build_object('error', 'SLOT_TAKEN', 'time', p_start);
END $$;

REVOKE ALL ON FUNCTION public.barber_create_bookings(uuid, text, text, text, date, text, uuid[], boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.barber_create_bookings(uuid, text, text, text, date, text, uuid[], boolean) TO anon, authenticated;
