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
import type { Copia, Pendiente, Tocado } from './sync-copia';

const DB = 'vocabulario';
const VERSION = 3;

export type Settings = {
  streak: number;
  lastDay: string | null;
  pause: number;
  withEx: boolean;
  audioOnly: boolean;
  voiceEn: string | null;
  voiceEs: string | null;
  /** Cuál de las voces grabadas usar. null = la de por defecto del índice. */
  voiceMp3: string | null;
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
  voiceMp3: null,
  theme: 'light',
};

type Almacen = 'progress' | 'settings' | 'words' | 'sync';

let db: IDBDatabase | null = null;
let progress: Record<string, Progress> = {};
let settings: Settings = { ...DEFAULTS };
let words: Record<string, Word> = {};
/** A qué cuenta ya se subió este teléfono. Va aparte de `settings`: no es un ajuste, y no debe viajar en un export. */
let subidoA: string | null = null;

// Lo que la sincronización necesita recordar (ver lib/sync-copia.ts). Va en su
// propio almacén para no mezclarse con lo que se exporta.
let versiones: Record<string, string> = {};
let sucios: Record<string, true> = {};
let pendientes: Record<string, Pendiente> = {};
let cursor: string | null = null;
let alCambiar: (() => void) | null = null;

const CLAVE_SUBIDO = '_subidoA';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('sin IndexedDB'));
    const req = indexedDB.open(DB, VERSION);
    req.onupgradeneeded = () => {
      const d = req.result;
      if (!d.objectStoreNames.contains('progress')) d.createObjectStore('progress');
      if (!d.objectStoreNames.contains('settings')) d.createObjectStore('settings');
      if (!d.objectStoreNames.contains('words')) d.createObjectStore('words');
      if (!d.objectStoreNames.contains('sync')) d.createObjectStore('sync');
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
    const guardados = (await readAll<unknown>('settings')) as Record<string, unknown>;
    subidoA = typeof guardados[CLAVE_SUBIDO] === 'string' ? (guardados[CLAVE_SUBIDO] as string) : null;
    delete guardados[CLAVE_SUBIDO];
    settings = { ...DEFAULTS, ...(guardados as Partial<Settings>) };
    words = await readAll<Word>('words');
    cargarSync(await readAll<unknown>('sync'));
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
  marcarAlta(word);
  return word;
}

export function deleteWord(en: string) {
  const w = words[en];
  delete words[en];
  del('words', en);
  delete progress[en];
  del('progress', en);
  marcarBaja(w ?? { en, es: en });
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
  marcarSucio(word);
}

export const allProgress = (): Record<string, Progress> => progress;

/** Reparto por cajas, para las barras de la pantalla de Inicio. */
export function boxCounts(deck: Word[]): number[] {
  const counts = new Array(5).fill(0);
  deck.forEach((w) => counts[progressOf(w.en).box - 1]++);
  return counts;
}

/* ── sincronización ───────────────────────────────────────────────────────── */

function cargarSync(guardado: Record<string, unknown>) {
  versiones = {};
  sucios = {};
  pendientes = {};
  cursor = typeof guardado.cursor === 'string' ? guardado.cursor : null;
  for (const [k, v] of Object.entries(guardado)) {
    if (k.startsWith('v:') && typeof v === 'string') versiones[k.slice(2)] = v;
    else if (k.startsWith('p:')) sucios[k.slice(2)] = true;
    else if (k.startsWith('w:')) pendientes[k.slice(2)] = v as Pendiente;
  }
}

function marcarSucio(en: string) {
  sucios[en] = true;
  put('sync', `p:${en}`, true);
  alCambiar?.();
}

function marcarAlta(word: Word) {
  pendientes[word.en] = { tipo: 'alta', word };
  put('sync', `w:${word.en}`, pendientes[word.en]);
  alCambiar?.();
}

function marcarBaja(word: Pick<Word, 'en' | 'es'>) {
  delete sucios[word.en];
  delete versiones[word.en];
  del('sync', `p:${word.en}`);
  del('sync', `v:${word.en}`);
  pendientes[word.en] = { tipo: 'baja', word: { en: word.en, es: word.es } };
  put('sync', `w:${word.en}`, pendientes[word.en]);
  alCambiar?.();
}

/** Para que quien orquesta la sincronización se entere de que hay algo que subir. */
export function suscribirCambios(fn: () => void): () => void {
  alCambiar = fn;
  return () => {
    if (alCambiar === fn) alCambiar = null;
  };
}

