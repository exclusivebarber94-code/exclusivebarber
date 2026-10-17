// Tonos de las notificaciones del panel, generados con el audio del navegador (sin archivos).
// Cada aviso (reserva nueva, cancelación, mensaje del chat) tiene su tono, volumen y repeticiones.
// La elección se guarda en ESTE dispositivo: cada computador o celular suena como se configure.

export type ToneId = 'alarma' | 'timbre' | 'caja' | 'campana' | 'suave' | 'silencio';
export type SoundEvent = 'booking' | 'cancelled' | 'message';

export interface SoundSetting {
  tone: ToneId;
  /** 0 a 100 */
  volume: number;
  /** Veces que suena seguido (1 a 3) */
  repeat: number;
}

export type SoundSettings = Record<SoundEvent, SoundSetting>;

export const TONES: { id: ToneId; label: string; hint: string }[] = [
  { id: 'alarma', label: 'Alarma', hint: 'El más fuerte, imposible de ignorar' },
  { id: 'timbre', label: 'Timbre', hint: 'Ding-dong de puerta' },
  { id: 'caja', label: 'Caja registradora', hint: 'Cha-ching' },
  { id: 'campana', label: 'Campana', hint: 'Campana clara' },
  { id: 'suave', label: 'Suave', hint: 'El aviso discreto de antes' },
  { id: 'silencio', label: 'Silencio', hint: 'No suena' },
];

export const EVENTS: { id: SoundEvent; label: string; hint: string }[] = [
  { id: 'booking', label: 'Reserva nueva', hint: 'Cuando un cliente reserva por la web' },
  { id: 'cancelled', label: 'Reserva cancelada', hint: 'Cuando se cancela una cita' },
  { id: 'message', label: 'Mensaje del chat', hint: 'Cuando alguien deja un mensaje en la web' },
];

export const DEFAULT_SOUNDS: SoundSettings = {
  booking: { tone: 'alarma', volume: 100, repeat: 2 },
  cancelled: { tone: 'campana', volume: 80, repeat: 1 },
  message: { tone: 'suave', volume: 70, repeat: 1 },
};

const KEY = 'eb-notif-sounds';

export function loadSoundSettings(): SoundSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(DEFAULT_SOUNDS);
    const saved = JSON.parse(raw) as Partial<SoundSettings>;
    return {
      booking: { ...DEFAULT_SOUNDS.booking, ...saved.booking },
      cancelled: { ...DEFAULT_SOUNDS.cancelled, ...saved.cancelled },
      message: { ...DEFAULT_SOUNDS.message, ...saved.message },
    };
  } catch {
    return structuredClone(DEFAULT_SOUNDS);
  }
}

export function saveSoundSettings(settings: SoundSettings) {
  try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch { /* sin almacenamiento: dura esta sesión */ }
}

// ---------------------------------------------------------------- audio

let shared: AudioContext | null = null;

/** Un solo contexto de audio para toda la página. Los navegadores lo dejan sonar solo después de un toque. */
function audioContext(): AudioContext | null {
  try {
    if (!shared) {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      shared = new Ctx();
    }
    if (shared.state === 'suspended') void shared.resume();
    return shared;
  } catch {
    return null;
  }
}

/** Llamar una vez al cargar el panel: el primer toque o tecla «desbloquea» el sonido para los avisos. */
export function unlockAudioOnFirstInteraction() {
  const unlock = () => {
    audioContext();
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('keydown', unlock);
  };
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);
}

interface Note { freq: number; at: number; dur: number; type: OscillatorType; level?: number; glideTo?: number }

