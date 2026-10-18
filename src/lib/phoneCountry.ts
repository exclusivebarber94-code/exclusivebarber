// País de un número de celular, para mostrar su bandera y armar bien el enlace de WhatsApp.
//
// Los celulares se guardan casi siempre sin indicativo («3001234567»). Reglas:
//  - Con indicativo (más de 10 dígitos o empieza por +): se reconoce por el indicativo.
//  - 10 dígitos que empiezan por 3 (celular) o 60 (fijo): Colombia.
//  - 10 dígitos 412/414/416/424/426 u 11 dígitos 0412…: Venezuela (escrito sin el 58).
//  - 10 dígitos 09…: Ecuador.
//  - Otros 10 dígitos que empiezan de 2 a 9: Estados Unidos o Canadá (formato +1).
// Si no se reconoce, se asume Colombia para el enlace y se muestra un globo.

export interface PhoneCountry {
  /** Código ISO para la bandera (co, ve, us…); vacío si no se reconoce */
  iso: string;
  name: string;
  /** Indicativo sin «+» */
  dial: string;
  /** Número internacional para wa.me (solo dígitos) */
  international: string;
}

// Indicativos: los más largos primero para que «593» gane sobre «59…»
const CODES: [string, string, string][] = [
  ['593', 'ec', 'Ecuador'], ['507', 'pa', 'Panamá'], ['506', 'cr', 'Costa Rica'], ['502', 'gt', 'Guatemala'],
  ['503', 'sv', 'El Salvador'], ['504', 'hn', 'Honduras'], ['505', 'ni', 'Nicaragua'], ['591', 'bo', 'Bolivia'],
  ['595', 'py', 'Paraguay'], ['598', 'uy', 'Uruguay'], ['351', 'pt', 'Portugal'], ['1809', 'do', 'República Dominicana'],
  ['1829', 'do', 'República Dominicana'], ['1849', 'do', 'República Dominicana'], ['1787', 'pr', 'Puerto Rico'],
  ['57', 'co', 'Colombia'], ['58', 've', 'Venezuela'], ['52', 'mx', 'México'], ['51', 'pe', 'Perú'], ['56', 'cl', 'Chile'],
  ['54', 'ar', 'Argentina'], ['55', 'br', 'Brasil'], ['53', 'cu', 'Cuba'], ['34', 'es', 'España'], ['39', 'it', 'Italia'],
  ['33', 'fr', 'Francia'], ['49', 'de', 'Alemania'], ['44', 'gb', 'Reino Unido'], ['1', 'us', 'Estados Unidos / Canadá'],
];

const country = (dial: string, iso: string, name: string, national: string): PhoneCountry => ({ iso, name, dial, international: dial + national });

export function phoneCountry(raw: string): PhoneCountry {
  const plus = String(raw ?? '').trim().startsWith('+');
  const digits = String(raw ?? '').replace(/\D/g, '');

  // Con indicativo escrito
  if (plus || digits.length > 10) {
    const withCode = digits.replace(/^00/, '');
    const hit = CODES.find(([code]) => withCode.startsWith(code) && withCode.length - code.length >= 7);
    if (hit) return country(hit[0], hit[1], hit[2], withCode.slice(hit[0].length));
    if (/^04(12|14|16|24|26)\d{7}$/.test(digits)) return country('58', 've', 'Venezuela', digits.slice(1));
  }
  if (digits.length === 10) {
    if (/^3\d{9}$/.test(digits) || /^60\d{8}$/.test(digits)) return country('57', 'co', 'Colombia', digits);
    if (/^4(12|14|16|24|26)\d{7}$/.test(digits)) return country('58', 've', 'Venezuela', digits);
    if (/^09\d{8}$/.test(digits)) return country('593', 'ec', 'Ecuador', digits.slice(1));
    if (/^[2-9]\d{9}$/.test(digits)) return country('1', 'us', 'Estados Unidos / Canadá', digits);
  }
  return { iso: '', name: 'País no identificado', dial: '57', international: digits.length === 10 ? `57${digits}` : digits };
}

