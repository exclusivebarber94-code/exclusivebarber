import { useState, useEffect } from 'react';
import { Download, ChevronLeft, ChevronRight, Wallet, CheckCircle2, Receipt, XCircle, Loader2, Clock, CalendarDays } from 'lucide-react';
import { getBookingsByMonth, getBookingsByYear } from '../../services/bookings';
import { getBarbers } from '../../services/barbers';
import { formatCOP } from '../../data';
import { todayKey } from '../../lib/dates';
import {
  revenueOf, isCompleted, percentChange, dailySeries, revenueBy, bookingsByHour, bookingsByWeekday,
} from '../../lib/stats';
import { SERIES_COLORS } from '../../lib/chartFormat';
import { exportReportPdf } from '../../lib/reportPdf';
import type { Booking, Barber } from '../../types';
import { Panel, KpiCard, Trend, Segmented, Initials } from '../../components/admin/ui';
import { RevenueTrendChart, GoldBarChart, DonutChart } from '../../components/admin/charts';
import DataTable, { type Column } from '../../components/admin/DataTable';

const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

interface MonthRow { month: string; bookings: number; completed: number; cancelled: number; revenue: number }
interface ClientRow { name: string; phone: string; visits: number; revenue: number }

const monthColumns: Column<MonthRow>[] = [
  { key: 'month', header: 'Mes', primary: true, render: (r) => <span className="text-white font-medium">{r.month}</span> },
  { key: 'revenue', header: 'Ingresos', aside: true, align: 'right', render: (r) => <span className="font-mono text-gold font-semibold">{formatCOP(r.revenue)}</span> },
  { key: 'bookings', header: 'Reservas', render: (r) => <span className="font-mono text-zinc-300">{r.bookings}</span> },
  { key: 'completed', header: 'Completadas', render: (r) => <span className="font-mono text-emerald-400">{r.completed}</span> },
  { key: 'cancelled', header: 'Canceladas', render: (r) => <span className="font-mono text-rose-400">{r.cancelled}</span> },
];

const clientColumns: Column<ClientRow>[] = [
  {
    key: 'name', header: 'Cliente', primary: true,
    render: (c) => (
      <div className="flex items-center gap-3 min-w-0">
        <Initials name={c.name} className="w-8 h-8 text-[11px]" />
        <span className="text-white font-medium truncate">{c.name}</span>
      </div>
    ),
  },
  { key: 'revenue', header: 'Gastado', aside: true, align: 'right', render: (c) => <span className="font-mono text-gold font-semibold">{formatCOP(c.revenue)}</span> },
  { key: 'visits', header: 'Visitas', render: (c) => <span className="font-mono text-zinc-300">{c.visits}</span> },
  { key: 'phone', header: 'Celular', render: (c) => <span className="font-mono text-zinc-400 text-xs">{c.phone}</span> },
];

function daysOfMonth(year: number, month: number): string[] {
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const mm = String(month).padStart(2, '0');
  return Array.from({ length: last }, (_, i) => `${year}-${mm}-${String(i + 1).padStart(2, '0')}`);
}

