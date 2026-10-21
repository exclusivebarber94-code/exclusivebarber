import { supabase } from '../lib/supabase';
import { rowToBooking } from './bookings';
import type { Booking } from '../types';

// Portal del barbero: el PIN se valida en el servidor en cada llamada.
// Tras 5 intentos fallidos el barbero queda bloqueado 15 minutos.

export type BarberAuthResult = 'OK' | 'INVALID_PIN' | 'PIN_LOCKED';

export class BarberPortalError extends Error {
  constructor(public code: string) {
    super(code);
    this.name = 'BarberPortalError';
  }
}

export async function barberLogin(barberId: string, pin: string): Promise<BarberAuthResult> {
  const { data, error } = await supabase.rpc('barber_login', { p_barber_id: barberId, p_pin: pin });
  if (error) throw error;
  return data as BarberAuthResult;
}

export async function getBarberBookings(barberId: string, pin: string): Promise<Booking[]> {
  const { data, error } = await supabase.rpc('barber_get_bookings', { p_barber_id: barberId, p_pin: pin });
  if (error) throw error;
  const result = data as { error?: string; bookings?: Parameters<typeof rowToBooking>[0][] };
  if (result.error) throw new BarberPortalError(result.error);
  return (result.bookings ?? []).map(rowToBooking);
}

export async function setBarberBookingStatus(
  barberId: string,
  pin: string,
  bookingId: string,
  status: Booking['status'],
): Promise<void> {
  const { data, error } = await supabase.rpc('barber_set_status', {
    p_barber_id: barberId,
    p_pin: pin,
    p_booking_id: bookingId,
    p_status: status,
  });
  if (error) throw error;
  if (data !== 'OK') throw new BarberPortalError(data as string);
}

export type ChangePinResult = BarberAuthResult | 'INVALID_NEW_PIN';

/** El barbero cambia su PIN (pide el actual; cuenta como intento de ingreso si es incorrecto). */
export async function changeBarberPin(barberId: string, currentPin: string, newPin: string): Promise<ChangePinResult> {
  const { data, error } = await supabase.rpc('barber_change_pin', {
    p_barber_id: barberId,
    p_current_pin: currentPin,
    p_new_pin: newPin,
  });
  if (error) throw error;
  return data as ChangePinResult;
}

export type BarberBookingError =
  | 'INVALID_PIN' | 'PIN_LOCKED' | 'INVALID_NAME' | 'INVALID_PHONE' | 'NO_SERVICES' | 'TOO_MANY_SERVICES'
  | 'SERVICE_NOT_FOUND' | 'WRONG_PROFESSIONAL' | 'INVALID_TIME' | 'PAST_TIME' | 'TOO_FAR' | 'SLOT_TAKEN';

export type BarberBookingResult =
  | { ok: true; count: number; date: string; start: string; end: string }
  | { ok?: false; error: BarberBookingError; time?: string };

/**
 * «Cliente nuevo» desde el portal: registra un cliente ya atendido o le agenda una cita.
 * El servidor valida el PIN, usa los precios del catálogo y revisa que no choque con otra cita.
 * Los servicios van seguidos desde `start`, en el orden de `serviceIds` (repetidos = cantidad).
 */
export async function barberCreateBookings(input: {
  barberId: string;
  pin: string;
  clientName: string;
  clientPhone: string;
  date: string;
  start: string;
  serviceIds: string[];
  completed: boolean;
}): Promise<BarberBookingResult> {
  const { data, error } = await supabase.rpc('barber_create_bookings', {
    p_barber_id: input.barberId,
    p_pin: input.pin,
    p_client_name: input.clientName,
    p_client_phone: input.clientPhone,
    p_date: input.date,
    p_start: input.start,
    p_service_ids: input.serviceIds,
    p_completed: input.completed,
  });
  if (error) throw error;
  return data as BarberBookingResult;
}
