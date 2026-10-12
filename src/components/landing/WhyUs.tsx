import { Zap, Wallet, Ticket } from 'lucide-react';

const features = [
  {
    icon: Zap,
    title: 'Reserva en 60 segundos',
    desc: 'Elige servicio, barbero y hora en una sola pantalla. Sin llamadas ni esperas, todo desde tu celular.',
    color: 'from-amber-500/20 to-transparent',
    border: 'border-amber-500/20',
  },
  {
    icon: Wallet,
    title: 'Pagas en la barbería',
    desc: 'No necesitas tarjeta para reservar. Pagas el servicio cuando llegas, sin cobros anticipados.',
    color: 'from-blue-500/20 to-transparent',
    border: 'border-blue-500/20',
  },
  {
    icon: Ticket,
    title: 'Ticket y confirmación',
    desc: 'Al reservar recibes tu ticket con el código de tu cita y la confirmación por WhatsApp.',
    color: 'from-green-500/20 to-transparent',
    border: 'border-green-500/20',
  },
];

export default function WhyUs() {
  return (
    <section className="py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-12">
          <p className="section-label mb-3">¿Por qué elegirnos?</p>
          <h2 className="font-serif text-4xl sm:text-5xl font-bold text-white">
            Diseñado para tu <span className="gold-text">comodidad</span>
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {features.map((f) => {
            const Icon = f.icon;
            return (
              <div
                key={f.title}
                className={`glass rounded-2xl p-7 border ${f.border} card-hover relative overflow-hidden group`}
              >
                <div
                  className={`absolute top-0 left-0 w-full h-full bg-gradient-to-br ${f.color} opacity-0 group-hover:opacity-100 transition-opacity duration-500`}
                />
                <div className="relative z-10">
                  <div className="w-12 h-12 rounded-xl glass border border-white/10 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                    <Icon size={22} className="text-gold" />
                  </div>
                  <h3 className="font-serif text-xl font-bold text-white mb-3">{f.title}</h3>
                  <p className="text-zinc-400 text-sm leading-relaxed">{f.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
