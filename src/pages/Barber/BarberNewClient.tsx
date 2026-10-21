import { useEffect, useMemo, useState } from 'react';
import { X, UserPlus, Loader2, Minus, Plus, Clock, CheckCircle2, CalendarPlus, AlertTriangle } from 'lucide-react';
import { getServices } from '../../services/services';
import { barberCreateBookings, type BarberBookingError } from '../../services/barberPortal';
import { formatCOP } from '../../data';
import { todayKey, addDays, nowMinutes, minutesToTime, timeToMinutes, formatDateLong, dayShort, dayOfMonth, monthShort } from '../../lib/dates';
import { hoursFor, lunchFor } from '../../lib/businessHours';
import { isValidName } from '../../lib/clientContact';
import { dialCountry, isValidPhoneFor, storedPhone } from '../../lib/phoneCountry';
import { MAX_CART_UNITS, roleFor, cartUnits, changeQty, type CartItem } from '../../lib/bookingCart';
import { CategoryIcon } from '../../components/common/BarberIcons';
import CountryCodePicker from '../../components/common/CountryCodePicker';
import type { Barber, Booking, Service } from '../../types';

// «Cliente nuevo» del portal del barbero: el mismo menú del botón del administrador, pero siempre
// a nombre del barbero que entró y con los precios del catálogo. Sirve para registrar a alguien
// que ya atendió (hoy, ahora) o para agendarle una cita con fecha y hora, incluso fuera del horario.
// El servidor (barber_create_bookings) valida el PIN y que la hora no choque con otra cita.

interface Props {
  barber: Barber;
  pin: string;
  /** Sus citas (para mostrar la agenda del día y avisar si la hora choca) */
  appts: Booking[];
  onClose: () => void;
  onSaved: (message: string) => void;
  onAuthError: () => void;
}

type Mode = 'ahora' | 'agendar';

const DAYS_SHOWN = 14;
const MAX_DAYS = 60;
const STEP = 15;

const ERRORS: Record<BarberBookingError, string> = {
  INVALID_PIN: 'Tu sesión venció. Vuelve a entrar con tu PIN.',
  PIN_LOCKED: 'Tu sesión venció. Vuelve a entrar con tu PIN.',
  INVALID_NAME: 'Revisa el nombre del cliente.',
  INVALID_PHONE: 'Revisa el celular del cliente.',
  NO_SERVICES: 'Elige al menos un servicio.',
  TOO_MANY_SERVICES: `Máximo ${MAX_CART_UNITS} servicios por cliente.`,
  SERVICE_NOT_FOUND: 'Uno de los servicios ya no está disponible. Cierra y vuelve a abrir.',
  WRONG_PROFESSIONAL: 'Ese servicio no lo atiende tu rol.',
  INVALID_TIME: 'Revisa la hora: los servicios deben terminar antes de la medianoche.',
  PAST_TIME: 'Esa hora ya pasó. Elige una hora futura o usa «Ya lo atendí».',
  TOO_FAR: `Solo se puede agendar hasta ${MAX_DAYS} días adelante.`,
  SLOT_TAKEN: 'Esa hora choca con otra cita tuya.',
};

const inputClass = 'w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/10 text-white placeholder-zinc-600 text-sm focus:outline-none focus:border-gold/60 transition-colors';

function SectionTitle({ number, children, hint }: { number: number; children: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 mb-3">
      <h4 className="flex items-center gap-2.5 text-sm font-semibold text-white">
        <span className="w-6 h-6 rounded-full bg-gold/15 border border-gold/40 text-gold text-xs font-bold flex items-center justify-center">{number}</span>
        {children}
      </h4>
      {hint && <span className="text-[11px] text-zinc-500 text-right">{hint}</span>}
    </div>
  );
}

