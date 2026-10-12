import { Instagram, Facebook, Heart } from 'lucide-react';
import { businessConfig } from '../../config/business';
import { socialUrl } from '../../lib/social';

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-white/8 pt-16 pb-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 mb-12">
          <div className="lg:col-span-2">
            <div className="flex items-center mb-4">
              <img
                src="/logo_exclusivebarber.png"
                alt="Exclusive Barber"
                className="w-14 h-14 object-contain drop-shadow-[0_0_12px_rgba(212,175,55,0.35)]"
              />
            </div>
            <p className="text-zinc-400 text-sm leading-relaxed max-w-xs mb-5">
              {businessConfig.tagline}. Barbería premium en {businessConfig.city}, Colombia.
              Donde el estilo masculino se convierte en arte.
            </p>
            <div className="flex gap-3">
              <a
                href={socialUrl('instagram')}
                className="w-9 h-9 glass rounded-full flex items-center justify-center text-zinc-400 hover:text-pink-400 hover:border-pink-400/40 border border-white/10 transition-all hover:scale-110"
              >
                <Instagram size={15} />
              </a>
              <a
                href={socialUrl('facebook')}
                className="w-9 h-9 glass rounded-full flex items-center justify-center text-zinc-400 hover:text-blue-400 hover:border-blue-400/40 border border-white/10 transition-all hover:scale-110"
              >
                <Facebook size={15} />
              </a>
            </div>
          </div>

          <div>
            <h4 className="font-semibold text-white text-sm uppercase tracking-wider mb-4">Servicios</h4>
            <ul className="space-y-2.5">
              {['Corte Clásico', 'Corte + Barba', 'Perfilado de Barba', 'Tratamientos', 'Masaje Capilar'].map((s) => (
                <li key={s}>
                  <a href="/#servicios" className="text-zinc-400 text-sm hover:text-gold transition-colors">
                    {s}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-white text-sm uppercase tracking-wider mb-4">Empresa</h4>
            <ul className="space-y-2.5">
              {[
                { label: 'Inicio', href: '/#inicio' },
                { label: 'Equipo', href: '/#equipo' },
                { label: 'Galería', href: '/galeria' },
                { label: 'Shop', href: '/shop' },
                { label: 'Contacto', href: '/#contacto' },
              ].map((l) => (
                <li key={l.href}>
                  <a href={l.href} className="text-zinc-400 text-sm hover:text-gold transition-colors">
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="border-t border-white/8 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-zinc-600 text-xs flex items-center gap-1">
            Desarrollado con <Heart size={12} className="text-red-500 fill-red-500" /> en Colombia — {year}
          </p>
          <div className="flex items-center gap-4">
            <a href="#" className="text-zinc-600 text-xs hover:text-zinc-400 transition-colors">
              Política de privacidad
            </a>
            <a href="#" className="text-zinc-600 text-xs hover:text-zinc-400 transition-colors">
              Términos de uso
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
