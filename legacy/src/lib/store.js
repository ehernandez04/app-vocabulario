/**
 * Progreso y ajustes, en IndexedDB.
 *
 * Todo se mantiene también en memoria para que las vistas puedan leer sin esperar;
 * IndexedDB solo recibe las escrituras. Si falla (modo privado, almacenamiento
 * bloqueado) la app sigue funcionando, solo que sin recordar nada.
 */

import { emptyProgress, today } from './srs.js';

const DB = 'vocabulario';
const VERSION = 2;   // v2 añade el almacén `words`, para las palabras que agrega el usuario
const LEGACY_KEY = 'vocabruta.v2';   // el prototipo guardaba aquí, en localStorage

const DEFAULTS = {
  streak: 0,
  lastDay: null,
  pause: 5,
  withEx: false,
  audioOnly: false,
  voiceEn: null,
  voiceEs: null,
  theme: 'light'
};

let db = null;
let progress = {};
let settings = { ...DEFAULTS };
let words = {};        // las que agrega el usuario, por palabra en inglés

function open() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in globalThis)) return reject(new Error('sin IndexedDB'));
    const req = indexedDB.open(DB, VERSION);
    req.onupgradeneeded = () => {
      const d = req.result;
      if (!d.objectStoreNames.contains('progress')) d.createObjectStore('progress');
      if (!d.objectStoreNames.contains('settings')) d.createObjectStore('settings');
      if (!d.objectStoreNames.contains('words')) d.createObjectStore('words');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function readAll(store) {
  return new Promise(resolve => {
    const out = {};
    try {
      const tx = db.transaction(store, 'readonly');
      const cur = tx.objectStore(store).openCursor();
      cur.onsuccess = () => {
        const c = cur.result;
        if (!c) return resolve(out);
        out[c.key] = c.value;
        c.continue();
      };
      cur.onerror = () => resolve(out);
    } catch { resolve(out); }
  });
}

function put(store, key, value) {
  if (!db) return;
  try {
    db.transaction(store, 'readwrite').objectStore(store).put(value, key);
  } catch { /* el estado en memoria ya está bien; perder la escritura no rompe la sesión */ }
}

function del(store, key) {
  if (!db) return;
  try {
    db.transaction(store, 'readwrite').objectStore(store).delete(key);
  } catch { /* igual que arriba */ }
}

/** Trae lo que el prototipo hubiera dejado en localStorage. Se hace una sola vez. */
function migrateLegacy() {
  let raw;
  try { raw = localStorage.getItem(LEGACY_KEY); } catch { return; }
  if (!raw) return;
  try {
    const old = JSON.parse(raw);
    for (const [word, p] of Object.entries(old.prog || {})) {
      if (!progress[word]) { progress[word] = p; put('progress', word, p); }
    }
    for (const k of ['pause', 'withEx', 'audioOnly', 'voiceEn', 'voiceEs', 'theme']) {
      if (old[k] !== undefined && settings[k] === DEFAULTS[k]) set(k, old[k]);
    }
    localStorage.removeItem(LEGACY_KEY);
  } catch { /* si el JSON viejo está roto, se ignora */ }
}

export async function init() {
  try {
    db = await open();
    progress = await readAll('progress');
    settings = { ...DEFAULTS, ...(await readAll('settings')) };
    words = await readAll('words');
    migrateLegacy();
  } catch {
    db = null;   // seguimos solo en memoria
  }
  return { progress, settings, words };
}

/* ── palabras propias ─────────────────────────────────────────────────────── */

/** El mazo completo: las de fábrica más las tuyas, sin repetir. */
export function fullDeck(base) {
  const mine = Object.values(words).sort((a, b) => (a.addedAt || '').localeCompare(b.addedAt || ''));
  const taken = new Set(base.map(w => w.en.toLowerCase()));
  return base.concat(mine.filter(w => !taken.has(w.en.toLowerCase())));
}

export const userWords = () => Object.values(words);

export const hasWord = (base, en) =>
  base.some(w => w.en.toLowerCase() === en.toLowerCase()) ||
  Object.keys(words).some(k => k.toLowerCase() === en.toLowerCase());

export function addWord(w) {
  const word = {
    en: w.en.trim(),
    es: w.es.trim(),
    ipa: (w.ipa || '').trim(),
    emoji: (w.emoji || '').trim() || '📝',
    xe: (w.xe || '').trim(),
    xs: (w.xs || '').trim(),
    mine: true,
    addedAt: new Date().toISOString()
  };
  words[word.en] = word;
  put('words', word.en, word);
  return word;
}

export function deleteWord(en) {
  delete words[en];
  del('words', en);
  delete progress[en];
  del('progress', en);
}

export const get = key => settings[key];

export function set(key, value) {
  settings[key] = value;
  put('settings', key, value);
}

export function progressOf(word) {
  return progress[word] || (progress[word] = emptyProgress());
}

export function saveProgress(word, p) {
  progress[word] = p;
  put('progress', word, p);
}

export const allProgress = () => progress;

/** Reparto por cajas, para las barras de la pantalla de Inicio. */
export function boxCounts(deck) {
  const counts = new Array(5).fill(0);
  deck.forEach(w => counts[progressOf(w.en).box - 1]++);
  return counts;
}

export function exportAll() {
  return JSON.stringify(
    { version: 2, exportedAt: today(), words: Object.values(words), progress, settings },
    null, 2);
}

/**
 * Importa un JSON exportado antes.
 * @param {string} text
 * @param {'merge'|'replace'} modo  fusionar conserva lo que ya hay y gana lo más avanzado
 */
export function importAll(text, modo = 'merge') {
  const data = JSON.parse(text);
  if (!data || typeof data !== 'object') throw new Error('El archivo no tiene el formato esperado');

  if (modo === 'replace') {
    for (const k of Object.keys(words)) del('words', k);
    for (const k of Object.keys(progress)) del('progress', k);
    words = {};
    progress = {};
  }

  let palabras = 0, avances = 0;
  for (const w of data.words || []) {
    if (!w?.en || !w?.es) continue;
    if (modo === 'merge' && words[w.en]) continue;
    words[w.en] = w;
    put('words', w.en, w);
    palabras++;
  }
  for (const [key, p] of Object.entries(data.progress || {})) {
    if (!p || typeof p.box !== 'number') continue;
    // Al fusionar gana la caja más alta: nunca hacemos retroceder lo ya aprendido.
    if (modo === 'merge' && progress[key] && progress[key].box >= p.box) continue;
    progress[key] = p;
    put('progress', key, p);
    avances++;
  }
  for (const [k, v] of Object.entries(data.settings || {})) {
    if (k in DEFAULTS) set(k, v);
  }
  return { palabras, avances };
}
