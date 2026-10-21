import type { BusinessConfig } from '../types';

export const businessConfig: BusinessConfig = {
  name: 'Exclusive Barber',
  tagline: 'Más que un corte, es una identidad',
  address: 'Cl 6c #14A-15, Los Ángeles, Valledupar',
  phone: '573144110530',
  whatsapp: '573144110530',
  email: 'exclusivebarber94@gmail.com',
  instagram: 'exclusivebarber94',
  tiktok: 'exclusivebarber94',
  facebook: '1AxQs5JiYT',
  city: 'Valledupar',
  country: 'Colombia',
  primaryColor: '#D4AF37',
  accentColor: '#6B4C2B',
  mapEmbedUrl: 'https://maps.google.com/maps?q=10.483899,-73.261163&z=17&output=embed',
  // Ubicación exacta del local para el mapa (confirmada por el negocio)
  location: { lat: 10.483899, lng: -73.261163 },
  hours: [
    { day: 'Lunes', open: '09:00', close: '19:00', closed: false },
    { day: 'Martes', open: '09:00', close: '19:00', closed: false },
    { day: 'Miércoles', open: '09:00', close: '19:00', closed: false },
    { day: 'Jueves', open: '09:00', close: '19:00', closed: false },
    { day: 'Viernes', open: '09:00', close: '19:00', closed: false },
    { day: 'Sábado', open: '09:00', close: '18:00', closed: false },
    { day: 'Domingo', open: '10:00', close: '15:00', closed: false },
  ],
  // Los festivos de Colombia se detectan solos (src/lib/holidays.ts) y usan este horario, de corrido
  holidayHours: { day: 'Festivos', open: '10:00', close: '15:00', closed: false },
  // Fechas puntuales que cambian el horario normal (se editan en Panel → Configuración).
  // Las reservas por la web se bloquean ese día y la página principal muestra un aviso
  // desde noticeFrom (o desde el día anterior si no se indica).
  //   'walk-in': se abre, pero sin reservas por la web (se atiende por orden de llegada)
  //   'closed':  no se trabaja
  // «El primero que esté libre» al reservar (se apaga en Panel → Configuración → Reglas)
  allowAnyBarber: true,
  // Almuerzo: no se reciben reservas por la web en ese rango, salvo domingos y festivos
  // (se cambia en Panel → Configuración → Horario)
  lunch: { enabled: true, start: '12:00', end: '13:00' },
  // Integrantes retirados (Panel → Barberos): se ocultan de la web y del equipo, sin borrar su historial
  retiredBarbers: [],
  // Reglas de reserva (se cambian en Panel → Configuración → Reglas)
  slotStep: 30,
  daysAhead: 14,
  specialDays: [
    { date: '2026-12-01', type: 'closed', noticeFrom: '2026-11-30' },
    { date: '2026-12-06', type: 'walk-in', noticeFrom: '2026-11-30' },
    { date: '2026-12-07', type: 'walk-in', noticeFrom: '2026-11-30' },
    { date: '2026-12-08', type: 'closed', noticeFrom: '2026-11-30' },
    { date: '2026-12-23', type: 'walk-in', noticeFrom: '2026-11-30' },
    { date: '2026-12-24', type: 'walk-in', noticeFrom: '2026-11-30' },
    { date: '2026-12-25', type: 'closed', noticeFrom: '2026-11-30' },
    { date: '2026-12-30', type: 'walk-in', noticeFrom: '2026-11-30' },
    { date: '2026-12-31', type: 'walk-in', noticeFrom: '2026-11-30' },
  ],
};
