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

import { limpiarNombre, SIEMBRA, type Lista } from './listas';
import { emptyProgress, today, type Progress, type Word } from './srs';
import type { AvanceTema } from './fusion';
import { PROGRESO_INICIAL } from './temas';
import type { Copia, Pendiente, Tocado } from './sync-copia';

const DB = 'vocabulario';
const VERSION = 5;

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
  /** Con qué modelo dibujar las palabras nuevas (#53). */
  modeloDibujo: 'haiku' | 'sonnet' | 'opus';
  theme: 'light' | 'dark';
  /** Cuando una traducción no coincide con lo guardado: preguntar si revisarla con la IA, o hacerlo sola (#114). */
  revisionIA: 'preguntar' | 'auto';
  /** La lista que se está repasando. null = todas. */
  lista: string | null;
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
  modeloDibujo: 'haiku',
  theme: 'dark',
  revisionIA: 'preguntar',
  lista: null,
};

type Almacen = 'progress' | 'settings' | 'words' | 'sync' | 'lists' | 'temas';

let db: IDBDatabase | null = null;
let progress: Record<string, Progress> = {};
let settings: Settings = { ...DEFAULTS };
let words: Record<string, Word> = {};
let lists: Record<string, Lista> = {};
/** Nivel y racha de cada tema (#70). */
let temas: Record<string, AvanceTema> = {};
/** Si ya se crearon las listas de partida. Aparte de `settings`, como `subidoA`. */
let listasSembradas = false;
/** A qué cuenta ya se subió este teléfono. Va aparte de `settings`: no es un ajuste, y no debe viajar en un export. */
let subidoA: string | null = null;

// Lo que la sincronización necesita recordar (ver lib/sync-copia.ts). Va en su
// propio almacén para no mezclarse con lo que se exporta.
let versiones: Record<string, string> = {};
let sucios: Record<string, true> = {};
let pendientes: Record<string, Pendiente> = {};
let listasVersiones: Record<string, string> = {};
let listasSucias: Record<string, true> = {};
let listasBorradas: Record<string, true> = {};
let temasVersiones: Record<string, string> = {};
let temasSucios: Record<string, true> = {};
let cursor: string | null = null;
let alCambiar: (() => void) | null = null;

const CLAVE_SUBIDO = '_subidoA';
const CLAVE_SEMBRADAS = '_listasSembradas';

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
      if (!d.objectStoreNames.contains('lists')) d.createObjectStore('lists');
      if (!d.objectStoreNames.contains('temas')) d.createObjectStore('temas');
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
    listasSembradas = guardados[CLAVE_SEMBRADAS] === true;
    delete guardados[CLAVE_SEMBRADAS];
    settings = { ...DEFAULTS, ...(guardados as Partial<Settings>) };
    words = await readAll<Word>('words');
    lists = await readAll<Lista>('lists');
    temas = await readAll<AvanceTema>('temas');
    cargarSync(await readAll<unknown>('sync'));
    adoptarTemasViejos();
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
    ...(w.svg ? { svg: w.svg } : {}),
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
  for (const l of Object.values(lists)) {
    if (l.words.includes(en)) guardarLista({ ...l, words: l.words.filter((x) => x !== en) });
  }
  marcarBaja(w ?? { en, es: en });
}

/* ── listas ───────────────────────────────────────────────────────────────── */

function guardarLista(l: Lista) {
  lists[l.id] = l;
  put('lists', l.id, l);
  listasSucias[l.id] = true;
  put('sync', `ld:${l.id}`, true);
  alCambiar?.();
}

export const allLists = (): Lista[] =>
  Object.values(lists).sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.name.localeCompare(b.name));

export function createList(name: string, words: string[] = []): Lista {
  const l: Lista = {
    id: crypto.randomUUID(),
    name: limpiarNombre(name),
    words,
    createdAt: new Date().toISOString(),
  };
  guardarLista(l);
  return l;
}

export function renameList(id: string, name: string) {
  if (lists[id]) guardarLista({ ...lists[id], name: limpiarNombre(name) });
}

export function deleteList(id: string) {
  delete lists[id];
  del('lists', id);
  delete listasSucias[id];
  del('sync', `ld:${id}`);
  listasBorradas[id] = true;
  put('sync', `lb:${id}`, true);
  alCambiar?.();
  if (settings.lista === id) set('lista', null);
}

/** Pone o quita una palabra de una lista. */
export function setWordInList(id: string, en: string, dentro: boolean) {
  const l = lists[id];
  if (!l || l.words.includes(en) === dentro) return;
  guardarLista({ ...l, words: dentro ? [...l.words, en] : l.words.filter((x) => x !== en) });
}

/**
 * Crea las tres listas de partida, una sola vez. Quien ya tiene listas (por
 * ejemplo porque importó un archivo) no las recibe, y quien las borra no las ve
 * volver: la marca de «ya sembradas» no depende de que sigan existiendo.
 */