/**
 * La copia, por referencia: lo que la sincronización muta es el estado vivo del
 * almacén. Las únicas copias son los escalares (racha y cursor), que
 * `guardarSync` devuelve a su sitio.
 */
export function copiaSync(): Copia {
  return {
    words,
    progress,
    racha: { streak: settings.streak, lastDay: settings.lastDay },
    versiones,
    sucios,
    pendientes,
    cursor,
  };
}

export const haySincronizacionPendiente = (): boolean =>
  Object.keys(sucios).length > 0 || Object.keys(pendientes).length > 0;

/** Persiste lo que `aplicarRespuesta` cambió en la copia. */
export function guardarSync(c: Copia, tocado: Tocado) {
  cursor = c.cursor;
  if (c.racha.streak !== settings.streak) set('streak', c.racha.streak);
  if (c.racha.lastDay !== settings.lastDay) set('lastDay', c.racha.lastDay);

  for (const en of tocado.progress) {
    if (progress[en]) put('progress', en, progress[en]);
    else del('progress', en);
  }
  for (const en of tocado.words) {
    if (words[en]) put('words', en, words[en]);
    else del('words', en);
  }

  // Los marcadores se reescriben enteros, en una sola transacción: son pocos y
  // así no pueden quedar a medias entre sí.
  if (!db) return;
  try {
    const tx = db.transaction('sync', 'readwrite');
    const o = tx.objectStore('sync');
    o.clear();
    if (cursor) o.put(cursor, 'cursor');
    for (const [en, v] of Object.entries(versiones)) o.put(v, `v:${en}`);
    for (const en of Object.keys(sucios)) o.put(true, `p:${en}`);
    for (const [en, pend] of Object.entries(pendientes)) o.put(pend, `w:${en}`);
  } catch {
    /* la copia en memoria está bien; en el peor caso se vuelve a mandar */
  }
}

/* ── subir a la cuenta ────────────────────────────────────────────────────── */

export type Subida = {
  words: Word[];
  progress: Record<string, Progress>;
  streak: number;
  lastDay: string | null;
};

/**
 * Lo que este teléfono tiene y la cuenta quizá no. El progreso de una palabra
 * intacta no se sube: `progressOf` lo crea vacío en memoria al leerlo, y subir
 * miles de cajas 1 sin tocar solo ensucia la base.
 */
export function datosParaSubir(): Subida {
  const avance: Record<string, Progress> = {};
  for (const [en, p] of Object.entries(progress)) {
    if (p.seen > 0 || p.box > 1) avance[en] = p;
  }
  return {
    words: Object.values(words),
    progress: avance,
    streak: settings.streak,
    lastDay: settings.lastDay,
  };
}

export const haySubida = (d: Subida): boolean =>
  d.words.length > 0 || Object.keys(d.progress).length > 0 || d.streak > 0;

export const yaSubidoA = (cuenta: string): boolean => subidoA === cuenta;

export function marcarSubido(cuenta: string) {
  subidoA = cuenta;
  put('settings', CLAVE_SUBIDO, cuenta);
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
    for (const k of Object.keys(words)) {
      del('words', k);
      marcarBaja(words[k]);
    }
    for (const k of Object.keys(progress)) del('progress', k);
    // En el sitio, no reasignando: una sincronización en vuelo tiene
    // referencias a estos objetos y mutaría unos huérfanos.
    for (const k of Object.keys(words)) delete words[k];
    for (const k of Object.keys(progress)) delete progress[k];
  }

  let palabras = 0;
  let avances = 0;
  for (const w of (data.words || []) as Word[]) {
    if (!w?.en || !w?.es) continue;
    if (modo === 'merge' && words[w.en]) continue;
    words[w.en] = w;
    put('words', w.en, w);
    if (w.mine) marcarAlta(w);
    palabras++;
  }
  for (const [key, p] of Object.entries((data.progress || {}) as Record<string, Progress>)) {
    if (!p || typeof p.box !== 'number') continue;
    if (modo === 'merge' && progress[key] && progress[key].box >= p.box) continue;
    progress[key] = p;
    put('progress', key, p);
    marcarSucio(key);
    avances++;
  }
  for (const [k, v] of Object.entries((data.settings || {}) as Partial<Settings>)) {
    if (k in DEFAULTS) set(k as keyof Settings, v as never);
  }
  return { palabras, avances };
}
