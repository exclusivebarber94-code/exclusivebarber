import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { DIAL_COUNTRIES, dialCountry } from '../../lib/phoneCountry';

// Botón con la bandera y el indicativo (🇨🇴 +57) que abre la lista de países.
// Las banderas son imágenes: en Windows los emojis de banderas salen como letras.

const flag = (iso: string) => `https://flagcdn.com/w40/${iso}.png`;

export default function CountryCodePicker({ value, onChange }: { value?: string; onChange: (iso: string) => void }) {
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const current = dialCountry(value);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!boxRef.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', onKey); };
  }, [open]);

  return (
    <div className="relative shrink-0" ref={boxRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`País del celular: ${current.name} (+${current.dial})`}
        className="h-full flex items-center gap-1.5 px-3 py-3.5 rounded-xl bg-white/[0.04] border border-white/10 text-white text-base hover:border-gold/50 focus:outline-none focus:border-gold/60 transition-colors"
      >
        <img src={flag(current.iso)} alt="" className="w-6 h-4 rounded-[3px] object-cover ring-1 ring-white/15" />
        <span className="font-mono text-sm">+{current.dial}</span>
        <ChevronDown size={14} className={`text-zinc-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <ul
          role="listbox"
          aria-label="Elegir país"
          className="absolute left-0 bottom-full mb-2 z-50 w-64 max-h-72 overflow-y-auto rounded-2xl border border-gold/25 bg-[#141414] shadow-2xl p-1.5"
        >
          {DIAL_COUNTRIES.map((c) => {
            const selected = c.iso === current.iso;
            return (
              <li key={c.iso}>
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => { onChange(c.iso); setOpen(false); }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-sm transition-colors ${selected ? 'bg-gold/15 text-gold' : 'text-zinc-200 hover:bg-white/5'}`}
                >
                  <img src={flag(c.iso)} alt="" loading="lazy" className="w-6 h-4 rounded-[3px] object-cover ring-1 ring-white/15 shrink-0" />
                  <span className="flex-1 truncate">{c.name}</span>
                  <span className="font-mono text-xs text-zinc-400">+{c.dial}</span>
                  {selected && <Check size={14} className="shrink-0" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
