// «Ya es hora de volver»: le escribe por WhatsApp al cliente que ya debería haber vuelto según su
// ritmo de visitas (lo calcula la base de datos: recall_candidates, migración 20261022000000).
//
// Es un mensaje publicitario, así que respeta la Ley 2300 de 2023: solo de lunes a sábado (nunca
// domingos ni festivos) y en la mañana; máximo uno por semana por cliente (eso lo filtra la base).
// Se puede apagar desde el panel (business_settings.data.recall.enabled).

import { whatsappTo, sendTemplate, bogotaDate } from './_reserva.js';

// Ventana de envío (hora de Colombia): dentro de lo permitido para lunes a sábado
const FROM_HOUR = 10;
const TO_HOUR = 13;
const MAX_PER_RUN = 25;

const bogotaNow = () => new Date(Date.now() - 5 * 3600e3);

/** ¿Es momento de enviar? Lunes a sábado, de 10:00 a 13:00, y no festivo. */
export async function recallWindowOpen(db) {
  const now = bogotaNow();
  const weekday = now.getUTCDay(); // 0 = domingo
  const hour = now.getUTCHours();
  if (weekday === 0 || hour < FROM_HOUR || hour >= TO_HOUR) return false;
  const res = await db('rpc/is_colombian_holiday', { method: 'POST', body: JSON.stringify({ p_date: bogotaDate() }) });
  return res.ok && (await res.json()) === false;
}

const firstName = (name) => String(name || '').trim().split(/\s+/)[0] || 'hola';

export async function sendRecalls(db, settings) {
  const templateSid = process.env.TWILIO_TEMPLATE_REGRESO;
  if (!templateSid || settings?.recall?.enabled === false) return { skipped: 'apagado' };
  if (!(await recallWindowOpen(db))) return { skipped: 'fuera de horario' };

  const res = await db('rpc/recall_candidates', { method: 'POST', body: '{}' });
  if (!res.ok) throw new Error(`recall_candidates ${res.status}: ${await res.text()}`);
  const candidates = (await res.json()).slice(0, MAX_PER_RUN);

  const report = { candidates: candidates.length, sent: 0, failed: 0 };
  for (const c of candidates) {
    const weekAgo = new Date(Date.now() - 7 * 86400e3).toISOString();
    // Reservar el envío (si dos ejecuciones coinciden, solo una lo manda)
    const claim = await db(
      `clients?phone=eq.${encodeURIComponent(c.phone)}&recall_opt_out=is.false&or=(recall_sent_at.is.null,recall_sent_at.lt.${weekAgo})`,
      { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ recall_sent_at: new Date().toISOString() }) },
    );
    const [client] = claim.ok ? await claim.json() : [];
    if (!client) continue;
    try {
      await sendTemplate(whatsappTo(c.client_phone), templateSid, {
        1: firstName(c.client_name),
        2: String(c.days_since),
        3: String(c.last_service_name || 'corte').trim().toLowerCase(),
        4: String(c.every_days),
        5: c.last_service_id || 'cita',
      });
      report.sent += 1;
    } catch (error) {
      console.error('No se pudo enviar el recordatorio para volver', c.phone, error);
      report.failed += 1;
      // Se libera para intentarlo otro día
      await db(`clients?phone=eq.${encodeURIComponent(c.phone)}`, { method: 'PATCH', body: JSON.stringify({ recall_sent_at: null }) });
    }
  }
  return report;
}
