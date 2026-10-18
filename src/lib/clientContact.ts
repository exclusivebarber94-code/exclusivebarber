// Nombre y celular del visitante, guardados en su propio navegador para no pedírselos
// otra vez (en la reserva y en el chat). Si el navegador no permite guardar, todo funciona igual.

const STORAGE_KEY = 'exclusive-barber-contact';
const LEGACY_CHAT_KEY = 'exclusive-barber-chat-contact';

export interface ClientContact {
  name: string;
  phone: string;
  /** País del celular (código ISO: co, ve, us…). Si falta, Colombia */
  country?: string;
}

export function loadClientContact(): ClientContact {
  for (const key of [STORAGE_KEY, LEGACY_CHAT_KEY]) {
    try {
      const saved = JSON.parse(localStorage.getItem(key) ?? 'null');
      if (saved && typeof saved.name === 'string' && typeof saved.phone === 'string') {
        return { name: saved.name, phone: saved.phone, country: typeof saved.country === 'string' ? saved.country : 'co' };
      }
    } catch {
      // Sin almacenamiento disponible (modo privado, etc.)
    }
  }
  return { name: '', phone: '', country: 'co' };
}

export function saveClientContact(contact: ClientContact) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ name: contact.name.trim(), phone: contact.phone.trim(), country: contact.country ?? 'co' }));
  } catch {
    // No es necesario recordar los datos para reservar
  }
}

export const phoneDigits = (phone: string) => phone.replace(/\D/g, '');

export const isValidName = (name: string) => name.trim().length >= 3;

/** Celular colombiano: 10 dígitos (se acepta con +57 o espacios). */
export const isValidPhone = (phone: string) => {
  const digits = phoneDigits(phone);
  return digits.length === 10 || (digits.length === 12 && digits.startsWith('57'));
};
