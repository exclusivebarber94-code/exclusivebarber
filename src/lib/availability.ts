import type { BusySlot } from '../services/bookings';
import { todayKey, nowMinutes, timeToMinutes, minutesToTime } from './dates';
import { bookingHoursFor, lunchFor } from './businessHours';

// Horas que se ofrecen al reservar, «pegadas» a las citas: no hay intervalo fijo. Para cada barbero se
// buscan los huecos libres del día (horario de atención, sin almuerzo ni citas) y en cada hueco se
// ofrece la hora en que empieza y las siguientes según lo que dura el servicio pedido, más la hora que
// lo deja terminando justo al final del hueco. Así una cita empieza cuando termina la anterior.

export function isBarberFree(busy: BusySlot[], barberId: string, start: number, duration: number): boolean {
  const end = start + duration;
  return !busy.some((b) => {
    if (b.barberId !== barberId) return false;
    const busyStart = timeToMinutes(b.startTime);
    return busyStart < end && busyStart + b.duration > start;
  });
}

/** Huecos libres [inicio, fin) de un barbero en minutos, dentro de [open, close) y sin los bloqueos. */
export function freeGaps(open: number, close: number, blocks: { start: number; end: number }[]): { start: number; end: number }[] {
  const sorted = blocks.filter((b) => b.end > open && b.start < close).sort((a, b) => a.start - b.start);
  const gaps = [];
  let cursor = open;
  for (const b of sorted) {
    if (b.start > cursor) gaps.push({ start: cursor, end: Math.min(b.start, close) });
    cursor = Math.max(cursor, b.end);
  }
  if (cursor < close) gaps.push({ start: cursor, end: close });
  return gaps;
}

/** Horas de inicio dentro de un hueco: desde el comienzo, una detrás de otra, y la que termina justo al final. */
export function startsInGap(gap: { start: number; end: number }, duration: number): number[] {
  const starts = [];
  for (let t = gap.start; t + duration <= gap.end; t += duration) starts.push(t);
  const lastFit = gap.end - duration;
  if (starts.length && lastFit > starts[starts.length - 1]) starts.push(lastFit);
  return starts;
}

/**
 * Horas libres del día para un servicio de `duration` minutos con alguno de `barberIds`.
 * Solo dentro del horario de atención (el servicio termina antes del cierre), fuera del almuerzo y
 * desde ahora si es hoy (hora de Colombia). Los días cerrados o por orden de llegada no tienen horas.
 */
export function generateSlots(
  date: string,
  busy: BusySlot[],
  barberIds: string[],
  duration: number,
): { time: string; available: boolean }[] {
  const hours = bookingHoursFor(date);
  if (!hours) return [];
  const lunch = lunchFor(date);
  // Hoy: desde la hora actual, redondeada a los 5 minutos siguientes
  const from = date === todayKey() ? Math.max(hours.open, Math.ceil((nowMinutes() + 1) / 5) * 5) : hours.open;
  const starts = new Set<number>();
  for (const id of barberIds) {
    const blocks = busy
      .filter((b) => b.barberId === id)
      .map((b) => ({ start: timeToMinutes(b.startTime), end: timeToMinutes(b.startTime) + b.duration }));
    if (lunch) blocks.push({ start: lunch.start, end: lunch.end });
    for (const gap of freeGaps(from, hours.close, blocks)) {
      for (const t of startsInGap(gap, duration)) starts.add(t);
    }
  }
  return [...starts].sort((a, b) => a - b).map((t) => ({ time: minutesToTime(t), available: true }));
}
