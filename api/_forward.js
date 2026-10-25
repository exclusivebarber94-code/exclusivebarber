// Reenvía al WhatsApp de la barbería lo que los clientes le escriben al número de avisos
// (guardado por api/whatsapp-incoming en contact_messages con source = 'whatsapp').
//
// Lo llama api/send-reminders cada 10 minutos: junta los mensajes de cada cliente en un solo aviso,
// con su próxima cita, para que cancelaciones y cambios no se pierdan. Los que son solo un
// «ok», «gracias» o un emoji no se reenvían (quedan en Panel → Mensajes).

import { sendTemplate, dateWithWeekday, bogotaDate } from './_reserva.js';

// Se espera un minuto para juntar los mensajes que el cliente manda seguidos
const SETTLE_MS = 60 * 1000;
const MAX_TEXT = 700;
const TRIVIAL = /^(ok+|okey|okay|vale|dale|listo|perfecto|gracias|muchas gracias|ok gracias|listo,? muchas gracias|confirmo|confirmado|confirmada|si|sí|bueno|buenas|hola|holq|buen día|buenos días|buenas tardes|buenas noches|\(mensaje vacío\)|[\p{Extended_Pictographic}\p{Emoji_Modifier}\s‍️.!]+)[.!]*$/iu;

const oneLine = (s) => String(s).replace(/\s+/g, ' ').trim();

export async function forwardClientMessages(db) {
  const templateSid = process.env.TWILIO_TEMPLATE_MENSAJE;
  const ownerTo = process.env.TWILIO_WHATSAPP_TO;
  if (!templateSid || !ownerTo) return { skipped: 'sin plantilla' };

  const before = new Date(Date.now() - SETTLE_MS).toISOString();
  const res = await db(`contact_messages?select=id,name,phone,message,created_at&source=eq.whatsapp&forwarded_at=is.null&created_at=lt.${before}&order=created_at&limit=200`);
  if (!res.ok) throw new Error(`contact_messages ${res.status}`);
  const pending = await res.json();

  const byPhone = new Map();
  for (const m of pending) byPhone.set(m.phone, [...(byPhone.get(m.phone) ?? []), m]);

  const report = { clients: byPhone.size, sent: 0, skipped: 0, failed: 0 };
  for (const [phone, messages] of byPhone) {
    const claim = await db(`contact_messages?id=in.(${messages.map((m) => m.id).join(',')})&forwarded_at=is.null`, {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ forwarded_at: new Date().toISOString() }),
    });
    const claimed = claim.ok ? await claim.json() : [];
    if (!claimed.length) continue;
    const useful = claimed.filter((m) => !TRIVIAL.test(oneLine(m.message)));
    if (!useful.length) { report.skipped += 1; continue; }

    // Próxima cita del cliente (si tiene)
    const next = await db(
      `bookings?select=date,time,service_name&client_phone=in.(${phone},%2B${phone},57${phone})&status=in.(pending,confirmed)&date=gte.${bogotaDate()}&order=date,time&limit=1`,
    ).then((r) => (r.ok ? r.json() : [])).catch(() => []);
    const nextText = next[0] ? `${dateWithWeekday(next[0].date)} a las ${next[0].time} (${next[0].service_name})` : 'no tiene cita próxima';

    let text = useful.map((m) => oneLine(m.message)).join(' · ');
    if (text.length > MAX_TEXT) text = `${text.slice(0, MAX_TEXT - 1)}…`;
    const digits = phone.startsWith('+') ? phone.slice(1) : phone.length === 10 ? `57${phone}` : phone;

    try {
      await sendTemplate(ownerTo, templateSid, {
        1: oneLine(claimed[0].name),
        2: phone,
        3: nextText,
        4: text,
        5: digits,
      });
      report.sent += 1;
    } catch (error) {
      console.error('No se pudo reenviar el mensaje del cliente', phone, error);
      report.failed += 1;
      await db(`contact_messages?id=in.(${claimed.map((m) => m.id).join(',')})`, { method: 'PATCH', body: JSON.stringify({ forwarded_at: null }) });
    }
  }
  return report;
}
