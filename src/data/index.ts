import type { Testimonial, GalleryItem } from '../types';

export const testimonials: Testimonial[] = [
  {
    id: 't1',
    name: 'Santiago Vargas',
    date: 'hace 2 días',
    rating: 5,
    text: 'El mejor corte que me han hecho en Valledupar. Juan es un artista, muy detallista y profesional. El ambiente del lugar es increíble.',
    avatar: 'SV',
  },
  {
    id: 't2',
    name: 'Mateo Restrepo',
    date: 'hace 1 semana',
    rating: 5,
    text: 'Carlos me salvó la barba. Llevaba meses sin un buen perfilado y él la dejó perfecta. 100% recomendado.',
    avatar: 'MR',
  },
  {
    id: 't3',
    name: 'Alejandro Pérez',
    date: 'hace 1 semana',
    rating: 5,
    text: 'El tratamiento de aminoácidos fue espectacular. Mi cabello quedó suavísimo. Andrés muy profesional y amable.',
    avatar: 'AP',
  },
  {
    id: 't4',
    name: 'Nicolás Ríos',
    date: 'hace 2 semanas',
    rating: 5,
    text: 'Reservar fue muy fácil y llegué a la hora exacta. Sin esperas. El corte quedó exactamente como quería. Volveré pronto.',
    avatar: 'NR',
  },
  {
    id: 't5',
    name: 'Daniel Moreno',
    date: 'hace 3 semanas',
    rating: 4,
    text: 'Excelente servicio y muy buen ambiente. Los barberos saben lo que hacen. El combo corte + barba es una pasada.',
    avatar: 'DM',
  },
  {
    id: 't6',
    name: 'Camilo Torres',
    date: 'hace 1 mes',
    rating: 5,
    text: 'Vine desde Bogotá y quedé impresionado. Nivel premium a precio justo. Ya tengo mi cita para cuando vuelva.',
    avatar: 'CT',
  },
];

export const galleryItems: GalleryItem[] = [
  {
    id: 'g1',
    url: 'https://images.pexels.com/photos/1805600/pexels-photo-1805600.jpeg?auto=compress&cs=tinysrgb&w=600',
    category: 'Cortes',
    alt: 'Corte clásico fade',
  },
  {
    id: 'g2',
    url: 'https://images.pexels.com/photos/3992872/pexels-photo-3992872.jpeg?auto=compress&cs=tinysrgb&w=600',
    category: 'Barba',
    alt: 'Perfilado de barba',
  },
  {
    id: 'g3',
    url: 'https://images.pexels.com/photos/1813272/pexels-photo-1813272.jpeg?auto=compress&cs=tinysrgb&w=600',
    category: 'Ambiente',
    alt: 'Interior barbería',
  },
  {
    id: 'g4',
    url: 'https://images.pexels.com/photos/2076596/pexels-photo-2076596.jpeg?auto=compress&cs=tinysrgb&w=600',
    category: 'Cortes',
    alt: 'Corte moderno',
  },
  {
    id: 'g5',
    url: 'https://images.pexels.com/photos/4349803/pexels-photo-4349803.jpeg?auto=compress&cs=tinysrgb&w=600',
    category: 'Barba',
    alt: 'Afeitado clásico',
  },
  {
    id: 'g6',
    url: 'https://images.pexels.com/photos/1570807/pexels-photo-1570807.jpeg?auto=compress&cs=tinysrgb&w=600',
    category: 'Tratamientos',
    alt: 'Tratamiento capilar',
  },
  {
    id: 'g7',
    url: 'https://images.pexels.com/photos/3998429/pexels-photo-3998429.jpeg?auto=compress&cs=tinysrgb&w=600',
    category: 'Ambiente',
    alt: 'Herramientas de barbería',
  },
  {
    id: 'g8',
    url: 'https://images.pexels.com/photos/3065209/pexels-photo-3065209.jpeg?auto=compress&cs=tinysrgb&w=600',
    category: 'Cortes',
    alt: 'Fade moderno',
  },
];

export const formatCOP = (amount: number): string => {
  return `$${amount.toLocaleString('es-CO').replace(',', '.')}`;
};
