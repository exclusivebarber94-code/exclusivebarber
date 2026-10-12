import { useState, useEffect, useRef, useCallback } from 'react';
import { Clock, Loader2, Users, Check, Sun, Sunset, CalendarX } from 'lucide-react';
import { getServices } from '../../services/services';
import { getBarbers } from '../../services/barbers';
import { getBusySlots, type BusySlot } from '../../services/bookings';
import { generateSlots } from '../../lib/availability';
import { hoursFor, specialDayOf } from '../../lib/businessHours';
import { holidayName } from '../../lib/holidays';
import { todayKey, addDays, dayShort, dayOfMonth, formatDateLong } from '../../lib/dates';
import { formatCOP } from '../../data';
import BarberAvatar from '../common/BarberAvatar';
import { CategoryIcon } from '../common/BarberIcons';
import { businessConfig } from '../../config/business';
import type { Service, Barber, StaffRole } from '../../types';

export interface Appointment {
  service: Service | null;
  /** null = cualquier barbero disponible (el servidor asigna uno libre) */
  barber: Barber | null;
  date: string;
  time: string;
  /** Cuántos turnos seguidos (por ejemplo, el cliente y su hijo) */
  turns: number;
}

interface Props {
  value: Appointment;
  onChange: (value: Appointment) => void;
  onContinue: () => void;
}

const DAYS_AHEAD = 14;

/** Quién hace cada servicio: manicura → manicurista; lo demás → barbero */
const roleFor = (service: Service | null): StaffRole => (service?.category === 'manicura' ? 'manicurista' : 'barbero');
const MAX_TURNS = 10;

function SectionTitle({ number, children, hint }: { number: number; children: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 mb-3">
      <h4 className="flex items-center gap-2.5 text-sm font-semibold text-white">
        <span className="w-6 h-6 rounded-full bg-gold/15 border border-gold/40 text-gold text-xs font-bold flex items-center justify-center">
          {number}
        </span>
        {children}
      </h4>
      {hint && <span className="text-[11px] text-zinc-500 text-right">{hint}</span>}
    </div>
  );
}

