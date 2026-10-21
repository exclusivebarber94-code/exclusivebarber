import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { businessConfig } from '../../config/business';

// Mapa real e interactivo con OpenStreetMap (sin llave ni costo). Los mosaicos se oscurecen
// con un filtro CSS (ver .eb-map en index.css) para que combine con la web; el marcador no se afecta.
// La rueda del mouse no hace zoom hasta hacer clic, para no "atrapar" el scroll de la página.

const PIN_HTML = `
  <div class="eb-pin">
    <span class="eb-pin__pulse"></span>
    <div class="eb-pin__body"><img src="/logo_exclusivebarber.png" alt="" /></div>
    <span class="eb-pin__tip"></span>
  </div>`;

// En OpenStreetMap dos calles junto a la barbería tienen el nombre equivocado (la Calle 6C, que pasa
// enfrente, figura como «Calle 7», y la Carrera 16 como «Calle 6C»). Se dibujan encima con el nombre
// correcto (el mismo de Google Maps): una línea del color de la calle tapa la etiqueta vieja.
// Puntos tomados de OpenStreetMap (vías 85052332 y 85055972).
type StreetFix = { name: string; highlight?: boolean; path: [number, number][]; labels: [number, number][] };
const STREET_FIXES: StreetFix[] = [
  {
    name: 'Calle 6C',
    highlight: true,
    path: [
      [10.487121, -73.259268], [10.487056, -73.259305], [10.486177, -73.259837], [10.485539, -73.260243],
      [10.48504, -73.260548], [10.484655, -73.260789], [10.484067, -73.261157], [10.483757, -73.261351],
      [10.483479, -73.261526], [10.482683, -73.26205], [10.48263, -73.26208],
    ],
    labels: [[10.48512, -73.260505], [10.48302, -73.261827]],
  },
  {
    name: 'Carrera 16',
    path: [
      [10.483757, -73.261351], [10.48395, -73.261631], [10.483964, -73.261669], [10.483973, -73.261708], [10.483974, -73.261748],
      [10.48397, -73.261788], [10.483959, -73.261827], [10.483942, -73.261863], [10.483699, -73.262443],
    ],
    labels: [[10.48387, -73.26212]],
  },
];

/** Ángulo de la calle en pantalla (grados), para girar la etiqueta igual que la calle */
function streetAngle(map: L.Map, [a, b]: [number, number][]) {
  const p = map.project(a, 17);
  const q = map.project(b, 17);
  let deg = (Math.atan2(q.y - p.y, q.x - p.x) * 180) / Math.PI;
  if (deg > 90) deg -= 180;
  if (deg < -90) deg += 180;
  return deg;
}

function addStreetFixes(map: L.Map) {
  for (const street of STREET_FIXES) {
    L.polyline(street.path, { className: 'eb-street-base', weight: 11, opacity: 1, lineCap: 'round', interactive: false }).addTo(map);
    if (street.highlight) {
      L.polyline(street.path, { className: 'eb-street-glow', weight: 3, opacity: 1, lineCap: 'round', interactive: false }).addTo(map);
    }
    for (const at of street.labels) {
      // El tramo de la calle más cercano a la etiqueta da el ángulo
      let best = 0;
      street.path.forEach((pt, i) => {
        if (i > 0 && Math.hypot(pt[0] - at[0], pt[1] - at[1]) < Math.hypot(street.path[best][0] - at[0], street.path[best][1] - at[1])) best = i;
      });
      const seg: [number, number][] = [street.path[Math.max(0, best - 1)], street.path[Math.max(1, best)]];
      const icon = L.divIcon({
        className: '',
        iconSize: [0, 0],
        html: `<span class="eb-street-label${street.highlight ? ' eb-street-label--main' : ''}" style="--angle:${streetAngle(map, seg).toFixed(1)}deg">${street.name}</span>`,
      });
      L.marker(at, { icon, interactive: false, keyboard: false }).addTo(map);
    }
  }
}

export default function BarberMap() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const { lat, lng } = businessConfig.location;

    const map = L.map(containerRef.current, {
      center: [lat, lng],
      zoom: 17,
      scrollWheelZoom: false,
      zoomControl: false,
      attributionControl: true,
    });
    L.control.zoom({ position: 'topright' }).addTo(map);

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    addStreetFixes(map);

    const icon = L.divIcon({ html: PIN_HTML, className: '', iconSize: [56, 70], iconAnchor: [28, 70], popupAnchor: [0, -66] });
    L.marker([lat, lng], { icon, title: businessConfig.name, keyboard: true, zIndexOffset: 1000 })
      .addTo(map)
      .bindPopup(
        `<div class="eb-popup"><strong>${businessConfig.name}</strong><span>${businessConfig.address}</span></div>`,
        { closeButton: false },
      );

    const enableWheel = () => map.scrollWheelZoom.enable();
    const disableWheel = () => map.scrollWheelZoom.disable();
    map.on('click focus', enableWheel);
    map.on('mouseout blur', disableWheel);

    return () => {
      map.remove();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      role="region"
      aria-label={`Mapa de la ubicación de ${businessConfig.name}`}
      className="eb-map absolute inset-0"
    />
  );
}
