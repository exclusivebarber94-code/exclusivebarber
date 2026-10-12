import { useState, useEffect } from 'react';
import { Clock, ChevronRight } from 'lucide-react';
import { CategoryIcon } from '../common/BarberIcons';
import { formatCOP } from '../../data';
import { getServices } from '../../services/services';
import type { Service } from '../../types';

type Category = 'todos' | Service['category'];

const categories: { id: Category; label: string }[] = [
  { id: 'todos', label: 'Todos' },
  { id: 'cortes', label: 'Cortes' },
  { id: 'barba', label: 'Barba' },
  { id: 'tratamientos', label: 'Tratamientos' },
  { id: 'depilacion', label: 'Depilación' },
  { id: 'masajes', label: 'Masajes' },
  { id: 'cejas', label: 'Cejas' },
  { id: 'manicura', label: 'Manicura' },
];

const categoryColors: Record<string, string> = {
  cortes: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  barba: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  tratamientos: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  depilacion: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
  masajes: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
  cejas: 'bg-violet-500/15 text-violet-400 border-violet-500/30',
  manicura: 'bg-pink-500/15 text-pink-400 border-pink-500/30',
};

interface ServicesProps {
  onBooking: (service?: Service) => void;
}

export default function Services({ onBooking }: ServicesProps) {
  const [activeCategory, setActiveCategory] = useState<Category>('todos');
  const [services, setServices] = useState<Service[]>([]);

  useEffect(() => {
    getServices()
      .then(setServices)
      .catch((err) => console.error('No se pudieron cargar los servicios', err));
  }, []);

  const filtered = activeCategory === 'todos'
    ? services
    : services.filter((s) => s.category === activeCategory);

  return (
    <section id="servicios" className="py-24 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-14">
          <p className="section-label mb-3">Nuestros servicios</p>
          <h2 className="font-serif text-4xl sm:text-5xl font-bold text-white mb-4">
            Experiencia <span className="gold-text">Premium</span>
          </h2>
          <p className="text-zinc-400 text-lg max-w-2xl mx-auto">
            Cada servicio es un ritual de cuidado masculino ejecutado con precisión y pasión.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2 mb-10">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`px-5 py-2 rounded-full text-sm font-medium transition-all duration-200 relative ${
                activeCategory === cat.id
                  ? 'bg-gold text-dark shadow-gold'
                  : 'glass text-zinc-400 hover:text-white hover:border-white/20 border border-white/10'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {filtered.map((service) => (
            <div
              key={service.id}
              className="glass rounded-2xl p-6 card-hover cursor-pointer border border-white/8 group relative overflow-hidden"
            >
              {service.popular && (
                <div className="absolute top-3 right-3 bg-gold/90 text-dark text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Popular
                </div>
              )}

              <div className="flex items-center gap-2 mb-4">
                <span
                  className={`text-xs font-medium px-2.5 py-1 rounded-full border capitalize ${
                    categoryColors[service.category] || 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30'
                  }`}
                >
                  {categories.find((c) => c.id === service.category)?.label ?? service.category}
                </span>
                <span className="flex items-center gap-1 text-zinc-600 text-xs">
                  <Clock size={11} />
                  {service.duration} min
                </span>
              </div>

              <div className="mb-2 flex items-start gap-2">
                <CategoryIcon category={service.category} size={18} className="text-gold mt-0.5 shrink-0" />
                <h3 className="font-semibold text-white text-base leading-snug group-hover:text-gold transition-colors">
                  {service.name}
                </h3>
              </div>

              <p className="text-zinc-500 text-sm mb-5 leading-relaxed line-clamp-2">
                {service.description}
              </p>

              <div className="flex items-center justify-between">
                <span className="font-mono text-xl font-bold gold-text">
                  {formatCOP(service.price)}
                </span>
                <button
                  onClick={() => onBooking(service)}
                  className="flex items-center gap-1 text-xs font-semibold text-dark bg-gold hover:bg-gold-100 px-3.5 py-2 rounded-full transition-all hover:scale-105 hover:shadow-gold"
                >
                  Reservar
                  <ChevronRight size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
