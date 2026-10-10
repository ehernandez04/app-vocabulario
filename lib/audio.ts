/**
 * Voz. Portado de legacy/src/lib/audio.js.
 *
 * Prefiere un MP3 pregenerado si existe y cae a la Web Speech API si no. Los
 * MP3 suenan mejor, van en el caché del service worker y, sobre todo, siguen
 * sonando con la pantalla bloqueada — que es lo que el Modo camino necesita y
 * `speechSynthesis` no puede dar en iOS.
 */

import * as store from './local-store';
import type { Word } from './srs';

export type Idioma = 'en' | 'es';

/* ── elegir voz ───────────────────────────────────────────────────────────────
   El primer `en-US` que devuelve el navegador suele ser el peor: en macOS la
   lista empieza por voces de novedad y por versiones "compact". Por eso se
   puntúan en vez de tomar la primera. */

const NOVEDAD =
  /albert|bad news|bahh|bells|boing|bubbles|cellos|deranged|good news|hysterical|jester|junior|kathy|organ|pipe|princess|ralph|superstar|trinoids|whisper|wobble|zarvox|eloquence|espeak|festival/i;

export function rankVoice(v: SpeechSynthesisVoice): number {
  const n = (v.name || '').toLowerCase();
  if (NOVEDAD.test(n)) return -500;
  let s = /^en[-_]US/i.test(v.lang) ? 10 : 4;
  if (n.includes('google')) s += 60;
  if (/natural|neural|premium|enhanced/.test(n)) s += 55;
  if (/siri|samantha|ava|allison|joanna|aria|jenny|guy|sonia|libby/.test(n)) s += 35;
  if (v.localService === false) s += 25;
  if (/compact/.test(n)) s -= 70;
  return s;
}

export function rankVoiceEs(v: SpeechSynthesisVoice): number {
  const n = (v.name || '').toLowerCase();
  let s = /^es[-_](MX|US|419)/i.test(v.lang) ? 10 : 4;
  if (/google|natural|neural|enhanced|premium|paulina|mónica|monica/.test(n)) s += 40;
  if (v.localService === false) s += 20;
  return s;
}

export const voices: Record<Idioma, SpeechSynthesisVoice[]> = { en: [], es: [] };
const elegidas: Record<Idioma, SpeechSynthesisVoice | null> = { en: null, es: null };
const oyentes = new Set<() => void>();

/** Las voces cargan en asíncrono: hay que escuchar, no fiarse del primer getVoices(). */
export const onVoicesChanged = (fn: () => void) => {
  oyentes.add(fn);
  return () => oyentes.delete(fn);
};

export function refreshVoices() {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  const todas = speechSynthesis.getVoices();
  voices.en = todas
    .filter((v) => /^en[-_]/i.test(v.lang) && rankVoice(v) > -100)
    .sort((a, b) => rankVoice(b) - rankVoice(a));
  voices.es = todas.filter((v) => /^es[-_]/i.test(v.lang)).sort((a, b) => rankVoiceEs(b) - rankVoiceEs(a));
  elegidas.en = voices.en.find((v) => v.name === store.get('voiceEn')) || voices.en[0] || null;
  elegidas.es = voices.es.find((v) => v.name === store.get('voiceEs')) || voices.es[0] || null;
  oyentes.forEach((fn) => fn());
}

/** Se llama una vez al arrancar: engancha el evento y pide la primera lista. */
export function initVoices() {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  speechSynthesis.addEventListener('voiceschanged', refreshVoices);
  refreshVoices();
}

export function chooseVoice(lang: Idioma, name: string) {
  store.set(lang === 'es' ? 'voiceEs' : 'voiceEn', name);
  refreshVoices();
}

export const currentVoice = (lang: Idioma) => elegidas[lang];

export function voiceSupport(): 'none' | 'no-english' | 'ok' {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return 'none';
  if (speechSynthesis.getVoices().length && !voices.en.length) return 'no-english';
  return 'ok';
}

/* ── MP3 pregenerados ─────────────────────────────────────────────────────────
   Si el índice no existe la app funciona igual, solo que sintetizando. A partir
   de la etapa 5 el índice lo sirve la API, no un archivo estático.

   El índice está organizado por voz: `pnpm audio <voz>` agrega un juego sin
   tocar los anteriores, y eso es lo que permite ofrecerlas a elegir acá. */

export type VozGrabada = { clave: string; nombre: string };

