// Imagen del ticket de una reserva: GET /api/ticket/<id de la reserva> (vercel.json → /api/ticket?id=…)
// La usa la plantilla de WhatsApp «ticket» como imagen del mensaje. El id es un UUID imposible de
// adivinar y la imagen solo muestra lo mismo que el cliente ve en su ticket.

import { connectDb, bookingGroup, summarize, isUuid } from './_reserva.js';
import { renderTicket } from './_ticketImage.js';

const DEFAULT_ADDRESS = 'Cl 6c #14A-15, Los Ángeles, Valledupar';
const SAMPLE = {
  clientName: 'Carlos Pérez', date: '2026-10-25', hourText: '10:30',
  items: [{ name: 'Corte premium', qty: 1, price: 30000 }], barbers: 'Guinyer', total: 30000,
};

export default async function handler(req, res) {
  const id = req.query?.id;
  // Ticket de muestra (datos inventados) para la revisión de la plantilla en WhatsApp
  if (id === 'ejemplo') {
    const png = await renderTicket(SAMPLE, '00000000-0000-4000-8000-000000000000', `https://${req.headers.host}/logo_exclusivebarber.png`, DEFAULT_ADDRESS);
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.status(200).send(png);
  }
  if (!isUuid(id)) return res.status(400).json({ error: 'id inválido' });
  const db = connectDb();
  if (!db) return res.status(500).json({ error: 'Sin base de datos' });

  try {
    const [found, settings] = await Promise.all([
      db(`bookings?select=*&id=eq.${id}`).then((r) => r.json()),
      db('business_settings?select=data&limit=1').then((r) => r.json()).catch(() => []),
    ]);
    const booking = found?.[0];
    if (!booking) return res.status(404).json({ error: 'Reserva no encontrada' });

    const group = await bookingGroup(db, booking);
    const summary = await summarize(db, group);
    const address = (settings?.[0]?.data?.address || DEFAULT_ADDRESS).trim();
    const logo = `https://${req.headers.host}/logo_exclusivebarber.png`;
    const png = await renderTicket(summary, group[0].id, logo, address);

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=300');
    return res.status(200).send(png);
  } catch (err) {
    console.error('No se pudo crear el ticket', err);
    return res.status(500).json({ error: 'No se pudo crear el ticket' });
  }
}
