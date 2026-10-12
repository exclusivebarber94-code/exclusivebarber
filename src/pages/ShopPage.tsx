import PublicLayout from '../components/layout/PublicLayout';
import { usePageMeta } from '../hooks/usePageMeta';
import Products from '../components/landing/Products';

export default function ShopPage() {
  usePageMeta({
    title: 'Shop: productos para cabello y barba | Exclusive Barber Valledupar',
    description: 'Pomadas, aceites para barba y productos de cuidado capilar. Pídelos por WhatsApp y recógelos en Exclusive Barber, Valledupar.',
  });
  return (
    <PublicLayout>
      {() => (
        <div className="pt-20">
          <Products />
        </div>
      )}
    </PublicLayout>
  );
}
