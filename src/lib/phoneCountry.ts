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

/** Enlace de WhatsApp con el indicativo correcto (y un mensaje opcional) */
export function whatsappUrl(phone: string, text?: string): string {
  const { international } = phoneCountry(phone);
  return `https://wa.me/${international}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
}
