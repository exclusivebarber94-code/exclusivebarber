# Instrucciones para agentes de IA — Exclusive Barber

Web de reservas de la barbería **Exclusive Barber** (Valledupar, Colombia).
React 18 + Vite + TypeScript + Tailwind CSS. Datos en Supabase. Se publica en Vercel.
Todo el texto visible está en **español de Colombia**.

## Tu tarea: el diseño visual

Rediseñar la apariencia de la web a partir del logo (`public/logo_exclusivebarber.png`):
un sello redondo de barbería clásica, en blanco, con estrellas arriba, "Exclusive" en letra
cursiva y "BARBER" en letras con remate. La identidad actual es negro con dorado (`#D4AF37`),
tipografías Playfair Display (títulos), Inter (texto) y Space Grotesk (números).

Objetivos:
1. Que la web transmita la identidad vintage del logo, de forma elegante y premium.
2. **Reservar más fácil**: hoy son 4 pasos (Servicio → Barbero → Fecha y hora → Confirmar).
   La meta es 2 pantallas: (1) servicio + barbero opcional + día y hora; (2) nombre, celular y confirmar.
3. Diseñado primero para celular (la mayoría reserva desde el teléfono), sin scroll horizontal.
4. Accesible: contraste suficiente, botones de al menos 44 px de alto, foco visible con teclado.

## Dónde está el diseño (puedes cambiar estos archivos)

- `src/index.css`, `tailwind.config.js`, `index.html` (fuentes): colores, tipografía, estilos globales.
- `src/components/landing/*`: secciones de la página principal.
- `src/components/layout/*`: menú (`Navbar.tsx`), pie de página y `PublicLayout.tsx`.
- `src/components/booking/*`: la ventana de reserva (solo su presentación; ver reglas abajo).
- `src/components/common/BarberAvatar.tsx`: foto o iniciales del barbero.
- `src/pages/GalleryPage.tsx`, `src/pages/ShopPage.tsx`, `src/pages/Landing.tsx`.
- `src/pages/Admin/*` y `src/pages/Barber/*`: solo estilos; no cambies cómo cargan o guardan datos.

## Reglas que NO se pueden romper

Este proyecto acaba de pasar por correcciones de errores graves (citas perdidas, zona horaria,
seguridad). Para no deshacerlas:

- **No modifiques**: `src/services/`, `src/lib/`, `src/hooks/`, `src/types/`, `src/App.tsx`,
  `supabase/`, `scripts/`, `api/`, `.env`, `vercel.json`.
- **La reserva debe seguir guardándose con `createBooking()`** de `src/services/bookings.ts`
  y las horas libres deben seguir saliendo de `getBusySlots()`. No escribas en Supabase directamente.
  Si eliges "sin preferencia" de barbero, envía `barberId: ''`: el servidor asigna uno libre.
- **Fechas**: usa siempre las funciones de `src/lib/dates.ts` (`todayKey`, `addDays`, `formatDateLong`…).
  Nunca uses `new Date().toISOString()` para fechas: en Colombia después de las 7 p. m. da el día siguiente.
- **Errores**: no ocultes errores con `catch {}`. Muestra un mensaje útil y regístralo con `console.error`.
- Conserva los mensajes de error de `BookingModal.tsx` (`ERROR_MESSAGES`) y el botón de WhatsApp.
- No muestres ni pidas el PIN de los barberos fuera del teclado del portal del barbero.
- No pongas datos de clientes, teléfonos reales ni llaves en el código.
- Imágenes externas: solo URLs que funcionen; las fotos propias van en `public/`.

## Cómo correr el proyecto

Requiere Docker Desktop abierto.

```bash
npx supabase start      # base de datos local con datos de prueba
npm run dev             # http://localhost:5173
```

- Web: http://localhost:5173 · Galería: /galeria · Shop: /shop
- Panel: http://localhost:5173/admin — `admin@exclusivebarber.co` / `Admin12345` (solo local)
- Portal del barbero: http://localhost:5173/barber — PIN Guinyer `1111`, Orlando `2222` (solo local)

## Antes de terminar

```bash
npm run typecheck   # sin errores
npm run lint        # sin errores
```

Prueba en el navegador una reserva completa, con un barbero y con "sin preferencia",
en ancho de celular (390 px) y de computador. Trabaja en la rama `diseno` de git y haz
commits pequeños con mensajes en español que digan qué cambió.
