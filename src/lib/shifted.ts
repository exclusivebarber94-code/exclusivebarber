import type { Booking } from '../types';
import { whatsappUrl } from './phoneCountry';

// Citas adelantadas porque el barbero terminó la anterior antes de tiempo (ver migración adelantar_citas)

export const isShifted = (b: Booking) =>
  !!b.originalTime && b.originalTime !== b.time && (b.status === 'pending' || b.status === 'confirmed');

export function shiftWhatsappLink(b: Booking): string {
  const first = b.clientName.replace(/\s*\(turno \d+\)$/, '').split(' ')[0];
  const text = `Hola ${first}, te escribimos de Exclusive Barber 💈. Tu cita de hoy se adelantó a las ${b.time} (antes era a las ${b.originalTime}). ¿Puedes venir a esa hora? Si no, respóndenos y te acomodamos.`;
  return whatsappUrl(b.clientPhone, text);
}
