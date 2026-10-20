// Dibuja el ticket de la reserva como imagen PNG (el mismo diseño del ticket de la web,
// src/components/booking/BookingTicket.tsx), para mandarlo por WhatsApp.

import { ImageResponse } from '@vercel/og';
import { dateWithWeekday, formatPrice } from './_reserva.js';

const FONT_CDN = 'https://cdn.jsdelivr.net/npm/@fontsource';
const FONTS = [
  { name: 'Inter', weight: 400, style: 'normal', file: 'inter@5.0.18/files/inter-latin-400-normal.woff' },
  { name: 'Inter', weight: 700, style: 'normal', file: 'inter@5.0.18/files/inter-latin-700-normal.woff' },
  { name: 'Playfair', weight: 400, style: 'italic', file: 'playfair-display@5.0.19/files/playfair-display-latin-400-italic.woff' },
];
let fontsCache;
const loadFonts = () =>
  (fontsCache ??= Promise.all(
    FONTS.map(async (f) => {
      const res = await fetch(`${FONT_CDN}/${f.file}`);
      if (!res.ok) throw new Error(`Fuente ${f.file}: ${res.status}`);
      return { name: f.name, weight: f.weight, style: f.style, data: await res.arrayBuffer() };
    }),
  ).catch((err) => { fontsCache = undefined; throw err; }));

/** Código corto, igual que src/lib/ticket.ts (EB-3F2A9C) */
export const ticketCode = (bookingId) => `EB-${bookingId.replace(/-/g, '').slice(0, 6).toUpperCase()}`;

// Elementos para satori sin JSX. Todo div con varios hijos necesita display: flex.
const h = (style, ...children) => ({
  type: 'div',
  props: { style: { display: 'flex', ...style }, children: children.length === 1 ? children[0] : children },
});

/**
 * @param {object} s       resumen de summarize() en _reserva.js
 * @param {string} id      id de la primera fila (para el código)
 * @param {string} logo    URL o data URL del logo
 * @param {string} address dirección del negocio
 * @returns {Promise<Buffer>} PNG
 */
export async function renderTicket(s, id, logo, address) {
  const W = 720;
  const rows = [
    ['Cliente', s.clientName],
    ...s.items.map((i, n) => [n === 0 ? (s.items.length > 1 || i.qty > 1 ? 'Servicios' : 'Servicio') : '', `${i.qty} × ${i.name}`]),
    ['Barbero', s.barbers],
    ['Fecha', dateWithWeekday(s.date)],
    ['Hora', s.hourText],
  ];
  const H = 830 + rows.length * 58;

  const notch = (side) => h({ position: 'absolute', top: 0, [side]: -22, width: 44, height: 44, borderRadius: 22, background: '#0b0b0b' });

  const tree = h(
    { width: W, height: H, background: '#0b0b0b', padding: 32, fontFamily: 'Inter' },
    h(
      { flexDirection: 'column', width: '100%', borderRadius: 40, overflow: 'hidden', background: '#121212', border: '2px solid #5c4a14' },
      // Encabezado con el logo y el código
      h(
        { flexDirection: 'column', alignItems: 'center', padding: '40px 40px 34px', background: 'linear-gradient(160deg, #2a2108 0%, #121212 75%)' },
        { type: 'img', props: { src: logo, width: 210, height: 210, style: { objectFit: 'contain' } } },
        h({ marginTop: 18, fontSize: 19, letterSpacing: 6, color: '#a1a1aa' }, 'RESERVA CONFIRMADA'),
        h({ marginTop: 6, fontSize: 50, fontWeight: 700, letterSpacing: 8, color: '#D4AF37' }, ticketCode(id)),
      ),
      // Línea punteada con los recortes del ticket
      h(
        { position: 'relative', height: 44, alignItems: 'center', padding: '0 36px' },
        notch('left'),
        notch('right'),
        h({ flex: 1, borderTop: '3px dashed #3f3f46' }),
      ),
      // Datos de la cita
      h(
        { flexDirection: 'column', padding: '6px 44px 0' },
        ...rows.map(([label, value]) =>
          h(
            { justifyContent: 'space-between', alignItems: 'flex-start', fontSize: 26, marginBottom: 20 },
            h({ color: '#71717a', width: 170 }, label || ' '),
            h({ color: '#ffffff', fontWeight: 700, flex: 1, justifyContent: 'flex-end', textAlign: 'right' }, value),
          ),
        ),
        h(
          { justifyContent: 'space-between', alignItems: 'center', borderTop: '2px solid #27272a', paddingTop: 22, marginTop: 4 },
          h({ color: '#a1a1aa', fontSize: 26 }, 'Total'),
          h({ color: '#D4AF37', fontSize: 44, fontWeight: 700 }, formatPrice(s.total)),
        ),
        h({ justifyContent: 'flex-end', color: '#71717a', fontSize: 20, marginTop: 4 }, 'Pago en la barbería'),
      ),
      // Pie con la dirección
      h(
        { flexDirection: 'column', alignItems: 'center', marginTop: 'auto', padding: '28px 40px 30px', background: '#0f0f0f', borderTop: '2px solid #27272a' },
        h({ color: '#a1a1aa', fontSize: 22 }, address),
        h({ marginTop: 12, color: '#E8C766', fontSize: 28, fontFamily: 'Playfair', fontStyle: 'italic' }, 'Más que un corte, es una identidad'),
        h({ marginTop: 8, color: '#52525b', fontSize: 18 }, 'Muestra este ticket al llegar · Llega 5 minutos antes'),
      ),
    ),
  );

  const image = new ImageResponse(tree, { width: W, height: H, fonts: await loadFonts() });
  return Buffer.from(await image.arrayBuffer());
}
