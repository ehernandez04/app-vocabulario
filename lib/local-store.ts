/**
 * Progreso, ajustes y palabras propias, en IndexedDB.
 *
 * Portado de legacy/src/lib/store.js. Mantiene su idea central: todo se
 * refleja en memoria para que las vistas lean sin esperar, y IndexedDB solo
 * recibe las escrituras. Si falla —modo privado, almacenamiento bloqueado— la
 * app sigue funcionando, solo que sin recordar nada entre sesiones.
 *
 * A partir de la etapa 3 esto deja de ser el almacén y pasa a ser la copia
 * local: la fuente de verdad será Postgres y esto lo que permite repasar en el
 * metro sin señal.
 *
 * No se porta la migración desde el localStorage del prototipo viejo: aquella
 * vivía en otro origen y nunca llegó a desplegarse, así que acá sería código
 * muerto desde el primer día.
 */

import { emptyProgress, today, type Progress, type Word } from './srs';

const DB = 'vocabulario';
const VERSION = 2;

export type Settings = {
  streak: number;
  lastDay: string | null;
  pause: number;
  withEx: boolean;
  audioOnly: boolean;
  voiceEn: string | null;
  voiceEs: string | null;
  theme: 'light' | 'dark';
};

export const DEFAULTS: Settings = {
  streak: 0,
  lastDay: null,
  pause: 5,
  withEx: false,
  audioOnly: false,
  voiceEn: null,
  voiceEs: null,
  theme: 'light',
};

type Almacen = 'progress' | 'settings' | 'words';

let db: IDBDatabase | null = null;
let progress: Record<string, Progress> = {};
let settings: Settings = { ...DEFAULTS };
let words: Record<string, Word> = {};

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('sin IndexedDB'));
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

function readAll<T>(store: Almacen): Promise<Record<string, T>> {
  return new Promise((resolve) => {
    const out: Record<string, T> = {};
    if (!db) return resolve(out);
    try {
      const tx = db.transaction(store, 'readonly');
      const cur = tx.objectStore(store).openCursor();
      cur.onsuccess = () => {
        const c = cur.result;
        if (!c) return resolve(out);
        out[String(c.key)] = c.value as T;
        c.continue();
      };
      cur.onerror = () => resolve(out);
    } catch {
      resolve(out);
    }
  });
}

function put(store: Almacen, key: string, value: unknown) {
  if (!db) return;
  try {
    db.transaction(store, 'readwrite').objectStore(store).put(value, key);
  } catch {
    /* el estado en memoria ya está bien; perder la escritura no rompe la sesión */
  }
}

function del(store: Almacen, key: string) {
  if (!db) return;
  try {
    db.transaction(store, 'readwrite').objectStore(store).delete(key);
  } catch {
    /* igual que arriba */
  }
}

export async function init() {
  try {
    db = await open();
    progress = await readAll<Progress>('progress');
    settings = { ...DEFAULTS, ...(await readAll<never>('settings') as Partial<Settings>) };
    words = await readAll<Word>('words');
  } catch {
    db = null; // seguimos solo en memoria
  }
  return { progress, settings, words };
}

/* ── palabras propias ─────────────────────────────────────────────────────── */

/** El mazo completo: las de fábrica más las tuyas, sin repetir. */
export function fullDeck(base: Word[]): Word[] {
  const mias = Object.values(words).sort((a, b) =>
    (a.addedAt || '').localeCompare(b.addedAt || '')
  );
  const tomadas = new Set(base.map((w) => w.en.toLowerCase()));
  return base.concat(mias.filter((w) => !tomadas.has(w.en.toLowerCase())));
}

export const userWords = (): Word[] => Object.values(words);

export const hasWord = (base: Word[], en: string): boolean =>
  base.some((w) => w.en.toLowerCase() === en.toLowerCase()) ||
  Object.keys(words).some((k) => k.toLowerCase() === en.toLowerCase());

export function addWord(w: Word): Word {
  const word: Word = {
    en: w.en.trim(),
    es: w.es.trim(),
    ipa: (w.ipa || '').trim(),
    emoji: (w.emoji || '').trim() || '📝',
    xe: (w.xe || '').trim(),
    xs: (w.xs || '').trim(),
    // img se conserva: es lo que permite que una palabra traiga ilustración
    // propia en vez de emoji. En legacy el formulario lo descartaba.
    ...(w.img ? { img: w.img } : {}),
    mine: true,
    addedAt: new Date().toISOString(),
  };
  words[word.en] = word;
  put('words', word.en, word);
  return word;
}

export function deleteWord(en: string) {
  delete words[en];
  del('words', en);
  delete progress[en];
  del('progress', en);
}

/* ── ajustes y progreso ───────────────────────────────────────────────────── */

export const get = <K extends keyof Settings>(key: K): Settings[K] => settings[key];

export function set<K extends keyof Settings>(key: K, value: Settings[K]) {
  settings[key] = value;
  put('settings', key, value);
}

export const allSettings = (): Settings => ({ ...settings });

export function progressOf(word: string): Progress {
  return progress[word] || (progress[word] = emptyProgress());
}

export function saveProgress(word: string, p: Progress) {
  progress[word] = p;
  put('progress', word, p);
}

export const allProgress = (): Record<string, Progress> => progress;

/** Reparto por cajas, para las barras de la pantalla de Inicio. */
export function boxCounts(deck: Word[]): number[] {
  const counts = new Array(5).fill(0);
  deck.forEach((w) => counts[progressOf(w.en).box - 1]++);
  return counts;
}

/* ── exportar e importar ──────────────────────────────────────────────────── */

export function exportAll(): string {
  return JSON.stringify(
    { version: 2, exportedAt: today(), words: Object.values(words), progress, settings },
    null,
    2
  );
}

/**
 * Importa un JSON exportado antes.
 * Al fusionar gana la caja más alta: nunca hacemos retroceder lo ya aprendido.
 * Esta misma regla es la que usará la sincronización de la etapa 3.
 */
export function importAll(text: string, modo: 'merge' | 'replace' = 'merge') {
  const data = JSON.parse(text);
  if (!data || typeof data !== 'object') {
    throw new Error('El archivo no tiene el formato esperado');
  }

  if (modo === 'replace') {
    for (const k of Object.keys(words)) del('words', k);
    for (const k of Object.keys(progress)) del('progress', k);
    words = {};
    progress = {};
  }

  let palabras = 0;
  let avances = 0;
  for (const w of (data.words || []) as Word[]) {
    if (!w?.en || !w?.es) continue;
    if (modo === 'merge' && words[w.en]) continue;
    words[w.en] = w;
    put('words', w.en, w);
    palabras++;
  }
  for (const [key, p] of Object.entries((data.progress || {}) as Record<string, Progress>)) {
    if (!p || typeof p.box !== 'number') continue;
    if (modo === 'merge' && progress[key] && progress[key].box >= p.box) continue;
    progress[key] = p;
    put('progress', key, p);
    avances++;
  }
  for (const [k, v] of Object.entries((data.settings || {}) as Partial<Settings>)) {
    if (k in DEFAULTS) set(k as keyof Settings, v as never);
  }
  return { palabras, avances };
}
