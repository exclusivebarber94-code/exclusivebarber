import { useEffect, useState, type ReactNode } from 'react';
import Navbar from './Navbar';
import Footer from './Footer';
import AnimatedBarberBackground from './AnimatedBarberBackground';
import WhatsAppChat from './WhatsAppChat';
import SocialFloat from './SocialFloat';
import BookingModal from '../booking/BookingModal';
import { getServices } from '../../services/services';
import type { Service } from '../../types';

interface Props {
  /** Recibe la función para abrir la reserva (opcionalmente con un servicio ya elegido). */
  children: (openBooking: (service?: Service) => void) => ReactNode;
}

/** Estructura común de las páginas públicas: menú, contenido, pie de página y ventana de reserva. */
export default function PublicLayout({ children }: Props) {
  const [bookingOpen, setBookingOpen] = useState(false);
  const [preselectedService, setPreselectedService] = useState<Service | null>(null);

  const openBooking = (service?: Service) => {
    setPreselectedService(service || null);
    setBookingOpen(true);
  };

  // Enlace directo a la reserva: /reservar o /reservar/<id del servicio> (lo usa el WhatsApp
  // «ya es hora de volver»). Se lee al cargar, antes de que la dirección vuelva a «/».
  const [deepLink] = useState(() => {
    const match = window.location.pathname.match(/^\/reservar(?:\/([\w-]+))?\/?$/);
    return match ? match[1] ?? '' : null;
  });
  useEffect(() => {
    if (deepLink === null) return;
    let cancelled = false;
    const find = deepLink ? getServices().then((list) => list.find((s) => s.id === deepLink)).catch(() => undefined) : Promise.resolve(undefined);
    find.then((service) => { if (!cancelled) openBooking(service); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deepLink]);

  return (
    <div className="min-h-screen bg-dark relative">
      <div className="grain-overlay" />
      <AnimatedBarberBackground />

      <Navbar onBooking={() => openBooking()} />

      <main className="relative z-10">{children(openBooking)}</main>

      <div className="relative z-10">
        <Footer />
      </div>

      <SocialFloat />
      <WhatsAppChat onBooking={() => openBooking()} />

      <BookingModal
        isOpen={bookingOpen}
        onClose={() => setBookingOpen(false)}
        preselectedService={preselectedService}
      />
    </div>
  );
}
