/**
 * Progreso y ajustes, en IndexedDB.
 *
 * Todo se mantiene también en memoria para que las vistas puedan leer sin esperar;
 * IndexedDB solo recibe las escrituras. Si falla (modo privado, almacenamiento
 * bloqueado) la app sigue funcionando, solo que sin recordar nada.
 */

import { emptyProgress, today } from './srs.js';

const DB = 'vocabulario';
const VERSION = 1;
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

function open() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in globalThis)) return reject(new Error('sin IndexedDB'));
    const req = indexedDB.open(DB, VERSION);
    req.onupgradeneeded = () => {
      const d = req.result;
      if (!d.objectStoreNames.contains('progress')) d.createObjectStore('progress');
      if (!d.objectStoreNames.contains('settings')) d.createObjectStore('settings');
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
    migrateLegacy();
  } catch {
    db = null;   // seguimos solo en memoria
  }
  return { progress, settings };
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
  return JSON.stringify({ version: 1, exportedAt: today(), progress, settings }, null, 2);
}