/** Notas de cada tono (segundos desde el inicio) y cuánto dura el tono completo. */
function notesFor(tone: ToneId): { notes: Note[]; length: number; noise?: { at: number; dur: number } } {
  switch (tone) {
    case 'alarma': {
      // Sirena de dos tonos, onda cuadrada: la más audible
      const notes: Note[] = [];
      for (let i = 0; i < 6; i++) notes.push({ freq: i % 2 ? 740 : 988, at: i * 0.16, dur: 0.15, type: 'square', level: 0.55 });
      return { notes, length: 1.0 };
    }
    case 'timbre':
      return { notes: [
        { freq: 659, at: 0, dur: 0.55, type: 'triangle', level: 1 }, { freq: 1318, at: 0, dur: 0.4, type: 'sine', level: 0.35 },
        { freq: 523, at: 0.5, dur: 0.8, type: 'triangle', level: 1 }, { freq: 1046, at: 0.5, dur: 0.6, type: 'sine', level: 0.35 },
      ], length: 1.35 };
    case 'caja':
      return { notes: [
        { freq: 1568, at: 0.12, dur: 0.25, type: 'triangle', level: 0.9 }, { freq: 2093, at: 0.2, dur: 0.6, type: 'triangle', level: 0.9 },
        { freq: 3136, at: 0.2, dur: 0.45, type: 'sine', level: 0.3 },
      ], noise: { at: 0, dur: 0.12 }, length: 0.85 };
    case 'campana':
      return { notes: [
        { freq: 880, at: 0, dur: 1.2, type: 'sine', level: 1 }, { freq: 1760, at: 0, dur: 0.8, type: 'sine', level: 0.4 },
        { freq: 2640, at: 0, dur: 0.5, type: 'sine', level: 0.2 },
      ], length: 1.2 };
    case 'suave':
      return { notes: [{ freq: 880, at: 0, dur: 0.35, type: 'sine', level: 0.6 }, { freq: 1320, at: 0.15, dur: 0.35, type: 'sine', level: 0.6 }], length: 0.55 };
    default:
      return { notes: [], length: 0 };
  }
}

/** Hace sonar un tono con el volumen (0–100) y las repeticiones indicadas. */
export function playTone(tone: ToneId, volume = 100, repeat = 1) {
  if (tone === 'silencio' || volume <= 0) return;
  const ctx = audioContext();
  if (!ctx) return;
  try {
    // Compresor + ganancia: suena fuerte sin distorsionar
    const master = ctx.createGain();
    master.gain.value = Math.min(1, volume / 100) * 0.9;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.ratio.value = 6;
    master.connect(comp).connect(ctx.destination);

    const { notes, length, noise } = notesFor(tone);
    const t0 = ctx.currentTime + 0.03;
    for (let r = 0; r < Math.max(1, Math.min(3, repeat)); r++) {
      const base = t0 + r * (length + 0.25);
      for (const n of notes) {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = n.type;
        osc.frequency.setValueAtTime(n.freq, base + n.at);
        if (n.glideTo) osc.frequency.linearRampToValueAtTime(n.glideTo, base + n.at + n.dur);
        const peak = n.level ?? 0.8;
        g.gain.setValueAtTime(0.0001, base + n.at);
        g.gain.exponentialRampToValueAtTime(peak, base + n.at + 0.01);
        g.gain.setValueAtTime(peak, base + n.at + Math.min(0.06, n.dur / 3));
        g.gain.exponentialRampToValueAtTime(0.0001, base + n.at + n.dur);
        osc.connect(g).connect(master);
        osc.start(base + n.at);
        osc.stop(base + n.at + n.dur + 0.05);
      }
      if (noise) {
        // Golpe metálico de la caja registradora
        const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * noise.dur), ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
        const src = ctx.createBufferSource();
        const filter = ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.value = 2500;
        src.buffer = buffer;
        src.connect(filter).connect(master);
        src.start(base + noise.at);
      }
    }
  } catch {
    // El navegador puede bloquear el sonido hasta que la persona toque la página
  }
}

/** Suena el aviso configurado para ese tipo de notificación. */
export function playNotification(event: SoundEvent) {
  const s = loadSoundSettings()[event];
  playTone(s.tone, s.volume, s.repeat);
}
