/**
 * La copia en el teléfono de los ejercicios generados (#64), para practicar sin
 * señal. Va en su propia base de IndexedDB: no es parte de lo que sincroniza
 * `local-store` (aquí el servidor manda y el teléfono solo copia), así que no
 * toca su versión ni su cola de cambios.
 */

import type { Ejercicio } from './temas';

export type Guardado = {
  id: string;
  tema: string;
  nivel: number;
  datos: Ejercicio;
  updatedAt: string;
  deletedAt: string | null;
};

/** Lo que devuelve GET /api/temas/ejercicios. */
export type Recibido = Omit<Guardado, 'tema'> & { tipo?: string };

/** Aplica lo que llegó del servidor: lo nuevo entra, lo cambiado pisa, lo quitado sale. Puro. */
export function aplicarCambios(actual: Guardado[], tema: string, recibidos: Recibido[]): Guardado[] {
  const porId = new Map(actual.map((g) => [g.id, g]));
  for (const r of recibidos) {
    if (r.deletedAt) porId.delete(r.id);
    else porId.set(r.id, { id: r.id, tema, nivel: r.nivel, datos: r.datos, updatedAt: r.updatedAt, deletedAt: null });
  }
  return [...porId.values()];
}

/** El `desde` para la próxima descarga: lo más reciente que ya tenemos de ese tema. */
export const ultimaVersion = (recibidos: Recibido[], anterior: string | null): string | null =>
  recibidos.reduce<string | null>((m, r) => (m === null || r.updatedAt > m ? r.updatedAt : m), anterior);

const NOMBRE = 'vocab-temas';

function abrir(): Promise<IDBDatabase> {
  return new Promise((ok, mal) => {
    const req = indexedDB.open(NOMBRE, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore('ejercicios', { keyPath: 'id' });
      req.result.createObjectStore('meta');
    };
    req.onsuccess = () => ok(req.result);
    req.onerror = () => mal(req.error);
  });
}

const pedir = <T>(r: IDBRequest<T>): Promise<T> =>
  new Promise((ok, mal) => {
    r.onsuccess = () => ok(r.result);
    r.onerror = () => mal(r.error);
  });

/** Los ejercicios generados que hay en el teléfono para un tema. */
export async function guardados(tema: string): Promise<Guardado[]> {
  const db = await abrir();
  const todos = await pedir<Guardado[]>(db.transaction('ejercicios').objectStore('ejercicios').getAll());
  db.close();
  return todos.filter((g) => g.tema === tema);
}

const marcar = (id: string, quitado: boolean) =>
  fetch('/api/temas/ejercicios', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ id, quitado }),
  }).then((r) => {
    if (!r.ok) throw new Error(`Quitar ${r.status}`);
  });

/**
 * Quita un ejercicio del teléfono y avisa a la cuenta. Sin señal queda anotado en
 * `meta` y se manda en la próxima descarga. Devuelve lo quitado, para poder devolverlo.
 */
export async function quitar(id: string): Promise<Guardado | null> {
  const db = await abrir();
  try {
    const g = (await pedir(db.transaction('ejercicios').objectStore('ejercicios').get(id))) as Guardado | undefined;
    if (!g) return null;
    const tx = db.transaction(['ejercicios', 'meta'], 'readwrite');
    tx.objectStore('ejercicios').delete(id);
    tx.objectStore('meta').put(true, `quitar:${id}`);
    await new Promise<void>((ok, mal) => {
      tx.oncomplete = () => ok();
      tx.onerror = () => mal(tx.error);
    });
    await enviarPendientes(db);
    return g;
  } finally {
    db.close();
  }
}

/** Deshace `quitar`: lo vuelve a guardar y lo devuelve a la cuenta. */
export async function devolver(g: Guardado): Promise<void> {
  const db = await abrir();
  try {
    const tx = db.transaction(['ejercicios', 'meta'], 'readwrite');
    tx.objectStore('ejercicios').put(g);
    tx.objectStore('meta').delete(`quitar:${g.id}`);
    await new Promise<void>((ok, mal) => {
      tx.oncomplete = () => ok();
      tx.onerror = () => mal(tx.error);
    });
    // Si el aviso de quitado nunca salió, no hay nada que deshacer allá.
    await marcar(g.id, false).catch(() => {});
  } finally {
    db.close();
  }
}

/** Manda a la cuenta los quitados que no pudieron salir. Sin señal, se queda anotado. */
async function enviarPendientes(db: IDBDatabase) {
  const claves = (await pedir(db.transaction('meta').objectStore('meta').getAllKeys())) as string[];
  for (const k of claves.filter((c) => String(c).startsWith('quitar:'))) {
    try {
      await marcar(String(k).slice(7), true);
      db.transaction('meta', 'readwrite').objectStore('meta').delete(k);
    } catch {
      return; // sin señal o error: queda para la próxima
    }
  }
}

/**
 * Baja de la cuenta lo que cambió desde la última vez y lo guarda. Devuelve cuántos
 * cambios trajo. Falla si no hay señal: quien llama decide si le importa.
 */
export async function descargar(tema: string): Promise<number> {
  const db = await abrir();
  try {
    await enviarPendientes(db);
    const desde = (await pedir(db.transaction('meta').objectStore('meta').get(`desde:${tema}`))) as string | undefined;
    const url = `/api/temas/ejercicios?tema=${encodeURIComponent(tema)}${desde ? `&desde=${encodeURIComponent(desde)}` : ''}`;
    const r = await fetch(url);
    if (!r.ok) throw new Error(`Descarga ${r.status}`);
    const { ejercicios } = (await r.json()) as { ejercicios: Recibido[] };
    if (!ejercicios.length) return 0;

    const actual = (await pedir<Guardado[]>(db.transaction('ejercicios').objectStore('ejercicios').getAll())).filter(
      (g) => g.tema === tema
    );
    const nuevo = aplicarCambios(actual, tema, ejercicios);
    const tx = db.transaction(['ejercicios', 'meta'], 'readwrite');
    const alm = tx.objectStore('ejercicios');
    for (const g of actual) if (!nuevo.some((n) => n.id === g.id)) alm.delete(g.id);
    for (const g of nuevo) alm.put(g);
    tx.objectStore('meta').put(ultimaVersion(ejercicios, desde ?? null), `desde:${tema}`);
    await new Promise<void>((ok, mal) => {
      tx.oncomplete = () => ok();
      tx.onerror = () => mal(tx.error);
    });
    return ejercicios.length;
  } finally {
    db.close();
  }
}
