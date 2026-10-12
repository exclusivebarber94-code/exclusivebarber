import { useEffect, useRef } from 'react';
import { Star } from 'lucide-react';
import { testimonials } from '../../data';

export default function Testimonials() {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    let pos = 0;
    const speed = 0.5;
    let animId: number;

    const animate = () => {
      pos += speed;
      if (pos >= el.scrollWidth / 2) pos = 0;
      el.scrollLeft = pos;
      animId = requestAnimationFrame(animate);
    };

    animId = requestAnimationFrame(animate);
    const pause = () => cancelAnimationFrame(animId);
    const resume = () => { animId = requestAnimationFrame(animate); };

    el.addEventListener('mouseenter', pause);
    el.addEventListener('mouseleave', resume);

    return () => {
      cancelAnimationFrame(animId);
      el.removeEventListener('mouseenter', pause);
      el.removeEventListener('mouseleave', resume);
    };
  }, []);

  const doubled = [...testimonials, ...testimonials];

  return (
    <section className="py-24 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 mb-12 text-center">
        <p className="section-label mb-3">Testimonios</p>
        <h2 className="font-serif text-4xl sm:text-5xl font-bold text-white mb-4">
          Lo que dicen nuestros <span className="gold-text">clientes</span>
        </h2>

        <div className="inline-flex items-center gap-3 glass-gold px-5 py-3 rounded-full">
          <div className="flex">
            {[...Array(5)].map((_, i) => (
              <Star key={i} size={14} className="text-gold fill-gold" />
            ))}
          </div>
          <span className="text-white font-mono font-bold">4.9</span>
          <span className="text-zinc-400 text-sm">en Google Reviews</span>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-hidden cursor-grab select-none"
        style={{ scrollbarWidth: 'none' }}
      >
        {doubled.map((t, i) => (
          <div
            key={`${t.id}-${i}`}
            className="glass rounded-2xl p-6 border border-white/8 shrink-0 w-72 sm:w-80"
          >
            <div className="flex items-center gap-3 mb-4">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-dark shrink-0"
                style={{ background: 'linear-gradient(135deg, #D4AF37, #9C7B22)' }}
              >
                {t.avatar}
              </div>
              <div>
                <p className="text-white font-semibold text-sm">{t.name}</p>
                <p className="text-zinc-600 text-xs">{t.date}</p>
              </div>
            </div>

            <div className="flex gap-0.5 mb-3">
              {[...Array(t.rating)].map((_, i) => (
                <Star key={i} size={12} className="text-gold fill-gold" />
              ))}
            </div>

            <p className="text-zinc-400 text-sm leading-relaxed">{t.text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
