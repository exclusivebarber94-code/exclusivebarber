// Respuesta automática cuando un cliente le escribe al número de avisos (Twilio → WhatsApp sender →
// «Webhook URL for incoming messages»). Ese número no está en ningún celular: se le indica al cliente
// el WhatsApp de la barbería. Como el cliente escribió primero, la respuesta no necesita plantilla.
//
// Además: «NO» lo da de baja del recordatorio para volver (clients.recall_opt_out) y «ACTIVAR» lo
// vuelve a dar de alta. Solo se cambia la base si la firma de Twilio es válida.

import crypto from 'node:crypto';
import { connectDb } from './_reserva.js';

const WEBHOOK_URL = 'https://exclusivebarber.co/api/whatsapp-incoming';
const CONTACT = 'escríbenos al WhatsApp 314 411 0530:\nhttps://wa.me/573144110530';

const REPLY =
  'Hola 👋 Este número de Exclusive Barber solo envía avisos automáticos y no recibe mensajes.\n\n' +
  `Para cambiar o cancelar tu cita, o para cualquier pregunta, ${CONTACT}\n\n¡Gracias!`;
const REPLY_OPT_OUT =
  'Listo ✅ No te enviaremos más recordatorios para agendar. Seguirás recibiendo la confirmación y los recordatorios de las citas que reserves.\n\n' +
  'Si cambias de opinión, escribe ACTIVAR.';
const REPLY_OPT_IN = '¡Listo! ✅ Te avisaremos cuando sea hora de tu próxima visita.';

const OPT_OUT = /^\s*(no|stop|baja|parar|cancelar suscripci[oó]n|no gracias)\s*[.!]?\s*$/i;
const OPT_IN = /^\s*(activar|alta|si|sí)\s*[.!]?\s*$/i;

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

export default async function handler(req, res) {
  const body = String(req.body?.Body ?? '');
  let reply = REPLY;
  const wantsOut = OPT_OUT.test(body);
  const wantsIn = !wantsOut && OPT_IN.test(body);

  if ((wantsOut || wantsIn) && validTwilioSignature(req)) {
    const db = connectDb();
    const phone = clientPhone(req.body?.From);
    if (db && phone.length >= 7) {
      const r = await db(`clients?phone=eq.${encodeURIComponent(phone)}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify(wantsOut
          ? { recall_opt_out: true, recall_opt_out_at: new Date().toISOString() }
          : { recall_opt_out: false, recall_opt_out_at: null }),
      }).catch((err) => { console.error('No se pudo guardar la preferencia', err); return null; });
      if (r?.ok) reply = wantsOut ? REPLY_OPT_OUT : REPLY_OPT_IN;
    }
  }

  res.setHeader('Content-Type', 'text/xml; charset=utf-8');
  return res.status(200).send(`<?xml version="1.0" encoding="UTF-8"?><Response><Message>${xml(reply)}</Message></Response>`);
}
