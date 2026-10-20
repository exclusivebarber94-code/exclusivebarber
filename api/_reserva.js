// Utilidades compartidas por los avisos de WhatsApp (confirmación, recordatorios) y el ticket.
//
// Una reserva desde la web puede tener varios servicios seguidos (el carrito): cada servicio es
// una fila en bookings. Se agrupan por celular, fecha y momento de creación para avisar una sola
// vez y mostrar un solo ticket con todo.

export const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

/** Filas creadas con menos de 2 minutos de diferencia son la misma reserva */
const GROUP_WINDOW_MS = 2 * 60 * 1000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isUuid = (s) => typeof s === 'string' && UUID_RE.test(s);

/** Cliente REST de Supabase con la llave service_role (la misma base que usa la web) */
export function connectDb() {
  // Las variables SUPABASE_* las maneja la integración de Vercel y pueden apuntar a otro proyecto
  const url = process.env.APP_SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.APP_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return (path, init = {}) =>
    fetch(`${url}/rest/v1/${path}`, {
      ...init,
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...init.headers },
    });
}

/** «25 de octubre de 2026» */
export function dateWithYear(date) {
  const [y, m, d] = date.split('-').map(Number);
  return `${d} de ${MONTHS[m - 1]} de ${y}`;
}

/** «sábado 25 de octubre» */
export function dateWithWeekday(date) {
  const [y, m, d] = date.split('-').map(Number);
  return `${WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]} ${d} de ${MONTHS[m - 1]}`;
}

export const formatPrice = (n) => `$${Number(n).toLocaleString('es-CO')}`;

/** Fecha y hora de Colombia (UTC-5, sin horario de verano) → milisegundos */
export const startMs = (b) => Date.parse(`${b.date}T${b.time.slice(0, 5)}:00-05:00`);

/** Hoy en Colombia, «YYYY-MM-DD», desplazado `days` días */
export const bogotaDate = (days = 0) => new Date(Date.now() - 5 * 3600e3 + days * 86400e3).toISOString().slice(0, 10);

/** Celular guardado → destino de WhatsApp. Colombia va sin indicativo; los demás con «+indicativo». */
export function whatsappTo(phone) {
  const raw = String(phone).trim();
  const digits = raw.replace(/\D/g, '');
  return raw.startsWith('+') ? `whatsapp:+${digits}` : `whatsapp:+57${digits.replace(/^57(?=\d{10}$)/, '')}`;
}

/** Todas las filas de la misma reserva (incluida esta), en orden de hora */
export async function bookingGroup(db, booking) {
  const t = Date.parse(booking.created_at);
  const from = new Date(t - GROUP_WINDOW_MS).toISOString();
  const to = new Date(t + GROUP_WINDOW_MS).toISOString();
  const res = await db(
    `bookings?select=*&client_phone=eq.${encodeURIComponent(booking.client_phone)}&date=eq.${booking.date}` +
      `&created_at=gte.${from}&created_at=lte.${to}&status=neq.cancelled&order=time`,
  );
  if (!res.ok) throw new Error(`Supabase ${res.status}`);
  const rows = await res.json();
  return rows.some((r) => r.id === booking.id) ? rows : [booking, ...rows];
}

/** Resumen de una o varias filas: servicios con cantidad, horas, barbero(s) y total */
export async function summarize(db, rows) {
  const items = [];
  for (const r of rows) {
    const item = items.find((i) => i.name === r.service_name);
    if (item) { item.qty += 1; item.price += Number(r.price); } else items.push({ name: r.service_name, qty: 1, price: Number(r.price) });
  }
  const first = rows[0];
  const last = rows[rows.length - 1];
  let duration = 30;
  if (last.service_id) {
    const res = await db(`services?select=duration&id=eq.${last.service_id}`).catch(() => null);
    const [svc] = res?.ok ? await res.json() : [];
    if (svc?.duration) duration = svc.duration;
  }
  const [h, m] = last.time.slice(0, 5).split(':').map(Number);
  const endMin = h * 60 + m + duration;
  const endTime = `${String(Math.floor(endMin / 60)).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}`;
  const start = first.time.slice(0, 5);
  return {
    clientName: first.client_name,
    clientPhone: first.client_phone,
    date: first.date,
    start,
    endTime,
    hourText: rows.length > 1 ? `${start} a ${endTime}` : start,
    items,
    servicesText: items.map((i) => (i.qty > 1 ? `${i.qty} × ${i.name}` : i.name)).join(', '),
    barbers: [...new Set(rows.map((r) => r.barber_name).filter(Boolean))].join(' y ') || 'Por asignar',
    total: items.reduce((s, i) => s + i.price, 0),
  };
}

/** Envía una plantilla aprobada de WhatsApp por Twilio. Devuelve el SID del mensaje. */
export async function sendTemplate(to, contentSid, variables) {
  const { TWILIO_ACCOUNT_SID: sid, TWILIO_AUTH_TOKEN: token, TWILIO_WHATSAPP_FROM: from } = process.env;
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ From: from, To: to, ContentSid: contentSid, ContentVariables: JSON.stringify(variables) }).toString(),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(`Twilio ${response.status}: ${result.message ?? 'error'}`);
  return result.sid;
}

export const twilioReady = () =>
  Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_WHATSAPP_FROM);
