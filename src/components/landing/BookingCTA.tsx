import { ArrowRight } from 'lucide-react';
import { ClipperIcon } from '../common/BarberIcons';

interface BookingCTAProps {
  onBooking: () => void;
}

export default function BookingCTA({ onBooking }: BookingCTAProps) {
  return (
    <section className="py-20 relative overflow-hidden">
      <div
        className="absolute inset-0"
        style={{ background: 'linear-gradient(135deg, #1a1100 0%, #080808 50%, #0a0600 100%)' }}
      />
      <div
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage:
            'radial-gradient(circle at 20% 50%, rgba(212,175,55,0.15) 0%, transparent 50%), radial-gradient(circle at 80% 50%, rgba(107,76,43,0.1) 0%, transparent 50%)',
        }}
      />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 relative z-10">
        <div className="glass-gold rounded-3xl p-10 sm:p-16 text-center">
          <div className="w-16 h-16 rounded-full bg-gold/20 border border-gold/30 flex items-center justify-center mx-auto mb-6">
            <ClipperIcon size={30} className="text-gold" />
          </div>

          <h2 className="font-serif text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-4">
            ¿Listo para tu{' '}
            <span className="gold-shimmer">mejor versión</span>?
          </h2>

          <p className="text-zinc-400 text-lg max-w-2xl mx-auto mb-10">
            Reserva tu cita ahora y únete a los cientos de hombres que ya confían en
            Exclusive Barber para su imagen personal.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={onBooking}
              className="btn-gold px-10 py-4 rounded-full text-base font-semibold tracking-wide w-full sm:w-auto flex items-center justify-center gap-3"
            >
              <span className="flex items-center gap-2">
                Reservar mi cita
                <ArrowRight size={18} />
              </span>
            </button>
          </div>

          <p className="text-zinc-600 text-sm mt-6">
            Pago al llegar · Sin tarjeta requerida · Cancela con 2h de anticipación
          </p>
        </div>
      </div>
    </section>
  );
}