type Manifiesto = {
  porDefecto: string;
  voces: Record<string, { nombre: string; pistas: Record<string, string> }>;
};

let manifiesto: Manifiesto | null = null;

export async function loadAudioManifest() {
  try {
    const res = await fetch('/audio/index.json');
    if (res.ok) manifiesto = await res.json();
  } catch {
    manifiesto = null;
  }
  return manifiesto;
}

/** Las voces grabadas disponibles. Vacío si todavía no se generó ninguna. */
export function recordedVoices(): VozGrabada[] {
  if (!manifiesto) return [];
  return Object.entries(manifiesto.voces).map(([clave, v]) => ({ clave, nombre: v.nombre }));
}

function vozActiva() {
  if (!manifiesto) return null;
  const elegida = store.get('voiceMp3');
  if (elegida && manifiesto.voces[elegida]) return manifiesto.voces[elegida];
  return manifiesto.voces[manifiesto.porDefecto] ?? null;
}

const urlTrack = (word: string, part: string) => {
  const file = vozActiva()?.pistas[`${word}::${part}`];
  return file ? `/audio/${file}` : null;
};

/* ── reproducir ───────────────────────────────────────────────────────────── */

let el: HTMLAudioElement | null = null; // uno solo y compartido, para que MediaSession lo siga
let stopFlag = 0; // cada stop() invalida lo que estuviera en curso

function audioEl() {
  if (!el) {
    el = new Audio();
    el.preload = 'auto';
  }
  return el;
}

export function stop() {
  stopFlag++;
  try {
    speechSynthesis.cancel();
  } catch {
    /* vacío */
  }
  if (el) {
    el.pause();
    try {
      el.currentTime = 0;
    } catch {
      /* vacío */
    }
  }
}

type OpcionesDecir = { rate?: number; word?: string; part?: string };

/**
 * Dice un texto y resuelve cuando termina. `word` y `part` permiten buscar el
 * MP3; sin ellos siempre sintetiza.
 */
export function say(text: string, lang: Idioma = 'en', opts: OpcionesDecir = {}): Promise<void> {
  const token = stopFlag;
  const rate = opts.rate ?? 0.95;
  const url = opts.word ? urlTrack(opts.word, opts.part || lang) : null;

  if (url) {
    return new Promise((resolve) => {
      const a = audioEl();
      const listo = () => {
        a.onended = null;
        a.onerror = null;
        resolve();
      };
      a.onended = listo;
      a.onerror = listo; // si el MP3 falla, no bloqueamos la cadena
      a.src = url;
      a.playbackRate = rate < 0.8 ? 0.7 : 1; // "Despacio" con un MP3 suena mejor así
      a.play().catch(() => listo());
      if (token !== stopFlag) listo();
    });
  }

  return new Promise((resolve) => {
    if (!text || typeof window === 'undefined' || !('speechSynthesis' in window)) {
      setTimeout(resolve, 600);
      return;
    }
    let disparado = false;
    const fin = () => {
      if (!disparado) {
        disparado = true;
        resolve();
      }
    };
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      const v = elegidas[lang];
      u.lang = v ? v.lang : lang === 'es' ? 'es-MX' : 'en-US';
      if (v) u.voice = v;
      u.rate = rate;
      u.onend = fin;
      u.onerror = fin;
      speechSynthesis.speak(u);
      // Red de seguridad: `onend` no siempre se dispara y dejaría el bucle colgado.
      setTimeout(fin, 2600 + text.length * 130);
    } catch {
      setTimeout(fin, 600);
    }
  });
}

/* ── pantalla de bloqueo ──────────────────────────────────────────────────── */

type Manejadores = Partial<Record<MediaSessionAction, () => void>>;

/** Para que el Modo camino aparezca en la pantalla de bloqueo y en los auriculares. */
export function setNowPlaying(word: Word, handlers: Manejadores = {}) {
  if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: word.en,
      artist: word.es,
      album: 'Vocabulario en Ruta',
    });
    for (const [accion, fn] of Object.entries(handlers)) {
      try {
        navigator.mediaSession.setActionHandler(accion as MediaSessionAction, fn as () => void);
      } catch {
        /* esa acción no la soporta el navegador */
      }
    }
  } catch {
    /* vacío */
  }
}

export function setPlaybackState(state: MediaSessionPlaybackState) {
  if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
    try {
      navigator.mediaSession.playbackState = state;
    } catch {
      /* vacío */
    }
  }
}