export default function BarberNewClient({ barber, pin, appts, onClose, onSaved, onAuthError }: Props) {
  const today = todayKey();
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<CartItem[]>([]);
  const [mode, setMode] = useState<Mode>('agendar');
  const [date, setDate] = useState(today);
  const [time, setTime] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [country, setCountry] = useState('co');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    getServices()
      .then((list) => setServices(list.filter((s) => roleFor(s) === barber.role).sort((x, y) => Number(!!y.popular) - Number(!!x.popular))))
      .catch((err) => {
        console.error('No se pudieron cargar los servicios', err);
        setError('No se pudieron cargar los servicios. Cierra y vuelve a intentar.');
      })
      .finally(() => setLoading(false));
  }, [barber.role]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const hasItems = items.length > 0;
  const units = cartUnits(items);
  const minutes = items.reduce((sum, i) => sum + i.qty * i.service.duration, 0);
  const total = items.reduce((sum, i) => sum + i.qty * i.service.price, 0);
  const durationOf = useMemo(() => new Map(services.map((s) => [s.id, s.duration])), [services]);

  // Sus citas activas de ese día, para mostrarlas y para no chocar
  const dayAppts = useMemo(
    () => appts
      .filter((b) => b.date === date && (b.status === 'pending' || b.status === 'confirmed'))
      .sort((a, b) => a.time.localeCompare(b.time)),
    [appts, date],
  );
  const busy = dayAppts.map((b) => {
    const start = timeToMinutes(b.time);
    return { start, end: start + (durationOf.get(b.serviceId) ?? 30), b };
  });
  const clashAt = (start: number) => busy.find((x) => x.start < start + Math.max(minutes, 1) && x.end > start);

  // Horas sugeridas: dentro del horario del negocio, sin almuerzo, sin chocar y sin haber pasado
  const suggestions = useMemo(() => {
    const hours = hoursFor(date);
    if (!hours || !minutes) return [];
    const lunch = lunchFor(date);
    const out: string[] = [];
    for (let t = hours.open; t + minutes <= hours.close; t += STEP) {
      if (date === today && t < nowMinutes()) continue;
      if (lunch && t < lunch.end && t + minutes > lunch.start) continue;
      if (clashAt(t)) continue;
      out.push(minutesToTime(t));
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, minutes, dayAppts, durationOf, today]);

  const startMin = mode === 'ahora' ? Math.floor(nowMinutes() / 5) * 5 : time ? timeToMinutes(time) : null;
  const clash = mode === 'agendar' && startMin !== null && minutes ? clashAt(startMin) : undefined;
  const past = mode === 'agendar' && startMin !== null && date === today && startMin < nowMinutes() - 5;
  const endTime = startMin !== null && minutes ? minutesToTime((startMin + minutes) % (24 * 60)) : '';
  const hours = hoursFor(date);
  const outsideHours = mode === 'agendar' && startMin !== null && minutes > 0 && (!hours || startMin < hours.open || startMin + minutes > hours.close);

  const dialInfo = dialCountry(country);
  const nameOk = isValidName(name);
  const phoneOk = phone.trim() === '' || isValidPhoneFor(country, phone);
  const whenOk = mode === 'ahora' || (!!time && !clash && !past);
  const ready = hasItems && whenOk && nameOk && phoneOk && !saving;

  const change = (service: Service, delta: number) => {
    setItems(changeQty(items, service, delta));
    setError('');
  };

  const save = async () => {
    if (!ready || startMin === null) return;
    setSaving(true);
    setError('');
    try {
      const result = await barberCreateBookings({
        barberId: barber.id,
        pin,
        clientName: name.trim(),
        clientPhone: phone.trim() ? storedPhone(country, phone) : '',
        date: mode === 'ahora' ? today : date,
        start: minutesToTime(startMin),
        serviceIds: items.flatMap(({ service, qty }) => Array.from({ length: qty }, () => service.id)),
        completed: mode === 'ahora',
      });
      if ('error' in result && result.error) {
        if (result.error === 'INVALID_PIN' || result.error === 'PIN_LOCKED') return onAuthError();
        setError(result.error === 'SLOT_TAKEN' && result.time ? `${ERRORS.SLOT_TAKEN} (la de las ${result.time}).` : ERRORS[result.error] ?? 'No se pudo guardar.');
        return;
      }
      const who = name.trim().split(' ')[0];
      onSaved(mode === 'ahora'
        ? `Listo: ${who} quedó registrado como atendido hoy (${units} ${units === 1 ? 'servicio' : 'servicios'}, ${formatCOP(total)}).`
        : `Listo: cita de ${who} agendada para el ${formatDateLong(date).toLowerCase()} de ${minutesToTime(startMin)} a ${endTime}.${phone.trim() ? ' Le llegará la confirmación por WhatsApp.' : ''}`);
    } catch (err) {
      console.error('No se pudo registrar el cliente', err);
      setError('No se pudo guardar. Revisa tu conexión e intenta de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  const buttonLabel = !hasItems ? 'Elige uno o varios servicios'
    : mode === 'agendar' && !time ? 'Elige la hora'
    : clash ? 'Esa hora choca con otra cita'
    : past ? 'Esa hora ya pasó'
    : !nameOk ? 'Escribe el nombre del cliente'
    : !phoneOk ? 'Revisa el celular'
    : mode === 'ahora' ? `Registrar atendido · ${formatCOP(total)}`
    : `Agendar ${date === today ? 'hoy' : dayShort(date).toLowerCase() + ' ' + dayOfMonth(date)} a las ${time} · ${formatCOP(total)}`;

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center" role="dialog" aria-modal="true" aria-label="Cliente nuevo">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md" />
      <div className="relative w-full sm:max-w-2xl bg-[#0d0d0d] border border-white/10 rounded-t-3xl sm:rounded-3xl overflow-hidden h-[94vh] sm:h-[min(92vh,860px)] flex flex-col">
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gold/15 border border-gold/25 flex items-center justify-center">
              <UserPlus size={16} className="text-gold" />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-gold">A tu nombre · {barber.shortName}</p>
              <h2 className="font-serif text-xl font-bold text-white">Cliente nuevo</h2>
            </div>
          </div>
          <button onClick={onClose} disabled={saving} aria-label="Cerrar" className="w-9 h-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-zinc-400 hover:text-white transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-5 sm:px-6 py-5 space-y-7">
          {error && <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>}

          <section>
            <SectionTitle number={1} hint="Puedes elegir varios y la cantidad de cada uno">¿Qué servicio?</SectionTitle>
            {loading ? (
              <div className="flex justify-center py-8"><Loader2 size={22} className="animate-spin text-gold" /></div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-2">
                {services.map((service) => {
                  const qty = items.find((i) => i.service.id === service.id)?.qty ?? 0;
                  const selected = qty > 0;
                  const full = units >= MAX_CART_UNITS;
                  return (
                    <div key={service.id} className={`rounded-xl border transition-all ${selected ? 'border-gold bg-gold/10 shadow-gold' : 'border-white/10 bg-white/[0.03] hover:border-gold/40'}`}>
                      <button
                        type="button"
                        onClick={() => change(service, 1)}
                        disabled={full && !selected}
                        aria-label={`Agregar ${service.name}`}
                        className="w-full text-left p-3.5 pb-2 disabled:cursor-not-allowed"
                      >
                        <span className="flex items-start gap-2 text-white text-sm font-medium leading-snug">
                          <CategoryIcon category={service.category} size={17} className={`shrink-0 mt-px ${selected ? 'text-gold' : 'text-gold/70'}`} />
                          {service.name}
                        </span>
                        <span className="flex items-center justify-between mt-1.5">
                          <span className="flex items-center gap-1 text-zinc-500 text-xs"><Clock size={11} />{service.duration} min</span>
                          <span className="font-mono text-sm font-bold gold-text">{formatCOP(service.price)}</span>
                        </span>
                      </button>
                      <div className="flex items-center justify-between gap-2 px-3.5 pb-3">
                        <span className={`text-[11px] ${selected ? 'font-semibold text-gold' : 'text-zinc-500'}`}>{selected ? formatCOP(qty * service.price) : 'Toca para agregar'}</span>
                        <div className="flex items-center gap-1.5">
                          <button type="button" onClick={() => change(service, -1)} disabled={!selected} aria-label={`Quitar un ${service.name}`} className="w-8 h-8 rounded-full border border-white/15 text-zinc-300 flex items-center justify-center hover:border-gold/50 hover:text-gold disabled:opacity-30 disabled:cursor-not-allowed">
                            <Minus size={14} />
                          </button>
                          <span className={`w-6 text-center font-mono text-base font-bold ${selected ? 'text-gold' : 'text-zinc-600'}`}>{qty}</span>
                          <button type="button" onClick={() => change(service, 1)} disabled={full} aria-label={`Agregar un ${service.name}`} className="w-8 h-8 rounded-full border border-gold/40 text-gold flex items-center justify-center hover:bg-gold/15 disabled:opacity-30 disabled:cursor-not-allowed">
                            <Plus size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {hasItems && (
              <div className="mt-3 flex items-center justify-between rounded-xl border border-gold/25 bg-gold/[0.05] px-4 py-3">
                <span className="text-zinc-400 text-xs">{units} {units === 1 ? 'servicio' : 'servicios'} · {minutes} min</span>
                <span className="font-mono text-lg font-bold gold-text">{formatCOP(total)}</span>
              </div>
            )}
          </section>

          {hasItems && (
            <>
              <section>
                <SectionTitle number={2}>¿Cuándo?</SectionTitle>
                <div className="grid grid-cols-2 gap-2 mb-4" role="radiogroup" aria-label="Cuándo">
                  {([
                    ['agendar', 'Agendar cita', 'Eliges fecha y hora', CalendarPlus],
                    ['ahora', 'Ya lo atendí', `Hoy, ${minutesToTime(Math.floor(nowMinutes() / 5) * 5)}`, CheckCircle2],
                  ] as const).map(([value, label, hint, Icon]) => (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={mode === value}
                      onClick={() => { setMode(value); setError(''); }}
                      className={`flex items-center gap-3 text-left px-3.5 py-3 rounded-xl border transition-colors ${mode === value ? 'border-gold bg-gold/10' : 'border-white/10 hover:border-gold/40'}`}
                    >
                      <Icon size={18} className={mode === value ? 'text-gold' : 'text-zinc-500'} />
                      <span>
                        <span className={`block text-sm font-semibold ${mode === value ? 'text-gold' : 'text-white'}`}>{label}</span>
                        <span className="block text-[11px] text-zinc-500">{hint}</span>
                      </span>
                    </button>
                  ))}
                </div>

                {mode === 'agendar' && (
                  <div className="space-y-4">
                    <div>
                      <p className="text-xs text-zinc-400 uppercase tracking-wider mb-2">Fecha</p>
                      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1" style={{ scrollbarWidth: 'none' }}>
                        {Array.from({ length: DAYS_SHOWN }, (_, i) => addDays(today, i)).map((d, i) => {
                          const selected = d === date;
                          return (
                            <button
                              key={d}
                              type="button"
                              onClick={() => { setDate(d); setTime(''); }}
                              aria-pressed={selected}
                              className={`flex flex-col items-center min-w-[58px] px-2.5 py-2 rounded-2xl border shrink-0 transition-all ${selected ? 'border-gold bg-gold/15' : 'border-white/10 bg-white/[0.03] hover:border-white/25'}`}
                            >
                              <span className={`text-[10px] font-semibold uppercase ${selected ? 'text-gold' : 'text-zinc-500'}`}>{i === 0 ? 'Hoy' : i === 1 ? 'Mañana' : dayShort(d)}</span>
                              <span className={`text-lg font-bold font-mono ${selected ? 'text-gold' : 'text-white'}`}>{dayOfMonth(d)}</span>
                              <span className="text-[10px] text-zinc-600">{monthShort(d)}</span>
                            </button>
                          );
                        })}
                      </div>
                      <label className="flex items-center gap-2 mt-2 text-xs text-zinc-500">
                        Otra fecha:
                        <input
                          type="date"
                          min={today}
                          max={addDays(today, MAX_DAYS)}
                          value={date}
                          onChange={(e) => { if (e.target.value) { setDate(e.target.value); setTime(''); } }}
                          className="px-2.5 py-1.5 rounded-lg bg-white/[0.04] border border-white/10 text-white text-xs focus:outline-none focus:border-gold/60"
                        />
                        <span className="text-zinc-400">{formatDateLong(date)}</span>
                      </label>
                    </div>

                    <div>
                      <div className="flex items-end justify-between gap-3 mb-2">
                        <p className="text-xs text-zinc-400 uppercase tracking-wider">Hora</p>
                        <label className="flex items-center gap-2 text-xs text-zinc-500">
                          Otra hora:
                          <input
                            type="time"
                            step={300}
                            value={time}
                            onChange={(e) => setTime(e.target.value)}
                            aria-label="Hora de la cita"
                            className="px-2.5 py-1.5 rounded-lg bg-white/[0.04] border border-white/10 text-white text-xs font-mono focus:outline-none focus:border-gold/60"
                          />
                        </label>
                      </div>
                      {suggestions.length > 0 ? (
                        <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5">
                          {suggestions.map((t) => (
                            <button
                              key={t}
                              type="button"
                              onClick={() => setTime(t)}
                              aria-pressed={time === t}
                              className={`py-2 rounded-lg border font-mono text-sm transition-colors ${time === t ? 'border-gold bg-gold text-dark font-bold' : 'border-white/10 text-zinc-200 hover:border-gold/50'}`}
                            >
                              {t}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <p className="text-zinc-500 text-xs">
                          {hours ? 'No quedan horas libres en el horario de ese día.' : 'Ese día la barbería no abre.'} Puedes escribir otra hora arriba (por ejemplo, fuera del horario).
                        </p>
                      )}
                      <p className="text-zinc-600 text-[11px] mt-2">Las horas sugeridas están libres en tu agenda y dentro del horario. Si atiendes fuera del horario, escríbela en «Otra hora».</p>
                    </div>

                    {time && (
                      <div className={`rounded-xl border px-4 py-3 text-sm ${clash || past ? 'border-red-500/30 bg-red-500/10 text-red-300' : 'border-emerald-500/25 bg-emerald-500/[0.07] text-emerald-300'}`}>
                        {clash
                          ? <span className="flex items-start gap-2"><AlertTriangle size={16} className="shrink-0 mt-0.5" />Choca con la cita de {clash.b.clientName} a las {clash.b.time}. Elige otra hora.</span>
                          : past
                            ? <span className="flex items-start gap-2"><AlertTriangle size={16} className="shrink-0 mt-0.5" />Esa hora ya pasó. Si ya lo atendiste, usa «Ya lo atendí».</span>
                            : <span>De <strong className="font-mono">{time}</strong> a <strong className="font-mono">{endTime}</strong> · {formatDateLong(date)}{outsideHours ? ' · fuera del horario de la barbería' : ''}</span>}
                      </div>
                    )}

                    <div>
                      <p className="text-xs text-zinc-400 uppercase tracking-wider mb-2">Tu agenda ese día</p>
                      {dayAppts.length === 0 ? (
                        <p className="text-zinc-500 text-xs">No tienes citas ese día.</p>
                      ) : (
                        <ul className="space-y-1">
                          {busy.map(({ start, end, b }) => (
                            <li key={b.id} className="flex items-center gap-3 text-xs rounded-lg bg-white/[0.03] border border-white/[0.06] px-3 py-2">
                              <span className="font-mono text-gold w-24 shrink-0">{minutesToTime(start)}–{minutesToTime(end)}</span>
                              <span className="text-zinc-300 truncate">{b.clientName} · {b.serviceName}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                )}

                {mode === 'ahora' && (
                  <p className="text-zinc-500 text-xs">Queda registrado hoy, desde las {minutesToTime(Math.floor(nowMinutes() / 5) * 5)}, como servicio completado: suma a tus ganancias y a los reportes. No se le envían mensajes al cliente.</p>
                )}
              </section>

              <section className="space-y-3">
                <SectionTitle number={3}>Datos del cliente</SectionTitle>
                <div className="grid sm:grid-cols-2 gap-3">
                  <label className="block">
                    <span className="text-xs text-zinc-400 uppercase tracking-wider block mb-2">Nombre</span>
                    <input id="barber-client-name" className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Carlos Martínez" autoComplete="off" />
                  </label>
                  <div>
                    <span className="text-xs text-zinc-400 uppercase tracking-wider block mb-2">Celular (opcional)</span>
                    <div className="flex gap-2">
                      <CountryCodePicker value={country} onChange={setCountry} />
                      <input
                        id="barber-client-phone"
                        className={`${inputClass} flex-1 min-w-0`}
                        type="tel"
                        inputMode="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder={dialInfo.example}
                        autoComplete="off"
                        aria-invalid={!phoneOk}
                      />
                    </div>
                    {!phoneOk && <span className="text-amber-400 text-[11px] mt-1 block">{country === 'co' ? 'Escribe 10 dígitos o déjalo vacío.' : `Revisa el número de ${dialInfo.name}, sin el +${dialInfo.dial}.`}</span>}
                  </div>
                </div>
                <p className="text-zinc-500 text-xs">
                  {mode === 'agendar'
                    ? 'Con el celular, al cliente le llega por WhatsApp la confirmación con su ticket y los recordatorios de la cita.'
                    : 'Con el celular, el cliente queda guardado en la lista de clientes de la barbería.'}
                </p>
              </section>
            </>
          )}
        </div>

        <div className="border-t border-white/10 px-5 sm:px-6 py-4 bg-[#0d0d0d]">
          <button
            type="button"
            onClick={save}
            disabled={!ready}
            className="w-full btn-gold py-3.5 rounded-full font-semibold disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {saving ? <><Loader2 size={17} className="animate-spin" /><span>Guardando...</span></> : <span>{buttonLabel}</span>}
          </button>
        </div>
      </div>
    </div>
  );
}
