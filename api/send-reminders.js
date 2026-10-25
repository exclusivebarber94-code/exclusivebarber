// Recordatorios por WhatsApp: 24 horas y 2 horas antes de la cita.
//
// La base de datos llama a esta función cada 10 minutos (pg_cron + pg_net, migración
// 20261020000000_recordatorios_whatsapp.sql) con el encabezado x-cron-secret. Cada recordatorio
// sale una sola vez (columnas reminder_24h_sent_at y reminder_2h_sent_at) y solo si la cita ya
// existía cuando empezó su ventana: quien reserva para dentro de 5 horas no recibe el de 24 horas.
// Una reserva con varios servicios seguidos recibe un solo recordatorio.
//
// Variables de entorno en Vercel: las de send-whatsapp, más
//   REMINDERS_SECRET (el mismo valor de notification_settings.reminders_secret)
//   TWILIO_TEMPLATE_RECORDATORIO (SID HX… de la plantilla aprobada)
//   TWILIO_TEMPLATE_REGRESO (opcional): «ya es hora de volver», ver _recall.js
//   TWILIO_TEMPLATE_MENSAJE (opcional): reenvío de mensajes de clientes al negocio, ver _forward.js

import { connectDb, summarize, dateWithWeekday, startMs, bogotaDate, whatsappTo, sendTemplate, twilioReady } from './_reserva.js';
import { sendRecalls } from './_recall.js';
import { forwardClientMessages } from './_forward.js';

const HOUR = 3600e3;
const KINDS = [
  { column: 'reminder_24h_sent_at', before: 24 * HOUR, until: 2 * HOUR },
  { column: 'reminder_2h_sent_at', before: 2 * HOUR, until: 0 },
];

export default async function handler(req, res) {
  const secret = process.env.REMINDERS_SECRET;
  if (!secret || req.headers['x-cron-secret'] !== secret) {
    return res.status(401).json({ error: 'No autorizado' });
  }
  const db = connectDb();
  const templateSid = process.env.TWILIO_TEMPLATE_RECORDATORIO;
  if (!db || !twilioReady() || !templateSid) {
    return res.status(500).json({ error: 'Recordatorios no configurados' });
  }

  const today = bogotaDate();
  const found = await db(`bookings?select=*&status=in.(pending,confirmed)&date=in.(${today},${bogotaDate(1)})&order=date,time`);
  if (!found.ok) {
    console.error('Supabase error', found.status, await found.text());
    return res.status(500).json({ error: 'No se pudieron leer las citas' });
  }
  const bookings = await found.json();
  const now = Date.now();
  const report = { sent: 0, failed: 0 };

  for (const kind of KINDS) {
    const pending = bookings.filter((b) => !b[kind.column]);
    const done = new Set();
    for (const b of pending) {
      if (done.has(b.id)) continue;
      const left = startMs(b) - now;
      // Está en su ventana y la cita ya existía cuando la ventana empezó
      if (left > kind.before || left <= kind.until || Date.parse(b.created_at) > startMs(b) - kind.before) continue;

      // Los servicios seguidos del mismo cliente ese día van en el mismo recordatorio
      const group = pending.filter((x) => x.client_phone === b.client_phone && x.date === b.date && x.time >= b.time);
      group.forEach((x) => done.add(x.id));
      const claim = await db(`bookings?id=in.(${group.map((x) => x.id).join(',')})&${kind.column}=is.null`, {
        method: 'PATCH',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({ [kind.column]: new Date().toISOString() }),
      });
      const claimed = claim.ok ? await claim.json() : [];
      if (!claimed.some((x) => x.id === b.id)) continue; // otra ejecución ya lo envió

      const s = await summarize(db, group);
      const when = b.date === today ? 'hoy' : `mañana, ${dateWithWeekday(b.date)}`;
      try {
        await sendTemplate(whatsappTo(s.clientPhone), templateSid, { 1: s.clientName, 2: when, 3: s.start, 4: s.servicesText, 5: s.barbers });
        report.sent += 1;
      } catch (error) {
        console.error('No se pudo enviar el recordatorio', b.id, error);
        report.failed += 1;
        // Se libera para reintentar en la próxima ejecución (si aún está en la ventana)
        await db(`bookings?id=in.(${claimed.map((x) => x.id).join(',')})`, { method: 'PATCH', body: JSON.stringify({ [kind.column]: null }) });
      }
    }
  }
  // Mensajes que los clientes le escribieron al número de avisos → WhatsApp de la barbería
  try {
    report.messages = await forwardClientMessages(db);
  } catch (error) {
    console.error('Reenvío de mensajes', error);
    report.messages = { error: error.message };
  }
  // «Ya es hora de volver» (solo en su ventana de horario; no frena los recordatorios de citas)
  try {
    const settings = await db('business_settings?select=data&limit=1').then((r) => r.json()).then((rows) => rows[0]?.data ?? {});
    report.recall = await sendRecalls(db, settings);
  } catch (error) {
    console.error('Recordatorio para volver', error);
    report.recall = { error: error.message };
  }
  return res.status(200).json(report);
}
