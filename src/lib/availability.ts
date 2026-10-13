import type { BusySlot } from '../services/bookings';
import { todayKey, nowMinutes, timeToMinutes, minutesToTime } from './dates';
import { bookingHoursFor, lunchFor } from './businessHours';
import { businessConfig } from '../config/business';

// Cada cuánto empieza una cita (businessConfig.slotStep, editable en Panel → Configuración → Reglas).
// El horario de cada día sale de businessConfig.hours.

export function isBarberFree(busy: BusySlot[], barberId: string, start: number, duration: number): boolean {
  const end = start + duration;
  return !busy.some((b) => {
    if (b.barberId !== barberId) return false;
    const busyStart = timeToMinutes(b.startTime);
    return busyStart < end && busyStart + b.duration > start;
  });
}

/**
 * Horas del día con al menos uno de `barberIds` libre durante toda la duración del servicio.
 * Solo dentro del horario de atención: el servicio debe terminar antes del cierre.
 * Las horas que ya pasaron (hoy, en Colombia) salen como no disponibles.
 * Los días que la barbería está cerrada o atiende por orden de llegada no tienen horas.
 */
export function generateSlots(
  date: string,
  busy: BusySlot[],
  barberIds: string[],
  duration: number,
): { time: string; available: boolean }[] {
  const hours = bookingHoursFor(date);
  if (!hours) return [];
  const isToday = date === todayKey();
  const now = nowMinutes();
  const lunch = lunchFor(date);
  const slots = [];
  for (let start = hours.open; start + duration <= hours.close; start += businessConfig.slotStep) {
    // Durante el almuerzo no se ofrecen horas; las que se cruzarían con él salen ocupadas
    if (lunch && start >= lunch.start && start < lunch.end) continue;
    const crossesLunch = !!lunch && start < lunch.end && start + duration > lunch.start;
    const isPast = isToday && start <= now;
    const someoneFree = barberIds.some((id) => isBarberFree(busy, id, start, duration));
    slots.push({ time: minutesToTime(start), available: !isPast && !crossesLunch && someoneFree });
  }
  return slots;
}
