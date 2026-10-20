// Envía por WhatsApp (Twilio) la confirmación de una reserva al cliente (con la imagen del ticket)
// y el aviso al negocio.
//
// Recibe solo { bookingId }. Los datos se leen de la base de datos, así nadie puede usar esta
// función para mandar mensajes a números o con textos inventados. Cada reserva se avisa una sola
// vez y solo durante los primeros 15 minutos después de creada. Si la reserva tiene varios
// servicios (varias filas), se manda un solo mensaje con todos.
//
// Variables de entorno en Vercel:
//   VITE_SUPABASE_URL (o APP_SUPABASE_URL), APP_SUPABASE_SERVICE_ROLE_KEY (llave service_role de ese proyecto)
//   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM, TWILIO_WHATSAPP_TO
//   TWILIO_TEMPLATE_CLIENTE, TWILIO_TEMPLATE_DUENO (SIDs HX… de las plantillas aprobadas)
//   TWILIO_TEMPLATE_TICKET (opcional): plantilla con la imagen del ticket; si falta, va solo el texto

import { connectDb, bookingGroup, summarize, dateWithYear, formatPrice, whatsappTo, sendTemplate, twilioReady, isUuid } from './_reserva.js';

// SIDs de las plantillas aprobadas por WhatsApp (Twilio → Content Template Builder).
// Los valores fijos son los de la cuenta anterior; la cuenta nueva usa los de Vercel.
const CLIENT_TEMPLATE_SID = process.env.TWILIO_TEMPLATE_CLIENTE || 'HX3e85a8446dba0bb58f8a9a9a69f478e3db';
const OWNER_TEMPLATE_SID = process.env.TWILIO_TEMPLATE_DUENO || 'HX72c927857b5f25142b698ce7a218b874';
const TICKET_TEMPLATE_SID = process.env.TWILIO_TEMPLATE_TICKET;

const MAX_AGE_MS = 15 * 60 * 1000;
// La base avisa por cada fila apenas se guarda; se espera un momento para que el carrito
// termine de guardarse y el mensaje lleve todos los servicios
const WAIT_FOR_CART_MS = 4000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const bookingId = req.body?.bookingId;
  if (!isUuid(bookingId)) {
    return res.status(400).json({ error: 'bookingId inválido' });
  }

  const db = connectDb();
  const ownerTo = process.env.TWILIO_WHATSAPP_TO;
  if (!db || !twilioReady() || !ownerTo) {
    return res.status(500).json({ error: 'WhatsApp no está configurado' });
  }

  const found = await db(`bookings?select=*&id=eq.${bookingId}&whatsapp_sent_at=is.null&created_at=gte.${new Date(Date.now() - MAX_AGE_MS).toISOString()}`);
  if (!found.ok) {
    console.error('Supabase error', found.status, await found.text());
    return res.status(500).json({ error: 'No se pudo leer la reserva' });
  }
  const [booking] = await found.json();
  if (!booking) {
    return res.status(409).json({ error: 'La reserva no existe, ya fue avisada o es muy antigua' });
  }

  await sleep(WAIT_FOR_CART_MS);
  const group = await bookingGroup(db, booking);

  // Reservar el envío: solo una petición puede marcar la reserva como avisada
  const ids = group.map((b) => b.id).join(',');
  const claim = await db(`bookings?id=in.(${ids})&whatsapp_sent_at=is.null`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ whatsapp_sent_at: new Date().toISOString() }),
  });
  if (!claim.ok) {
    console.error('Supabase error', claim.status, await claim.text());
    return res.status(500).json({ error: 'No se pudo leer la reserva' });
  }
  const claimed = await claim.json();
  if (!claimed.some((b) => b.id === booking.id)) {
    return res.status(409).json({ error: 'La reserva ya fue avisada' });
  }

  const s = await summarize(db, group);
  const dateFormatted = dateWithYear(s.date);
  const priceFormatted = formatPrice(s.total);

  const results = {};
  try {
    results.owner = await sendTemplate(ownerTo, OWNER_TEMPLATE_SID, {
      1: s.clientName,
      2: s.clientPhone,
      3: s.servicesText,
      4: s.barbers,
      5: dateFormatted,
      6: s.hourText,
      7: priceFormatted,
    });
  } catch (error) {
    console.error('No se pudo avisar al negocio', error);
    results.ownerError = error.message;
  }

  const clientVars = { 1: s.clientName, 2: dateFormatted, 3: s.hourText, 4: s.servicesText, 5: s.barbers, 6: priceFormatted };
  try {
    // Con la imagen del ticket (la URL de la imagen lleva el id de la primera fila)
    results.client = TICKET_TEMPLATE_SID
      ? await sendTemplate(whatsappTo(s.clientPhone), TICKET_TEMPLATE_SID, { ...clientVars, 7: group[0].id })
      : await sendTemplate(whatsappTo(s.clientPhone), CLIENT_TEMPLATE_SID, clientVars);
  } catch (error) {
    console.error('No se pudo enviar el ticket al cliente', error);
    results.clientError = error.message;
    if (TICKET_TEMPLATE_SID) {
      // Si la plantilla con imagen falla, al menos va la confirmación en texto
      try {
        results.client = await sendTemplate(whatsappTo(s.clientPhone), CLIENT_TEMPLATE_SID, clientVars);
      } catch (err) {
        results.clientError += ` | texto: ${err.message}`;
      }
    }
  }

  const ok = Boolean(results.owner || results.client);
  if (!ok) {
    // Ningún mensaje salió: se libera la marca para poder reintentar
    await db(`bookings?id=in.(${claimed.map((b) => b.id).join(',')})`, { method: 'PATCH', body: JSON.stringify({ whatsapp_sent_at: null }) });
  }
  return res.status(ok ? 200 : 502).json({ success: ok, services: group.length, ...results });
}
