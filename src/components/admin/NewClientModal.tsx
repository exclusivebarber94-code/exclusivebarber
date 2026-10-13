import { useEffect, useState } from 'react';
import { X, UserPlus, Loader2, Minus, Plus, Clock } from 'lucide-react';
import { getServices } from '../../services/services';
import { getBarbers } from '../../services/barbers';
import { createManualBookings } from '../../services/bookings';
import { formatCOP } from '../../data';
import { todayKey, nowMinutes, minutesToTime, timeToMinutes } from '../../lib/dates';
import { isValidName, isValidPhone } from '../../lib/clientContact';
import { MAX_CART_UNITS, roleFor, cartRole, cartUnits, changeQty, type CartItem } from '../../lib/bookingCart';
import type { Service, Barber, Booking } from '../../types';

// Registro de un cliente atendido en la barbería (por ejemplo fuera del horario de la web):
// sus servicios quedan como citas y entran a la contabilidad y a la lista de clientes.

interface Props {
  onClose: () => void;
  onSaved: (count: number, clientName: string) => void;
}

const inputClass = 'w-full px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-white placeholder-zinc-600 text-sm focus:outline-none focus:border-gold/60 transition-colors';
const labelClass = 'text-zinc-400 text-xs mb-1.5 block';

/** Hora actual redondeada a 5 minutos */
const nowRounded = () => minutesToTime(Math.floor(nowMinutes() / 5) * 5);

