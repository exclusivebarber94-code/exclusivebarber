import { useState } from 'react';
import { Bell, BellRing, CalendarPlus, CalendarX, MessageCircle, Play, Volume2, RotateCcw, CheckCircle2 } from 'lucide-react';
import { Panel } from './ui';
import {
  TONES, EVENTS, DEFAULT_SOUNDS, loadSoundSettings, saveSoundSettings, playTone,
  type SoundEvent, type SoundSettings, type ToneId,
} from '../../lib/notificationSounds';

// Configuración → Notificaciones: tono, volumen y repeticiones de cada aviso del panel.
// Se guarda en este dispositivo (cada computador o celular puede sonar distinto).

const EVENT_ICON: Record<SoundEvent, React.ElementType> = { booking: CalendarPlus, cancelled: CalendarX, message: MessageCircle };

export default function NotificationSoundsPanel() {
  const [settings, setSettings] = useState<SoundSettings>(loadSoundSettings);
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>(
    typeof Notification === 'undefined' ? 'unsupported' : Notification.permission,
  );

  const update = (event: SoundEvent, patch: Partial<SoundSettings[SoundEvent]>) => {
    const next = { ...settings, [event]: { ...settings[event], ...patch } };
    setSettings(next);
    saveSoundSettings(next);
  };
  const test = (event: SoundEvent) => playTone(settings[event].tone, settings[event].volume, settings[event].repeat);
  const reset = () => { setSettings(structuredClone(DEFAULT_SOUNDS)); saveSoundSettings(structuredClone(DEFAULT_SOUNDS)); };

  return (
    <div className="space-y-5">
      <Panel
        title="Tonos de las notificaciones"
        subtitle="Cada aviso con su propio sonido. Se guarda en este dispositivo: configúralo en cada computador o celular donde abras el panel."
        action={
          <button onClick={reset} className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-gold px-3 py-2 rounded-lg border border-white/10 hover:border-gold/40">
            <RotateCcw size={13} /> Restablecer
          </button>
        }
      >
        <div className="space-y-4">
          {EVENTS.map(({ id, label, hint }) => {
            const Icon = EVENT_ICON[id];
            const s = settings[id];
            return (
              <div key={id} className={`rounded-2xl border p-4 ${id === 'booking' ? 'border-gold/35 bg-gold/[0.05]' : 'border-white/10 bg-white/[0.02]'}`}>
                <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                  <div className="flex items-start gap-3">
                    <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${id === 'booking' ? 'bg-gold/15 text-gold' : 'bg-white/5 text-zinc-300'}`}>
                      <Icon size={18} />
                    </span>
                    <div>
                      <p className="text-white font-semibold text-sm">{label}</p>
                      <p className="text-zinc-500 text-xs">{hint}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => test(id)}
                    disabled={s.tone === 'silencio'}
                    aria-label={`Probar el tono de ${label}`}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-gold text-dark text-xs font-bold hover:brightness-110 disabled:opacity-40"
                  >
                    <Play size={13} className="fill-dark" /> Probar
                  </button>
                </div>

                <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={`Tono de ${label}`}>
                  {TONES.map((t) => (
                    <button
                      key={t.id}
                      role="radio"
                      aria-checked={s.tone === t.id}
                      title={t.hint}
                      onClick={() => { update(id, { tone: t.id as ToneId }); playTone(t.id, s.volume, 1); }}
                      className={`px-3 py-1.5 rounded-full border text-xs font-semibold transition-all ${
                        s.tone === t.id ? 'border-gold bg-gold/15 text-gold' : 'border-white/10 text-zinc-300 hover:border-gold/40'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                {s.tone !== 'silencio' && (
                  <div className="grid sm:grid-cols-[1fr_auto] gap-4 mt-4 items-center">
                    <label className="flex items-center gap-3">
                      <Volume2 size={16} className="text-zinc-400 shrink-0" />
                      <input
                        type="range"
                        min={10}
                        max={100}
                        step={5}
                        value={s.volume}
                        onChange={(e) => update(id, { volume: Number(e.target.value) })}
                        aria-label={`Volumen de ${label}`}
                        className="flex-1 accent-[#D4AF37]"
                      />
                      <span className="font-mono text-xs text-zinc-300 w-10 text-right">{s.volume}%</span>
                    </label>
                    <div className="flex items-center gap-2 text-xs text-zinc-400">
                      Suena
                      {[1, 2, 3].map((n) => (
                        <button
                          key={n}
                          onClick={() => update(id, { repeat: n })}
                          aria-pressed={s.repeat === n}
                          className={`w-8 h-8 rounded-lg border font-mono font-bold ${s.repeat === n ? 'border-gold bg-gold/15 text-gold' : 'border-white/10 text-zinc-300'}`}
                        >
                          {n}
                        </button>
                      ))}
                      {s.repeat === 1 ? 'vez' : 'veces'}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <p className="text-zinc-500 text-xs mt-4 leading-relaxed">
          Para que suene, el panel debe estar abierto (puede estar en otra pestaña) y el volumen del equipo encendido.
          El navegador solo deja sonar después de que toques la página una vez.
        </p>
      </Panel>

      <Panel title="Avisos en pantalla" subtitle="Una ventanita del sistema cuando llega algo nuevo, aunque estés en otra pestaña">
        {permission === 'granted' ? (
          <p className="flex items-center gap-2 text-emerald-400 text-sm"><CheckCircle2 size={16} /> Activados en este navegador.</p>
        ) : permission === 'denied' ? (
          <p className="text-amber-400 text-sm">Están bloqueados en este navegador. Actívalos desde el candado junto a la dirección de la página → Notificaciones → Permitir.</p>
        ) : permission === 'unsupported' ? (
          <p className="text-zinc-400 text-sm">Este navegador no permite avisos en pantalla. El sonido sí funciona.</p>
        ) : (
          <button
            onClick={() => Notification.requestPermission().then(setPermission)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gold text-dark text-sm font-bold hover:brightness-110"
          >
            <BellRing size={16} /> Activar avisos en pantalla
          </button>
        )}
        <p className="flex items-center gap-1.5 text-zinc-500 text-xs mt-3"><Bell size={12} /> La campanita del panel siempre muestra lo nuevo, con o sin estos avisos.</p>
      </Panel>
    </div>
  );
}