export default function AppointmentStep({ value, onChange, onContinue }: Props) {
  const [services, setServices] = useState<Service[]>([]);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  // Barberos marcados como no disponibles en el panel: se muestran, pero no se pueden elegir
  const [awayBarbers, setAwayBarbers] = useState<Barber[]>([]);
  // Horas ocupadas de cada uno de los próximos días, para mostrar la disponibilidad real
  const [busyByDate, setBusyByDate] = useState<Record<string, BusySlot[]>>({});
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [loadingBusy, setLoadingBusy] = useState(true);
  const [loadError, setLoadError] = useState('');
  const turnsRef = useRef<HTMLElement>(null);
  const dayRef = useRef<HTMLElement>(null);
  const barberRef = useRef<HTMLElement>(null);
  const timeRef = useRef<HTMLElement>(null);

  const dates = Array.from({ length: DAYS_AHEAD }, (_, i) => addDays(todayKey(), i));

  useEffect(() => {
    Promise.all([getServices(), getBarbers()])
      .then(([serviceList, barberList]) => {
        setServices([...serviceList].sort((a, b) => Number(!!b.popular) - Number(!!a.popular)));
        setBarbers(barberList.filter((b) => b.available));
        setAwayBarbers(barberList.filter((b) => !b.available));
      })
      .catch((err) => {
        console.error('No se pudieron cargar los servicios y barberos', err);
        setLoadError('No pudimos cargar los servicios. Revisa tu conexión e intenta de nuevo.');
      })
      .finally(() => setLoadingCatalog(false));
  }, []);

  const loadBusy = useCallback((days: string[]) => {
    return Promise.all(days.map((d) => getBusySlots(d).then((list) => [d, list] as const)))
      .then((entries) => {
        setBusyByDate((prev) => ({ ...prev, ...Object.fromEntries(entries) }));
        setLoadError('');
      })
      .catch((err) => {
        console.error('No se pudieron cargar las horas ocupadas', err);
        setLoadError('No pudimos cargar la disponibilidad. Intenta de nuevo en un momento.');
      });
  }, []);

  // Al abrir: la disponibilidad de los 14 días
  useEffect(() => {
    loadBusy(Array.from({ length: DAYS_AHEAD }, (_, i) => addDays(todayKey(), i))).finally(() => setLoadingBusy(false));
  }, [loadBusy]);

  const turns = value.turns || 1;
  // Varios turnos se atienden uno detrás de otro: se busca un hueco del largo de todos
  const duration = (value.service?.duration ?? 30) * turns;
  const freeTimes = (day: string, barberIds: string[]) =>
    busyByDate[day] ? generateSlots(day, busyByDate[day], barberIds, duration).filter((s) => s.available).map((s) => s.time) : [];

  // Solo se ofrece el equipo que hace el servicio elegido
  const team = barbers.filter((b) => b.role === roleFor(value.service));
  const teamAway = awayBarbers.filter((b) => b.role === roleFor(value.service));
  // «El primero que esté libre» se puede apagar en Panel → Configuración → Reglas
  const allowAny = businessConfig.allowAnyBarber;
  const allIds = team.map((b) => b.id);
  const mustChoose = !allowAny && !value.barber;
  const selectedIds = value.barber ? [value.barber.id] : allIds;

  // Si la persona no ha elegido fecha, se propone el primer día con horas libres
  const firstOpenDay = dates.find((d) => freeTimes(d, selectedIds).length > 0) ?? dates[0];
  const date = value.date || firstOpenDay;

  // Al cambiar de día se vuelve a consultar ese día, por si alguien acaba de reservar
  useEffect(() => {
    if (value.date) loadBusy([value.date]);
  }, [value.date, loadBusy]);

  const update = (patch: Partial<Appointment>) => onChange({ ...value, date, ...patch });

  // Al elegir algo, la pantalla baja sola a la siguiente pregunta
  const scrollTo = (ref: React.RefObject<HTMLElement>) =>
    window.setTimeout(() => ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 90);

  const chooseService = (service: Service) => {
    const role = roleFor(service);
    const candidates = barbers.filter((b) => b.role === role);
    // Si el profesional elegido no hace este servicio, se quita; si hay que elegir y solo hay uno, se elige solo
    const keep = value.barber && value.barber.role === role ? value.barber : null;
    const barber = keep ?? (!allowAny && candidates.length === 1 ? candidates[0] : null);
    update({ service, barber, time: '' });
    scrollTo(turnsRef);
  };
  const chooseTurns = (n: number) => {
    update({ turns: n, time: '' });
    scrollTo(dayRef);
  };
  const chooseDay = (key: string) => {
    update({ date: key, time: '' });
    scrollTo(barberRef);
  };
  const chooseBarber = (barber: Barber | null) => {
    update({ barber, time: '' });
    scrollTo(timeRef);
  };

  const allSlots = value.service && !mustChoose && busyByDate[date] ? generateSlots(date, busyByDate[date], selectedIds, duration) : [];
  const freeCount = allSlots.filter((s) => s.available).length;
  const morning = allSlots.filter((s) => s.time < '12:00');
  const afternoon = allSlots.filter((s) => s.time >= '12:00');
  const nextDayForBarber = value.barber
    ? dates.find((d) => d > date && freeTimes(d, [value.barber!.id]).length > 0)
    : undefined;
  const ready = !!value.service && !!value.time && !mustChoose;

  const dayStatus = (key: string) => {
    if (!hoursFor(key)) return { label: 'Cerrado', tone: 'off' as const };
    if (specialDayOf(key) === 'walk-in') return { label: 'Llegada', tone: 'off' as const };
    if (!busyByDate[key]) return { label: '…', tone: 'muted' as const };
    const n = freeTimes(key, selectedIds).length;
    if (n === 0) return { label: 'Lleno', tone: 'off' as const };
    return { label: `${n} libres`, tone: n <= 3 ? ('few' as const) : ('ok' as const) };
  };

  const slotButton = ({ time, available }: { time: string; available: boolean }) => (
    <button
      key={time}
      onClick={() => available && update({ time })}
      disabled={!available}
      aria-pressed={value.time === time}
      title={available ? undefined : 'Ocupado'}
      className={`py-2.5 rounded-xl text-sm font-mono font-medium border transition-all ${
        value.time === time
          ? 'border-gold bg-gold text-dark font-bold'
          : available
            ? 'border-white/10 text-zinc-200 hover:border-gold/50 hover:text-gold bg-white/[0.03]'
            : 'border-white/[0.04] text-zinc-700 line-through cursor-not-allowed'
      }`}
    >
      {time}
    </button>
  );

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-5 space-y-7">
        {loadError && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{loadError}</div>
        )}

        <section>
          <SectionTitle number={1}>¿Qué te quieres hacer?</SectionTitle>
          {loadingCatalog ? (
            <div className="flex justify-center py-8"><Loader2 size={22} className="animate-spin text-gold" /></div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-2">
              {services.map((service) => {
                const selected = value.service?.id === service.id;
                return (
                  <button
                    key={service.id}
                    onClick={() => chooseService(service)}
                    aria-pressed={selected}
                    className={`text-left p-3.5 rounded-xl border transition-all ${
                      selected ? 'border-gold bg-gold/10 shadow-gold' : 'border-white/10 bg-white/[0.03] hover:border-gold/40'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="flex items-start gap-2 text-white text-sm font-medium leading-snug">
                        <CategoryIcon category={service.category} size={17} className={`shrink-0 mt-px ${selected ? 'text-gold' : 'text-gold/70'}`} />
                        {service.name}
                      </span>
                      {selected
                        ? <Check size={16} className="text-gold shrink-0 mt-0.5" />
                        : service.popular && <span className="text-[9px] font-bold uppercase tracking-wide text-gold bg-gold/15 px-1.5 py-0.5 rounded shrink-0">Popular</span>}
                    </div>
                    <div className="flex items-center justify-between mt-1.5">
                      <span className="flex items-center gap-1 text-zinc-500 text-xs"><Clock size={11} />{service.duration} min</span>
                      <span className="font-mono text-sm font-bold gold-text">{formatCOP(service.price)}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {value.service && (
          <div className="space-y-7">
            <section ref={turnsRef} className="scroll-mt-4">
              <SectionTitle number={2} hint="Uno detrás de otro, con el mismo barbero">¿Cuántos turnos?</SectionTitle>
              <div className="grid grid-cols-5 gap-2">
                {Array.from({ length: MAX_TURNS }, (_, i) => i + 1).map((n) => (
                  <button
                    key={n}
                    onClick={() => chooseTurns(n)}
                    aria-pressed={turns === n}
                    className={`py-2.5 rounded-xl border text-center transition-all ${
                      turns === n ? 'border-gold bg-gold/15 text-gold' : 'border-white/10 bg-white/[0.03] text-zinc-300 hover:border-gold/40'
                    }`}
                  >
                    <span className="block font-mono text-xl font-bold">{n}</span>
                    <span className="block text-[10px] uppercase tracking-wider opacity-80">{n === 1 ? 'turno' : 'turnos'}</span>
                  </button>
                ))}
              </div>
              <p className="text-zinc-500 text-xs mt-2">
                {turns === 1
                  ? '¿Vienes con alguien más (tu hijo, un amigo)? Reserva varios turnos seguidos.'
                  : `${turns} turnos de ${value.service.name} · ${turns * value.service.duration} min en total · ${formatCOP(turns * value.service.price)}`}
              </p>
            </section>

            <section ref={dayRef} className="scroll-mt-4">
              <SectionTitle number={3} hint={value.barber ? `Disponibilidad de ${value.barber.shortName}` : 'Disponibilidad de todo el equipo'}>
                ¿Qué día?
              </SectionTitle>
              <div className="flex gap-2 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
                {dates.map((key, i) => {
                  const selected = date === key;
                  const status = dayStatus(key);
                  const holiday = holidayName(key);
                  return (
                    <button
                      key={key}
                      title={holiday ? `Festivo: ${holiday}` : undefined}
                      onClick={() => chooseDay(key)}
                      aria-pressed={selected}
                      className={`flex flex-col items-center px-2.5 py-2.5 rounded-xl border shrink-0 min-w-[62px] transition-all ${
                        selected ? 'border-gold bg-gold/15' : 'border-white/10 bg-white/[0.03] hover:border-white/25'
                      } ${status.tone === 'off' && !selected ? 'opacity-45' : ''}`}
                    >
                      <span className={`text-[10px] font-semibold uppercase ${selected ? 'text-gold' : 'text-zinc-500'}`}>
                        {i === 0 ? 'Hoy' : i === 1 ? 'Mañana' : dayShort(key)}
                      </span>
                      <span className={`text-lg font-bold font-mono leading-tight ${selected ? 'text-gold' : 'text-white'}`}>{dayOfMonth(key)}</span>
                      <span className={`text-[10px] font-medium whitespace-nowrap ${
                        status.tone === 'ok' ? 'text-emerald-400' : status.tone === 'few' ? 'text-amber-400' : 'text-zinc-500'
                      }`}>
                        {status.label}
                      </span>
                      {holiday && <span className="text-[9px] text-gold font-semibold mt-0.5">Festivo</span>}
                    </button>
                  );
                })}
              </div>
              <p className="text-zinc-500 text-xs mt-1">
                {formatDateLong(date)}.
                {holidayName(date) && <span className="text-gold"> Festivo: {holidayName(date)}.</span>}
              </p>
            </section>

            <section ref={barberRef} className="scroll-mt-4">
              <SectionTitle number={4}>¿Con quién?</SectionTitle>
              <div className="grid gap-2">
                {[...(allowAny ? [null] : []), ...team].map((barber) => {
                  const ids = barber ? [barber.id] : allIds;
                  const times = freeTimes(date, ids);
                  const selected = barber ? value.barber?.id === barber.id : value.barber === null;
                  const none = !loadingBusy && times.length === 0;
                  return (
                    <button
                      key={barber?.id ?? 'any'}
                      onClick={() => chooseBarber(barber)}
                      aria-pressed={selected}
                      className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                        selected ? 'border-gold bg-gold/10' : 'border-white/10 bg-white/[0.03] hover:border-gold/40'
                      } ${none && !selected ? 'opacity-55' : ''}`}
                    >
                      {barber ? (
                        <BarberAvatar barber={barber} className={`w-12 h-12 rounded-full text-sm shrink-0 border-2 ${selected ? 'border-gold' : 'border-transparent'}`} />
                      ) : (
                        <span className={`w-12 h-12 rounded-full shrink-0 flex items-center justify-center border-2 ${selected ? 'border-gold bg-gold/15 text-gold' : 'border-white/10 bg-white/5 text-zinc-400'}`}>
                          <Users size={20} />
                        </span>
                      )}
                      <span className="flex-1 min-w-0">
                        <span className={`block text-sm font-semibold ${selected ? 'text-gold' : 'text-white'}`}>
                          {barber ? barber.name : 'El primero que esté libre'}
                        </span>
                        <span className="block text-xs text-zinc-500 truncate">
                          {barber ? barber.specialties.slice(0, 3).join(' · ') : 'Más horarios para elegir'}
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        {loadingBusy ? (
                          <Loader2 size={14} className="animate-spin text-zinc-500" />
                        ) : none ? (
                          <span className="text-[11px] font-semibold text-zinc-500">Sin horas este día</span>
                        ) : (
                          <>
                            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-400">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> {times.length} {times.length === 1 ? 'hora libre' : 'horas libres'}
                            </span>
                            <span className="block text-[11px] text-zinc-500 mt-0.5">desde las {times[0]}</span>
                          </>
                        )}
                      </span>
                    </button>
                  );
                })}
                {teamAway.map((barber) => (
                  <div
                    key={barber.id}
                    aria-disabled="true"
                    className="flex items-center gap-3 p-3 rounded-xl border border-white/[0.06] bg-white/[0.015] opacity-50 cursor-not-allowed"
                  >
                    <BarberAvatar barber={barber} className="w-12 h-12 rounded-full text-sm shrink-0 grayscale" />
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-semibold text-zinc-300">{barber.name}</span>
                      <span className="block text-xs text-zinc-500 truncate">{barber.specialties.slice(0, 3).join(' · ')}</span>
                    </span>
                    <span className="shrink-0 text-[11px] font-semibold text-zinc-500">No disponible por ahora</span>
                  </div>
                ))}
              </div>
            </section>

            <section ref={timeRef} className="scroll-mt-4">
              <SectionTitle number={5} hint={allSlots.length > 0 && `${freeCount} de ${allSlots.length} libres`}>¿A qué hora?</SectionTitle>
              {loadingBusy && !busyByDate[date] ? (
                <div className="flex justify-center py-6"><Loader2 size={20} className="animate-spin text-gold" /></div>
              ) : freeCount > 0 ? (
                <div className="space-y-4">
                  {[{ label: 'Mañana', icon: Sun, list: morning }, { label: 'Tarde', icon: Sunset, list: afternoon }]
                    .filter((g) => g.list.length > 0)
                    .map(({ label, icon: Icon, list }) => (
                      <div key={label}>
                        <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-zinc-500 font-semibold mb-2">
                          <Icon size={13} className="text-gold/70" /> {label}
                        </p>
                        <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">{list.map(slotButton)}</div>
                      </div>
                    ))}
                  <p className="text-[11px] text-zinc-600">Las horas tachadas ya están ocupadas.</p>
                </div>
              ) : (
                <div className="flex flex-col items-center text-center gap-3 py-5 px-4 rounded-xl border border-white/[0.06] bg-white/[0.02]">
                  <CalendarX size={22} className="text-zinc-500" />
                  <p className="text-zinc-400 text-sm">
                    {!hoursFor(date)
                      ? 'Este día la barbería está cerrada.'
                      : specialDayOf(date) === 'walk-in'
                        ? 'Este día no hay reservas: atendemos por orden de llegada. ¡Te esperamos en la barbería!'
                        : mustChoose
                          ? 'Elige con quién quieres tu cita para ver sus horas libres.'
                          : value.barber
                            ? `${value.barber.shortName} no tiene horas libres este día.`
                            : 'No quedan horas libres este día.'}
                  </p>
                  <div className="flex flex-wrap justify-center gap-2">
                    {nextDayForBarber && (
                      <button onClick={() => update({ date: nextDayForBarber, time: '' })} className="px-3.5 py-2 rounded-full border border-gold/40 text-gold text-xs font-semibold hover:bg-gold/10">
                        Ver {dayShort(nextDayForBarber).toLowerCase()} {dayOfMonth(nextDayForBarber)} con {value.barber?.shortName}
                      </button>
                    )}
                    {allowAny && value.barber && freeTimes(date, allIds).length > 0 && (
                      <button onClick={() => update({ barber: null, time: '' })} className="px-3.5 py-2 rounded-full border border-white/15 text-zinc-300 text-xs font-semibold hover:border-gold/40 hover:text-gold">
                        Ver otro barbero este día
                      </button>
                    )}
                  </div>
                </div>
              )}
            </section>
          </div>
        )}
      </div>

      <div className="border-t border-white/10 px-5 sm:px-6 py-4 bg-[#0d0d0d]">
        <button
          disabled={!ready}
          onClick={onContinue}
          className="w-full btn-gold py-3.5 rounded-full font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <span>
            {!value.service ? 'Elige un servicio' : !value.time ? 'Elige una hora' : `Continuar · ${dayShort(date)} ${dayOfMonth(date)} a las ${value.time}${turns > 1 ? ` · ${turns} turnos` : ''}`}
          </span>
        </button>
      </div>
    </div>
  );
}
