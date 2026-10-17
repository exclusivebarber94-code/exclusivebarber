import { Globe } from 'lucide-react';
import { phoneCountry } from '../../lib/phoneCountry';

// Bandera del país de un número (imagen de flagcdn.com: en Windows los emojis de banderas salen como letras).
export default function PhoneFlag({ phone, className = 'w-5 h-[15px]' }: { phone: string; className?: string }) {
  const c = phoneCountry(phone);
  if (!c.iso) {
    return <Globe size={14} className="text-zinc-500 shrink-0" aria-label={c.name} />;
  }
  return (
    <img
      src={`https://flagcdn.com/w40/${c.iso}.png`}
      alt={c.name}
      title={`${c.name} (+${c.dial})`}
      loading="lazy"
      className={`${className} shrink-0 rounded-[3px] object-cover ring-1 ring-white/15`}
    />
  );
}