export default function AdminReports() {
  const [nowYear, nowMonth] = todayKey().split('-').map(Number);
  const [viewMode, setViewMode] = useState<'month' | 'year'>('month');
  const [year, setYear] = useState(nowYear);
  const [month, setMonth] = useState(nowMonth);
  const [current, setCurrent] = useState<Booking[]>([]);
  const [previous, setPrevious] = useState<Booking[]>([]);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    setLoading(true);
    const prevM = month === 1 ? 12 : month - 1;
    const prevY = month === 1 ? year - 1 : year;
    const requests = viewMode === 'month'
      ? [getBookingsByMonth(year, month), getBookingsByMonth(prevY, prevM)]
      : [getBookingsByYear(year), getBookingsByYear(year - 1)];
    Promise.all([...requests, getBarbers()])
      .then(([curr, prev, barberList]) => {
        setCurrent(curr as Booking[]);
        setPrevious(prev as Booking[]);
        setBarbers(barberList as Barber[]);
        setError('');
      })
      .catch((err) => {
        console.error('No se pudo cargar el reporte', err);
        setError('No se pudo cargar el reporte. Intenta de nuevo.');
      })
      .finally(() => setLoading(false));
  }, [viewMode, year, month]);

  const navMonth = (dir: number) => {
    let m = month + dir;
    let y = year;
    if (m < 1) { m = 12; y--; }
    if (m > 12) { m = 1; y++; }
    setMonth(m);
    setYear(y);
  };
  const atPresent = viewMode === 'month' ? year === nowYear && month === nowMonth : year >= nowYear;

  // Cifras del período
  const revenue = revenueOf(current);
  const done = current.filter(isCompleted).length;
  const cancelled = current.filter((b) => b.status === 'cancelled').length;
  const avgTicket = done ? Math.round(revenue / done) : 0;
  const prevRevenue = revenueOf(previous);
  const prevDone = previous.filter(isCompleted).length;
  const prevCancelled = previous.filter((b) => b.status === 'cancelled').length;
  const prevAvg = prevDone ? Math.round(prevRevenue / prevDone) : 0;
  const compareLabel = viewMode === 'month' ? 'Frente al mes anterior' : 'Frente al año anterior';

  const barberName = (b: Booking) => barbers.find((x) => x.id === b.barberId)?.name ?? b.barberName;
  const byBarber = revenueBy(current, barberName);
  const byService = revenueBy(current, (b) => b.serviceName);

  const trend = viewMode === 'month'
    ? dailySeries(current, daysOfMonth(year, month)).map((d) => ({ ...d, label: String(Number(d.date.slice(8))) }))
    : [];
  const monthRows: MonthRow[] = MONTHS.map((name, i) => {
    const list = current.filter((b) => Number(b.date.slice(5, 7)) === i + 1);
    return {
      month: name,
      bookings: list.length,
      completed: list.filter(isCompleted).length,
      cancelled: list.filter((b) => b.status === 'cancelled').length,
      revenue: revenueOf(list),
    };
  });

  const clientMap = new Map<string, ClientRow>();
  for (const b of current) {
    if (!isCompleted(b)) continue;
    const key = b.clientPhone.replace(/\D/g, '').slice(-10);
    const row = clientMap.get(key) ?? { name: b.clientName, phone: key, visits: 0, revenue: 0 };
    row.visits += 1;
    row.revenue += b.price;
    clientMap.set(key, row);
  }
  const topClients = [...clientMap.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 8);

  const hours = bookingsByHour(current);
  const weekdays = bookingsByWeekday(current);
  const busiestHour = hours.reduce<{ name: string; bookings: number } | null>((best, h) => (!best || h.bookings > best.bookings ? h : best), null);
  const busiestDay = weekdays.reduce<{ name: string; bookings: number } | null>((best, d) => (!best || d.bookings > best.bookings ? d : best), null);

  const periodLabel = viewMode === 'month' ? `${MONTHS[month - 1]} ${year}` : String(year);

  const handleExport = async () => {
    setExporting(true);
    try {
      const [y, m, d] = todayKey().split('-');
      await exportReportPdf({
        title: viewMode === 'month' ? `Reporte Mensual · ${periodLabel}` : `Reporte Anual · ${year}`,
        fileName: viewMode === 'month' ? `reporte-${year}-${String(month).padStart(2, '0')}.pdf` : `reporte-${year}.pdf`,
        generatedAt: `${d}/${m}/${y}`,
        kpis: [
          { label: 'Ingresos', value: formatCOP(revenue) },
          { label: 'Completadas', value: String(done) },
          { label: 'Ticket promedio', value: formatCOP(avgTicket) },
          { label: 'Cancelaciones', value: String(cancelled) },
        ],
        table: viewMode === 'year'
          ? {
            title: `Resumen mensual ${year}`,
            headers: ['Mes', 'Reservas', 'Completadas', 'Canceladas', 'Ingresos'],
            rows: monthRows.map((r) => [r.month, String(r.bookings), String(r.completed), String(r.cancelled), formatCOP(r.revenue)]),
          }
          : {
            title: `Ingresos por día · ${periodLabel}`,
            headers: ['Día', 'Citas', 'Ingresos'],
            rows: trend.filter((t) => t.bookings > 0).map((t) => [t.date.split('-').reverse().join('/'), String(t.bookings), formatCOP(t.revenue)]),
          },
        barbers: byBarber.map((b) => ({ name: b.name, services: b.count, revenue: b.revenue })),
        services: byService.map((s) => ({ name: s.name, count: s.count, revenue: s.revenue })),
      });
    } catch (err) {
      console.error('No se pudo generar el PDF', err);
      setError('No se pudo generar el PDF. Intenta de nuevo.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Segmented
            value={viewMode}
            onChange={setViewMode}
            options={[{ value: 'month', label: 'Mensual' }, { value: 'year', label: 'Anual' }]}
          />
          <div className="flex items-center gap-1 bg-white/[0.03] rounded-xl p-1 border border-white/10">
            <button
              onClick={() => (viewMode === 'month' ? navMonth(-1) : setYear((y) => y - 1))}
              aria-label="Período anterior"
              className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-400 hover:text-gold hover:bg-white/5"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-white text-sm font-semibold min-w-[130px] text-center">{periodLabel}</span>
            <button
              onClick={() => (viewMode === 'month' ? navMonth(1) : setYear((y) => y + 1))}
              disabled={atPresent}
              aria-label="Período siguiente"
              className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-400 hover:text-gold hover:bg-white/5 disabled:opacity-30 disabled:pointer-events-none"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
        <button
          onClick={handleExport}
          disabled={loading || exporting}
          className="btn-gold px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 disabled:opacity-60"
        >
          {exporting ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
          Exportar PDF
        </button>
      </div>

      {error && <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <Loader2 size={26} className="animate-spin text-gold" />
          <p className="text-zinc-500 text-xs">Generando reporte...</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
            <KpiCard label="Ingresos" value={formatCOP(revenue)} sub={`${done} servicios completados`} icon={Wallet}
              trend={<Trend value={percentChange(revenue, prevRevenue)} label={compareLabel} />} />
            <KpiCard label="Completadas" value={done} sub={`de ${current.length} reservas`} icon={CheckCircle2} accent="emerald"
              trend={<Trend value={percentChange(done, prevDone)} label={compareLabel} />} />
            <KpiCard label="Ticket promedio" value={formatCOP(avgTicket)} sub="por servicio" icon={Receipt} accent="blue"
              trend={<Trend value={percentChange(avgTicket, prevAvg)} label={compareLabel} />} />
            <KpiCard label="Cancelaciones" value={cancelled} sub={current.length ? `${Math.round((cancelled / current.length) * 100)}% de las reservas` : 'sin reservas'} icon={XCircle} accent="rose"
              trend={<Trend value={percentChange(cancelled, prevCancelled)} inverse label={compareLabel} />} />
          </div>

          {viewMode === 'month' ? (
            <Panel title={`Ingresos por día · ${periodLabel}`} subtitle="Área dorada: ingresos · línea azul: citas">
              <RevenueTrendChart data={trend} />
            </Panel>
          ) : (
            <Panel title={`Ingresos por mes · ${year}`} subtitle="Servicios completados de cada mes">
              <GoldBarChart data={monthRows.map((r) => ({ name: r.month.slice(0, 3), revenue: r.revenue }))} dataKey="revenue" nameKey="name" height={280} />
            </Panel>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            <Panel title="Ingresos por barbero" subtitle={periodLabel}>
              <DonutChart
                data={byBarber.map((b, i) => ({ name: b.name, value: b.revenue, color: SERIES_COLORS[i % SERIES_COLORS.length] }))}
                centerLabel="ingresos"
                format={formatCOP}
              />
            </Panel>
            <Panel title="Ingresos por servicio" subtitle={periodLabel}>
              <GoldBarChart data={byService.slice(0, 7)} dataKey="revenue" nameKey="name" layout="vertical" height={Math.max(180, Math.min(byService.length, 7) * 40)} />
            </Panel>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            <Panel
              title="Horas pico"
              subtitle="Citas según la hora de inicio"
              action={busiestHour && busiestHour.bookings > 0 && (
                <span className="inline-flex items-center gap-1.5 text-xs text-gold bg-gold/10 border border-gold/25 rounded-full px-3 py-1.5 font-semibold">
                  <Clock size={13} /> Más llena: {busiestHour.name}
                </span>
              )}
            >
              <GoldBarChart data={hours} dataKey="bookings" nameKey="name" height={240} />
            </Panel>
            <Panel
              title="Días más ocupados"
              subtitle="Citas según el día de la semana"
              action={busiestDay && busiestDay.bookings > 0 && (
                <span className="inline-flex items-center gap-1.5 text-xs text-gold bg-gold/10 border border-gold/25 rounded-full px-3 py-1.5 font-semibold">
                  <CalendarDays size={13} /> {busiestDay.name}
                </span>
              )}
            >
              <GoldBarChart data={weekdays} dataKey="bookings" nameKey="name" height={240} />
            </Panel>
          </div>

          {viewMode === 'year' && (
            <Panel title={`Resumen mensual ${year}`} bodyClassName="pt-4">
              <DataTable
                rows={monthRows}
                columns={monthColumns}
                rowKey={(r) => r.month}
                rowClassName={(r) => (r.bookings === 0 ? 'opacity-40' : '')}
              />
            </Panel>
          )}

          <Panel title="Mejores clientes" subtitle={`Los que más gastaron · ${periodLabel}`} bodyClassName="pt-4">
            <DataTable rows={topClients} columns={clientColumns} rowKey={(c) => c.phone} empty="No hay servicios completados en este período." />
          </Panel>
        </>
      )}
    </div>
  );
}