export default function NewClientModal({ onClose, onSaved }: Props) {
  const [services, setServices] = useState<Service[]>([]);
  const [team, setTeam] = useState<Barber[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [items, setItems] = useState<CartItem[]>([]);
  // Precio cobrado por unidad de cada servicio (por si se cobró distinto, p. ej. recargo fuera del horario)
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [barberId, setBarberId] = useState('');
  const [date, setDate] = useState(todayKey());
  const [time, setTime] = useState(nowRounded());
  const [status, setStatus] = useState<Booking['status']>('completed');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([getServices(), getBarbers()])
      .then(([s, b]) => { setServices(s); setTeam(b); })
      .catch((err) => {
        console.error('No se pudieron cargar servicios y equipo', err);
        setError('No se pudieron cargar los servicios. Cierra y vuelve a intentar.');
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !saving) onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [saving, onClose]);

  const role = cartRole(items) ?? 'barbero';
  // Se muestra todo el equipo de ese rol, incluso quien está «no disponible» para la web
  const staff = team.filter((b) => b.role === role);
  const barber = staff.find((b) => b.id === barberId) ?? (staff.length === 1 ? staff[0] : undefined);

  const unitPrice = (s: Service) => {
    const raw = prices[s.id];
    if (raw === undefined) return s.price;
    const n = Number(raw.replace(/\D/g, ''));
    return Number.isFinite(n) ? n : 0;
  };
  const total = items.reduce((sum, i) => sum + i.qty * unitPrice(i.service), 0);
  const units = cartUnits(items);
  const minutes = items.reduce((sum, i) => sum + i.qty * i.service.duration, 0);

  const change = (service: Service, delta: number) => {
    const next = changeQty(items, service, delta);
    setItems(next);
    if (barber && barber.role !== (cartRole(next) ?? 'barbero')) setBarberId('');
    setError('');
  };

  const nameOk = isValidName(name);
  const phoneOk = phone.trim() === '' || isValidPhone(phone);
  const ready = nameOk && phoneOk && units > 0 && !!barber && !!date && /^\d\d:\d\d$/.test(time) && !saving;

  const save = async () => {
    if (!ready || !barber) return;
    setSaving(true);
    setError('');
    try {
      // Cada servicio queda como una cita, uno detrás de otro desde la hora indicada
      let start = timeToMinutes(time);
      const lines = items.flatMap(({ service, qty }) =>
        Array.from({ length: qty }, () => {
          const line = { serviceId: service.id, serviceName: service.name, time: minutesToTime(start % (24 * 60)), price: unitPrice(service) };
          start += service.duration;
          return line;
        }),
      );
      await createManualBookings({
        clientName: name,
        clientPhone: phone,
        barberId: barber.id,
        barberName: barber.shortName,
        date,
        status,
        lines,
      });
      onSaved(lines.length, name.trim());
    } catch (err) {
      console.error('No se pudo registrar el cliente', err);
      const duplicated = (err as { code?: string })?.code === '23505';
      setError(duplicated
        ? `${barber.shortName} ya tiene una cita pendiente a esa hora. Cambia la hora o márcalo como «Ya se atendió».`
        : 'No se pudo guardar. Revisa tu conexión e intenta de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4" role="dialog" aria-modal="true" aria-label="Registrar cliente nuevo">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => !saving && onClose()} />
      <div className="relative w-full sm:max-w-2xl glass border border-white/10 rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[94vh]">
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-white/8">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gold/15 border border-gold/20 flex items-center justify-center">
              <UserPlus size={15} className="text-gold" />
            </div>
            <div>
              <h2 className="font-semibold text-white">Cliente nuevo</h2>
              <p className="text-zinc-500 text-xs">Para clientes atendidos en la barbería o fuera del horario</p>
            </div>
          </div>
          <button onClick={onClose} disabled={saving} aria-label="Cerrar" className="w-8 h-8 rounded-lg glass border border-white/10 flex items-center justify-center text-zinc-400 hover:text-white transition-colors">
            <X size={14} />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-5 sm:px-6 py-5 space-y-6">
          {error && <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>}

          <section className="grid sm:grid-cols-2 gap-3">
            <label className="block">
              <span className={labelClass}>Nombre del cliente</span>
              <input id="manual-name" className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Carlos Martínez" autoComplete="off" />
            </label>
            <label className="block">
              <span className={labelClass}>Celular (para la lista de clientes)</span>
              <input id="manual-phone" className={inputClass} type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="300 123 4567" autoComplete="off" />
              {!phoneOk && <span className="text-amber-400 text-[11px] mt-1 block">Escribe 10 dígitos o déjalo vacío.</span>}
            </label>
          </section>

          <section>
            <p className="text-white text-sm font-semibold mb-2.5">Servicios</p>
            {loading ? (
              <div className="flex justify-center py-6"><Loader2 size={20} className="animate-spin text-gold" /></div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-2">
                {services.map((service) => {
                  const qty = items.find((i) => i.service.id === service.id)?.qty ?? 0;
                  const otherRole = items.length > 0 && roleFor(service) !== role;
                  return (
                    <div
                      key={service.id}
                      className={`flex items-center gap-2 p-2.5 rounded-xl border transition-all ${qty ? 'border-gold bg-gold/10' : 'border-white/10 bg-white/[0.03]'} ${otherRole ? 'opacity-40' : ''}`}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-medium truncate">{service.name}</p>
                        <p className="text-zinc-500 text-[11px] flex items-center gap-1"><Clock size={10} />{service.duration} min · {formatCOP(service.price)}</p>
                      </div>
                      <button type="button" onClick={() => change(service, -1)} disabled={!qty} aria-label={`Quitar un ${service.name}`} className="w-7 h-7 rounded-full border border-white/15 text-zinc-300 flex items-center justify-center hover:text-gold disabled:opacity-30">
                        <Minus size={13} />
                      </button>
                      <span className={`w-5 text-center font-mono font-bold ${qty ? 'text-gold' : 'text-zinc-600'}`}>{qty}</span>
                      <button type="button" onClick={() => change(service, 1)} disabled={otherRole || units >= MAX_CART_UNITS} aria-label={`Agregar un ${service.name}`} className="w-7 h-7 rounded-full border border-gold/40 text-gold flex items-center justify-center hover:bg-gold/15 disabled:opacity-30">
                        <Plus size={13} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {items.length > 0 && (
            <section className="rounded-2xl border border-gold/25 bg-gold/[0.05] p-4">
              <p className="text-zinc-400 text-xs mb-2">Valor cobrado por cada uno (cámbialo si se cobró distinto)</p>
              <ul className="space-y-2">
                {items.map(({ service, qty }) => (
                  <li key={service.id} className="flex items-center gap-2 text-sm">
                    <span className="font-mono font-bold text-gold w-8 shrink-0">{qty} ×</span>
                    <span className="flex-1 min-w-0 text-white truncate">{service.name}</span>
                    <span className="relative w-28 shrink-0">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500 text-xs">$</span>
                      <input
                        inputMode="numeric"
                        aria-label={`Valor cobrado por ${service.name}`}
                        value={prices[service.id] ?? String(service.price)}
                        onChange={(e) => setPrices({ ...prices, [service.id]: e.target.value.replace(/\D/g, '') })}
                        className="w-full pl-6 pr-2 py-1.5 rounded-lg bg-black/30 border border-white/10 text-right font-mono text-sm text-white focus:outline-none focus:border-gold/60"
                      />
                    </span>
                  </li>
                ))}
              </ul>
              <div className="border-t border-white/10 mt-3 pt-3 flex items-end justify-between">
                <span className="text-zinc-400 text-xs">{units} {units === 1 ? 'servicio' : 'servicios'} · {minutes} min</span>
                <span className="text-right">
                  <span className="block text-zinc-500 text-[11px] uppercase tracking-wider">Total</span>
                  <span className="font-mono text-xl font-bold gold-text">{formatCOP(total)}</span>
                </span>
              </div>
            </section>
          )}

          <section className="grid sm:grid-cols-3 gap-3">
            <label className="block">
              <span className={labelClass}>{role === 'manicurista' ? 'Manicurista' : 'Barbero'} que atendió</span>
              <select id="manual-barber" className={`${inputClass} appearance-none`} value={barber?.id ?? ''} onChange={(e) => setBarberId(e.target.value)}>
                <option value="" className="bg-[#181818]">Elegir…</option>
                {staff.map((b) => <option key={b.id} value={b.id} className="bg-[#181818]">{b.name}</option>)}
              </select>
            </label>
            <label className="block">
              <span className={labelClass}>Fecha</span>
              <input id="manual-date" type="date" className={`${inputClass} [color-scheme:dark]`} value={date} onChange={(e) => setDate(e.target.value)} />
            </label>
            <label className="block">
              <span className={labelClass}>Hora en que empezó</span>
              <input id="manual-time" type="time" className={`${inputClass} [color-scheme:dark]`} value={time} onChange={(e) => setTime(e.target.value)} />
            </label>
          </section>

          <section>
            <p className={labelClass}>Estado</p>
            <div className="grid sm:grid-cols-2 gap-2">
              {([
                ['completed', 'Ya se atendió', 'Entra de una vez a la contabilidad'],
                ['confirmed', 'Queda agendado', 'Se cuenta cuando lo marques como completado'],
              ] as const).map(([value, label, hint]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setStatus(value)}
                  aria-pressed={status === value}
                  className={`text-left p-3 rounded-xl border transition-all ${status === value ? 'border-gold bg-gold/10' : 'border-white/10 bg-white/[0.03] hover:border-gold/40'}`}
                >
                  <span className={`block text-sm font-semibold ${status === value ? 'text-gold' : 'text-white'}`}>{label}</span>
                  <span className="block text-[11px] text-zinc-500">{hint}</span>
                </button>
              ))}
            </div>
          </section>
        </div>

        <div className="border-t border-white/10 px-5 sm:px-6 py-4">
          <button
            type="button"
            onClick={save}
            disabled={!ready}
            className="w-full btn-gold py-3 rounded-full font-semibold disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {saving ? <><Loader2 size={17} className="animate-spin" /><span>Guardando...</span></> : (
              <span>
                {!nameOk ? 'Escribe el nombre del cliente' : units === 0 ? 'Agrega al menos un servicio' : !barber ? 'Elige quién lo atendió' : `Registrar · ${formatCOP(total)}`}
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