// ---------------------------------------------------------------- selector de país al reservar

export interface DialCountry {
  iso: string;
  name: string;
  dial: string;
  /** Ejemplo para el campo */
  example: string;
  /** Dígitos del número nacional (sin indicativo) */
  min: number;
  max: number;
}

/** Países que se pueden elegir en el formulario (Colombia primero; luego los más frecuentes) */
export const DIAL_COUNTRIES: DialCountry[] = [
  { iso: 'co', name: 'Colombia', dial: '57', example: '300 123 4567', min: 10, max: 10 },
  { iso: 've', name: 'Venezuela', dial: '58', example: '412 123 4567', min: 10, max: 10 },
  { iso: 'us', name: 'Estados Unidos / Canadá', dial: '1', example: '305 555 1234', min: 10, max: 10 },
  { iso: 'ec', name: 'Ecuador', dial: '593', example: '99 123 4567', min: 9, max: 9 },
  { iso: 'pe', name: 'Perú', dial: '51', example: '912 345 678', min: 9, max: 9 },
  { iso: 'pa', name: 'Panamá', dial: '507', example: '6123 4567', min: 8, max: 8 },
  { iso: 'mx', name: 'México', dial: '52', example: '55 1234 5678', min: 10, max: 10 },
  { iso: 'do', name: 'República Dominicana', dial: '1', example: '809 123 4567', min: 10, max: 10 },
  { iso: 'cr', name: 'Costa Rica', dial: '506', example: '8312 3456', min: 8, max: 8 },
  { iso: 'cl', name: 'Chile', dial: '56', example: '9 1234 5678', min: 9, max: 9 },
  { iso: 'ar', name: 'Argentina', dial: '54', example: '9 11 1234 5678', min: 10, max: 11 },
  { iso: 'br', name: 'Brasil', dial: '55', example: '11 91234 5678', min: 10, max: 11 },
  { iso: 'es', name: 'España', dial: '34', example: '612 345 678', min: 9, max: 9 },
  { iso: 'it', name: 'Italia', dial: '39', example: '312 345 6789', min: 9, max: 10 },
];

export const dialCountry = (iso?: string) => DIAL_COUNTRIES.find((c) => c.iso === iso) ?? DIAL_COUNTRIES[0];

/** Número nacional que escribió la persona, sin espacios, sin el 0 inicial ni el indicativo repetido */
function nationalDigits(country: DialCountry, phone: string): string {
  let d = phone.replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.length > country.max && d.startsWith(country.dial)) d = d.slice(country.dial.length);
  if (d.length > country.max && d.startsWith('0')) d = d.slice(1);
  return d;
}

/** ¿El número es válido para ese país? */
export function isValidPhoneFor(iso: string | undefined, phone: string): boolean {
  const c = dialCountry(iso);
  const n = nationalDigits(c, phone).replace(/^0/, '');
  if (c.iso === 'co') return /^3\d{9}$|^60\d{8}$/.test(n);
  return n.length >= c.min && n.length <= c.max;
}

/**
 * Cómo se guarda el celular: Colombia sin indicativo (10 dígitos, como siempre); los demás países
 * con «+» e indicativo («+584121234567») para reconocer el país y escribirles por WhatsApp.
 */
export function storedPhone(iso: string | undefined, phone: string): string {
  const c = dialCountry(iso);
  const n = nationalDigits(c, phone).replace(/^0/, '');
  return c.iso === 'co' ? n : `+${c.dial}${n}`;
}

/** Enlace de WhatsApp con el indicativo correcto (y un mensaje opcional) */
export function whatsappUrl(phone: string, text?: string): string {
  const { international } = phoneCountry(phone);
  return `https://wa.me/${international}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
}
