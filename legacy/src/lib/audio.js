/**
 * Voz.
 *
 * Prefiere un MP3 pregenerado si existe (ver scripts/generate-audio.mjs) y cae a la
 * Web Speech API si no. Los MP3 suenan mejor, van en el caché del service worker y,
 * sobre todo, siguen sonando con la pantalla bloqueada — que es lo que el Modo camino
 * necesita y `speechSynthesis` no puede dar en iOS.
 */

import * as store from './store.js';

/* ── elegir voz ───────────────────────────────────────────────────────────────
   El primer `en-US` que devuelve el navegador suele ser el peor: en macOS la lista
   empieza por voces de novedad y por versiones "compact". Por eso se puntúan. */

const NOVELTY = /albert|bad news|bahh|bells|boing|bubbles|cellos|deranged|good news|hysterical|jester|junior|kathy|organ|pipe|princess|ralph|superstar|trinoids|whisper|wobble|zarvox|eloquence|espeak|festival/i;

export function rankVoice(v) {
  const n = (v.name || '').toLowerCase();
  if (NOVELTY.test(n)) return -500;
  let s = /^en[-_]US/i.test(v.lang) ? 10 : 4;
  if (n.includes('google')) s += 60;
  if (/natural|neural|premium|enhanced/.test(n)) s += 55;
  if (/siri|samantha|ava|allison|joanna|aria|jenny|guy|sonia|libby/.test(n)) s += 35;
  if (v.localService === false) s += 25;
  if (/compact/.test(n)) s -= 70;
  return s;
}

function rankEs(v) {
  const n = (v.name || '').toLowerCase();
  let s = /^es[-_](MX|US|419)/i.test(v.lang) ? 10 : 4;
  if (/google|natural|neural|enhanced|premium|paulina|mónica|monica/.test(n)) s += 40;
  if (v.localService === false) s += 20;
  return s;
}

export const voices = { en: [], es: [] };
let chosen = { en: null, es: null };
const listeners = new Set();

export const onVoicesChanged = fn => { listeners.add(fn); return () => listeners.delete(fn); };

export function refreshVoices() {
  if (!('speechSynthesis' in window)) return;
  const all = speechSynthesis.getVoices();
  voices.en = all.filter(v => /^en[-_]/i.test(v.lang) && rankVoice(v) > -100)
                 .sort((a, b) => rankVoice(b) - rankVoice(a));
  voices.es = all.filter(v => /^es[-_]/i.test(v.lang))
                 .sort((a, b) => rankEs(b) - rankEs(a));
  chosen.en = voices.en.find(v => v.name === store.get('voiceEn')) || voices.en[0] || null;
  chosen.es = voices.es.find(v => v.name === store.get('voiceEs')) || voices.es[0] || null;
  listeners.forEach(fn => fn());
}

export function chooseVoice(lang, name) {
  store.set(lang === 'es' ? 'voiceEs' : 'voiceEn', name);
  refreshVoices();
}

export const currentVoice = lang => chosen[lang];

export function voiceSupport() {
  if (!('speechSynthesis' in window)) return 'none';
  if (speechSynthesis.getVoices().length && !voices.en.length) return 'no-english';
  return 'ok';
}

/* ── MP3 pregenerados ─────────────────────────────────────────────────────────
   `scripts/generate-audio.mjs` escribe public/audio/<clave>.mp3 y un índice.
   Si el índice no existe la app funciona igual, solo que sintetizando. */

let manifest = null;
export async function loadAudioManifest() {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}audio/index.json`);
    if (res.ok) manifest = await res.json();
  } catch { manifest = null; }
  return manifest;
}

const trackKey = (word, part) => `${word}::${part}`;
const trackUrl = (word, part) => {
  const file = manifest && manifest[trackKey(word, part)];
  return file ? `${import.meta.env.BASE_URL}audio/${file}` : null;
};

/* ── reproducir ───────────────────────────────────────────────────────────── */

let el = null;          // el <audio> compartido: uno solo, para que MediaSession lo siga
let stopFlag = 0;       // cada stop() invalida lo que estuviera en curso

function audioEl() {
  if (!el) {
    el = new Audio();
    el.preload = 'auto';
  }
  return el;
}

export function stop() {
  stopFlag++;
  try { speechSynthesis.cancel(); } catch { /* vacío */ }
  if (el) { el.pause(); try { el.currentTime = 0; } catch { /* vacío */ } }
}

/**
 * Dice un texto y resuelve cuando termina.
 * @param {string} text  lo que se dice
 * @param {'en'|'es'} lang
 * @param {{rate?:number, word?:string, part?:string}} opts
 *        `word` y `part` permiten buscar el MP3; sin ellos siempre sintetiza.
 */
export function say(text, lang = 'en', opts = {}) {
  const token = stopFlag;
  const rate = opts.rate ?? 0.95;
  const url = opts.word ? trackUrl(opts.word, opts.part || lang) : null;

  if (url) {
    return new Promise(resolve => {
      const a = audioEl();
      const done = () => {
        a.onended = a.onerror = null;
        resolve();
      };
      a.onended = done;
      a.onerror = () => { done(); };   // si el MP3 falla, no bloqueamos la cadena
      a.src = url;
      a.playbackRate = rate < 0.8 ? 0.7 : 1;   // "Despacio" con un MP3 suena mejor así
      a.play().catch(() => done());
      if (token !== stopFlag) done();
    });
  }

  return new Promise(resolve => {
    if (!text || !('speechSynthesis' in window)) return setTimeout(resolve, 600);
    let fired = false;
    const fin = () => { if (!fired) { fired = true; resolve(); } };
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      const v = chosen[lang];
      u.lang = v ? v.lang : (lang === 'es' ? 'es-MX' : 'en-US');
      if (v) u.voice = v;
      u.rate = rate;
      u.onend = fin;
      u.onerror = fin;
      speechSynthesis.speak(u);
      // Red de seguridad: `onend` no siempre se dispara y dejaría el bucle colgado.
      setTimeout(fin, 2600 + text.length * 130);
    } catch { setTimeout(fin, 600); }
  });
}

/** Para que el Modo camino aparezca en la pantalla de bloqueo y en los auriculares. */
export function setNowPlaying(word, handlers = {}) {
  if (!('mediaSession' in navigator)) return;
  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: word.en,
      artist: word.es,
      album: 'Vocabulario en Ruta'
    });
    for (const [action, fn] of Object.entries(handlers)) {
      try { navigator.mediaSession.setActionHandler(action, fn); } catch { /* no soportada */ }
    }
  } catch { /* vacío */ }
}

export function setPlaybackState(state) {
  if ('mediaSession' in navigator) {
    try { navigator.mediaSession.playbackState = state; } catch { /* vacío */ }
  }
}
