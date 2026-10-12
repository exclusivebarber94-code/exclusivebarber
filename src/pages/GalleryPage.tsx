import PublicLayout from '../components/layout/PublicLayout';
import { usePageMeta } from '../hooks/usePageMeta';
import Gallery from '../components/landing/Gallery';
import BookingCTA from '../components/landing/BookingCTA';

export default function GalleryPage() {
  usePageMeta({
    title: 'Galería de cortes y barbas | Exclusive Barber Valledupar',
    description: 'Mira nuestros trabajos: fades, cortes modernos y clásicos, perfilado de barba y más en Exclusive Barber, Valledupar.',
  });
  return (
    <PublicLayout>
      {(openBooking) => (
        <div className="pt-20">
          <Gallery />
          <BookingCTA onBooking={() => openBooking()} />
        </div>
      )}
    </PublicLayout>
  );
}
