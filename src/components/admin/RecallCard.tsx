import { useState } from 'react';
import { Repeat, Loader2, CheckCircle2, AlertCircle, Users } from 'lucide-react';
import { currentSettings, saveSettings } from '../../services/settings';
import { getRecallPreview, type RecallCandidate } from '../../services/recall';
import { Panel } from './ui';
import { formatDateLong } from '../../lib/dates';

// WhatsApp «ya es hora de volver»: el sistema aprende cada cuánto viene cada cliente y, cuando le
// toca y no ha agendado, le escribe con el botón para reservar (api/_recall.js).

export default function RecallCard() {
  const [enabled, setEnabled] = useState(() => currentSettings().recall.enabled);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [preview, setPreview] = useState<RecallCandidate[] | null>(null);
  const [loading, setLoading] = useState(false);

  const toggle = async () => {
    const next = !enabled;
    setSaving(true);
    setStatus(null);
    try {
      await saveSettings({ recall: { enabled: next } });
      setEnabled(next);
      setStatus({ kind: 'ok', text: next ? 'Activado: los clientes con un ritmo regular recibirán el recordatorio.' : 'Desactivado: no se enviarán recordatorios para volver.' });
    } catch (err) {
      console.error('No se pudo guardar la opción', err);
      setStatus({ kind: 'error', text: 'No se pudo guardar. Intenta de nuevo.' });
    } finally {
      setSaving(false);
    }
  };

  const loadPreview = async () => {
    setLoading(true);
    try {
      setPreview(await getRecallPreview());
    } catch (err) {
      console.error('No se pudo calcular la lista', err);
      setStatus({ kind: 'error', text: 'No se pudo calcular la lista. Intenta de nuevo.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Panel title="Recordatorio para volver" subtitle="WhatsApp «ya es hora de tu corte» según el ritmo de cada cliente" className="lg:col-span-2">
      <div className="flex items-start justify-between gap-4">
        <div className="text-zinc-400 text-sm leading-relaxed space-y-2">
          <p className="flex gap-2.5">
            <Repeat size={16} className="text-gold shrink-0 mt-0.5" />
            <span>
              El sistema mira las visitas de cada cliente. Si viene con regularidad (por ejemplo, cada 8 días) y ya le toca
              pero no ha agendado, le llega un WhatsApp con un botón para reservar con su último servicio ya elegido.
            </span>
          </p>
          <p className="text-zinc-500 text-xs">
            Necesita al menos 3 visitas con un ritmo parecido. Un solo mensaje por ciclo y máximo uno por semana; se envía
            de lunes a sábado entre 10:00 a. m. y 1:00 p. m., nunca domingos ni festivos (Ley 2300 de 2023). Si el cliente
            responde NO, no le vuelve a llegar.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label="Recordatorio para volver"
          onClick={toggle}
          disabled={saving}
          className={`relative w-14 h-8 rounded-full shrink-0 transition-colors disabled:opacity-60 ${enabled ? 'bg-emerald-500' : 'bg-zinc-600'}`}
        >
          <span className={`absolute top-1 w-6 h-6 rounded-full bg-white shadow transition-all ${enabled ? 'left-7' : 'left-1'}`} />
        </button>
      </div>

      {status && (
        <p className={`mt-3 flex items-center gap-2 text-sm ${status.kind === 'ok' ? 'text-emerald-400' : 'text-red-400'}`}>
          {status.kind === 'ok' ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />} {status.text}
        </p>
      )}

      <div className="mt-4 pt-4 border-t border-white/[0.06]">
        <button
          type="button"
          onClick={loadPreview}
          disabled={loading}
          className="btn-dark-glass px-4 py-2 rounded-xl text-sm font-medium hover:border-gold/40 hover:text-gold disabled:opacity-50"
        >
          {loading ? <Loader2 size={15} className="animate-spin" /> : <Users size={15} />}
          {preview ? 'Actualizar la lista' : '¿A quién le llegaría hoy?'}
        </button>

        {preview && (
          preview.length === 0 ? (
            <p className="text-zinc-500 text-sm mt-3">Hoy no le toca a nadie.</p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-zinc-500 text-xs">
                    <th className="py-2 pr-3 font-medium">Cliente</th>
                    <th className="py-2 pr-3 font-medium">Viene cada</th>
                    <th className="py-2 pr-3 font-medium">Última visita</th>
                    <th className="py-2 font-medium">Último servicio</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((c) => (
                    <tr key={c.phone} className="border-t border-white/[0.05]">
                      <td className="py-2 pr-3 text-white">{c.client_name}<span className="block text-zinc-500 text-xs">{c.visits} visitas</span></td>
                      <td className="py-2 pr-3 text-zinc-300 whitespace-nowrap">{c.every_days} días</td>
                      <td className="py-2 pr-3 text-zinc-300 whitespace-nowrap">{formatDateLong(c.last_visit)}<span className="block text-amber-400/90 text-xs">hace {c.days_since} días</span></td>
                      <td className="py-2 text-zinc-300">{c.last_service_name}<span className="block text-zinc-500 text-xs">con {c.last_barber}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-zinc-500 text-xs mt-2">
                {enabled ? 'Les llegará en el próximo horario de envío.' : 'Está desactivado: no se enviará nada.'}
              </p>
            </div>
          )
        )}
      </div>
    </Panel>
  );
}