export function sembrarListas(base: Word[]) {
  if (listasSembradas) return;
  listasSembradas = true;
  put('settings', CLAVE_SEMBRADAS, true);
  if (Object.keys(lists).length) return;
  const existentes = new Set(base.map((w) => w.en));
  for (const { name, words: ws } of SIEMBRA) {
    createList(name, ws.filter((en) => existentes.has(en)));
  }
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
  listasVersiones = {};
  listasSucias = {};
  listasBorradas = {};
  temasVersiones = {};
  temasSucios = {};
  cursor = typeof guardado.cursor === 'string' ? guardado.cursor : null;
  for (const [k, v] of Object.entries(guardado)) {
    if (k.startsWith('v:') && typeof v === 'string') versiones[k.slice(2)] = v;
    else if (k.startsWith('p:')) sucios[k.slice(2)] = true;
    else if (k.startsWith('w:')) pendientes[k.slice(2)] = v as Pendiente;
    else if (k.startsWith('lv:') && typeof v === 'string') listasVersiones[k.slice(3)] = v;
    else if (k.startsWith('ld:')) listasSucias[k.slice(3)] = true;
    else if (k.startsWith('lb:')) listasBorradas[k.slice(3)] = true;
    else if (k.startsWith('tv:') && typeof v === 'string') temasVersiones[k.slice(3)] = v;
    else if (k.startsWith('td:')) temasSucios[k.slice(3)] = true;
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
    listas: lists,
    listasVersiones,
    listasSucias,
    listasBorradas,
    temas,
    temasVersiones,
    temasSucios,
  };
}

export const haySincronizacionPendiente = (): boolean => contarPendientes() > 0;

/** Cuántos cambios guardados esperan subir (avances y palabras altas o bajas). */
export const contarPendientes = (): number =>
  new Set([
    ...Object.keys(sucios),
    ...Object.keys(pendientes),
    ...Object.keys(listasSucias).map((id) => `lista:${id}`),
    ...Object.keys(listasBorradas).map((id) => `lista:${id}`),
    ...Object.keys(temasSucios).map((id) => `tema:${id}`),
  ]).size;

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

  for (const id of tocado.listas) {
    if (lists[id]) put('lists', id, lists[id]);
    else del('lists', id);
  }
  for (const id of tocado.temas) {
    if (temas[id]) put('temas', id, temas[id]);
    else del('temas', id);
  }
  // Si la lista que se estaba repasando ya no existe (borrada desde otro
  // dispositivo, o fundida con otra), se vuelve a «todas».
  if (settings.lista && !lists[settings.lista]) set('lista', null);

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
    for (const [id, v] of Object.entries(listasVersiones)) o.put(v, `lv:${id}`);
    for (const id of Object.keys(listasSucias)) o.put(true, `ld:${id}`);
    for (const id of Object.keys(listasBorradas)) o.put(true, `lb:${id}`);
    for (const [id, v] of Object.entries(temasVersiones)) o.put(v, `tv:${id}`);
    for (const id of Object.keys(temasSucios)) o.put(true, `td:${id}`);
  } catch {
    /* la copia en memoria está bien; en el peor caso se vuelve a mandar */
  }
}

/* ── nivel de cada tema (#70) ─────────────────────────────────────────────── */

export const progresoTema = (id: string): AvanceTema => temas[id] ?? PROGRESO_INICIAL;

export function guardarProgresoTema(id: string, p: AvanceTema) {
  temas[id] = { nivel: p.nivel, racha: p.racha };
  put('temas', id, temas[id]);
  temasSucios[id] = true;
  put('sync', `td:${id}`, true);
  alCambiar?.();
}

/**
 * Antes de #70 el nivel vivía en localStorage (`tema:<id>`). Se adopta una vez y
 * se marca para subir; sin versión, el servidor lo trata como choque y gana el
 * nivel más alto, así que nunca se pierde lo ganado en otro aparato.
 */
function adoptarTemasViejos() {
  try {
    for (const k of Object.keys(localStorage)) {
      if (!k.startsWith('tema:')) continue;
      const id = k.slice(5);
      const p = JSON.parse(localStorage.getItem(k) ?? 'null');
      if (!temas[id] && p && Number.isInteger(p.nivel) && Number.isInteger(p.racha) && p.nivel >= 1 && p.racha >= 0) {
        guardarProgresoTema(id, { nivel: p.nivel, racha: p.racha });
      }
      // Solo se borra si ya quedó en IndexedDB; sin ella (modo privado) se deja.
      if (db) localStorage.removeItem(k);
    }
  } catch {
    // sin localStorage: no hay nada que adoptar
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
    { version: 3, exportedAt: today(), words: Object.values(words), progress, settings, lists: allLists() },
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
    for (const k of Object.keys(lists)) del('lists', k);
    for (const k of Object.keys(lists)) delete lists[k];
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
  for (const l of (data.lists || []) as Lista[]) {
    if (!l?.id || typeof l.name !== 'string' || !Array.isArray(l.words)) continue;
    const mismoNombre = Object.values(lists).find((x) => x.name.toLowerCase() === l.name.toLowerCase());
    if (lists[l.id] || mismoNombre) {
      // Ya la hay (por id o por nombre): se suman las palabras que le faltan.
      const destino = lists[l.id] ?? mismoNombre!;
      const nuevas = l.words.filter((en) => !destino.words.includes(en));
      if (nuevas.length) guardarLista({ ...destino, words: [...destino.words, ...nuevas] });
    } else {
      guardarLista({ id: l.id, name: limpiarNombre(l.name), words: l.words.map(String), createdAt: l.createdAt || new Date().toISOString() });
    }
  }
  for (const [k, v] of Object.entries((data.settings || {}) as Partial<Settings>)) {
    if (k in DEFAULTS) set(k as keyof Settings, v as never);
  }
  return { palabras, avances };
}
