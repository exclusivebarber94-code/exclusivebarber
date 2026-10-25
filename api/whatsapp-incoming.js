// Respuesta automática cuando un cliente le escribe al número de avisos (Twilio → WhatsApp sender →
// «Webhook URL for incoming messages»). Ese número no está en ningún celular. Como el cliente
// escribió primero, la respuesta no necesita plantilla.
//
// Además:
// - Cada mensaje se guarda en Panel → Mensajes (contact_messages, source = 'whatsapp') y
//   api/send-reminders se lo reenvía al WhatsApp de la barbería (así no se pierden cancelaciones).
// - Si el cliente manda varios mensajes seguidos, la respuesta automática sale solo una vez.
// - «NO» lo da de baja del recordatorio para volver (clients.recall_opt_out) y «ACTIVAR» lo vuelve
//   a dar de alta.
// Solo se toca la base si la firma de Twilio es válida.

import crypto from 'node:crypto';
import { connectDb } from './_reserva.js';

const WEBHOOK_URL = 'https://exclusivebarber.co/api/whatsapp-incoming';
const CONTACT = 'escríbenos al WhatsApp 314 411 0530:\nhttps://wa.me/573144110530';

const REPLY =
  'Hola 👋 Este número de Exclusive Barber envía avisos automáticos. Ya le pasamos tu mensaje a la barbería.\n\n' +
  `Si necesitas una respuesta rápida, ${CONTACT}\n\n¡Gracias!`;
const REPLY_OPT_OUT =
  'Listo ✅ No te enviaremos más recordatorios para agendar. Seguirás recibiendo la confirmación y los recordatorios de las citas que reserves.\n\n' +
  'Si cambias de opinión, escribe ACTIVAR.';
const REPLY_OPT_IN = '¡Listo! ✅ Te avisaremos cuando sea hora de tu próxima visita.';

const OPT_OUT = /^\s*(no|stop|baja|parar|cancelar suscripci[oó]n|no gracias)\s*[.!]?\s*$/i;
const OPT_IN = /^\s*(activar|alta)\s*[.!]?\s*$/i;

// Varios mensajes seguidos del mismo cliente: una sola respuesta automática
const QUIET_MS = 30 * 60 * 1000;

const xml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Firma de Twilio: HMAC-SHA1 de la URL + parámetros ordenados (clave y valor), en base64 */
function validTwilioSignature(req) {
  const token = process.env.TWILIO_AUTH_TOKEN;
  const signature = req.headers['x-twilio-signature'];
  if (!token || typeof signature !== 'string') return false;
  const params = req.body && typeof req.body === 'object' ? req.body : {};
  const data = WEBHOOK_URL + Object.keys(params).sort().map((k) => k + params[k]).join('');
  const expected = crypto.createHmac('sha1', token).update(Buffer.from(data, 'utf8')).digest('base64');
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** whatsapp:+573001234567 → 3001234567 (igual que normalize_phone en la base) */
function clientPhone(from) {
  const d = String(from || '').replace(/\D/g, '');
  return d.length === 12 && d.startsWith('57') ? d.slice(2) : d;
}

/** Guarda el mensaje en Panel → Mensajes. Devuelve si el cliente ya había escrito hace poco. */
async function saveMessage(db, phone, body, mediaCount) {
  const since = new Date(Date.now() - QUIET_MS).toISOString();
  const [recent, client] = await Promise.all([
    db(`contact_messages?select=id&source=eq.whatsapp&phone=eq.${encodeURIComponent(phone)}&created_at=gte.${since}&limit=1`).then((r) => (r.ok ? r.json() : [])),
    db(`clients?select=name&phone=eq.${encodeURIComponent(phone)}&limit=1`).then((r) => (r.ok ? r.json() : [])),
  ]);
  const text = body.trim() || (mediaCount > 0 ? '(envió una foto, audio o archivo)' : '(mensaje vacío)');
  const r = await db('contact_messages', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ name: client[0]?.name || 'Cliente por WhatsApp', phone, message: text.slice(0, 2000), source: 'whatsapp' }),
  });
  if (!r.ok) console.error('No se pudo guardar el mensaje', r.status, await r.text());
  return recent.length > 0;
}

export default async function handler(req, res) {
  const body = String(req.body?.Body ?? '');
  let reply = REPLY;
  const wantsOut = OPT_OUT.test(body);
  const wantsIn = !wantsOut && OPT_IN.test(body);
  const db = validTwilioSignature(req) ? connectDb() : null;
  const phone = clientPhone(req.body?.From);

  if (db && phone.length >= 7) {
    if (wantsOut || wantsIn) {
      const r = await db(`clients?phone=eq.${encodeURIComponent(phone)}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify(wantsOut
          ? { recall_opt_out: true, recall_opt_out_at: new Date().toISOString() }
          : { recall_opt_out: false, recall_opt_out_at: null }),
      }).catch((err) => { console.error('No se pudo guardar la preferencia', err); return null; });
      if (r?.ok) reply = wantsOut ? REPLY_OPT_OUT : REPLY_OPT_IN;
    } else {
      const wroteRecently = await saveMessage(db, phone, body, Number(req.body?.NumMedia ?? 0)).catch((err) => {
        console.error('No se pudo guardar el mensaje', err);
        return false;
      });
      if (wroteRecently) reply = '';
    }
  }

  res.setHeader('Content-Type', 'text/xml; charset=utf-8');
  const message = reply ? `<Message>${xml(reply)}</Message>` : '';
  return res.status(200).send(`<?xml version="1.0" encoding="UTF-8"?><Response>${message}</Response>`);
}
