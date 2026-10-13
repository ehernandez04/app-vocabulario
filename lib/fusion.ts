/**
 * La regla de fusión: gana la caja más alta, nunca se retrocede lo aprendido.
 *
 * Es la misma que ya usaba el import (local-store.importAll) y la que usará la
 * sincronización de la etapa 3. Vive acá, sin dependencias, para que el servidor
 * y el teléfono no puedan acabar con dos versiones distintas de la misma regla.
 */

import type { Progress } from './srs';

/**
 * Une el avance que ya hay con el que llega.
 *
 * La caja y la fecha vienen del que tenga la caja más alta; a igualdad, se queda
 * el que ya estaba. `seen` y `miss` son contadores que solo crecen, así que se
 * toma el mayor: sumarlos contaría dos veces lo que ya se subió en un intento
 * anterior que falló a medias.
 */
export function fusionarProgreso(actual: Progress | null | undefined, nuevo: Progress): Progress {
  if (!actual) return nuevo;
  const base = nuevo.box > actual.box ? nuevo : actual;
  return {
    box: base.box,
    due: base.due,
    seen: Math.max(actual.seen, nuevo.seen),
    miss: Math.max(actual.miss, nuevo.miss),
  };
}

export type Racha = { streak: number; lastDay: string | null };

/**
 * Gana la racha del día más reciente: es la que sigue viva. Con el mismo día, la
 * más larga. Las fechas son YYYY-MM-DD locales, así que comparar como texto
 * ordena bien.
 */
export function fusionarRacha(actual: Racha, nueva: Racha): Racha {
  if (!nueva.lastDay) return actual;
  if (!actual.lastDay) return nueva;
  if (nueva.lastDay > actual.lastDay) return nueva;
  if (nueva.lastDay < actual.lastDay) return actual;
  return { streak: Math.max(actual.streak, nueva.streak), lastDay: actual.lastDay };
}

/**
 * La regla del día a día, la de la sincronización (#30).
 *
 * «Gana la caja más alta» a secas no sirve acá: si fallas una palabra en caja 4
 * y vuelve a la 1, el servidor seguiría teniendo la 4 y el fallo se perdería
 * siempre, incluso con un solo dispositivo. Esa regla es la de la primera
 * subida (`fusionarProgreso`), donde no hay historia que respetar.
 *
 * Aquí se decide por versión. `base` es la versión del servidor sobre la que el
 * teléfono hizo su cambio (el `updatedAt` que vio la última vez):
 *
 * - Si el servidor no cambió desde entonces, el cambio del teléfono entra tal
 *   cual, fallos incluidos: nadie más tocó la palabra, no hay choque.
 * - Si cambió, dos dispositivos tocaron la misma palabra sin verse. Ahí sí rige
 *   «nunca se retrocede lo aprendido» y gana la caja más alta.
 *
 * Las fechas se comparan en milisegundos: Postgres guarda microsegundos, pero
 * lo que el cliente recibe y devuelve ya viene truncado a ms.
 */
export function resolverProgreso(
  servidor: { progreso: Progress; actualizado: Date } | null,
  cliente: Progress,
  base: Date | null
): { progreso: Progress; choque: boolean } {
  if (!servidor) return { progreso: cliente, choque: false };
  if (base && servidor.actualizado.getTime() <= base.getTime()) {
    return { progreso: cliente, choque: false };
  }
  return { progreso: fusionarProgreso(servidor.progreso, cliente), choque: true };
}

export const igualProgreso = (a: Progress, b: Progress): boolean =>
  a.box === b.box && a.due === b.due && a.seen === b.seen && a.miss === b.miss;

export type ListaEstado = { name: string; words: string[] };

/**
 * La regla del día a día para una lista, la misma idea que `resolverProgreso`.
 *
 * - Si la lista estaba borrada en el servidor y alguien la edita, manda quien la
 *   edita (igual que una palabra que se vuelve a agregar).
 * - Si el servidor no cambió desde la `base` que el teléfono vio, el cambio entra
 *   tal cual, incluidas las palabras quitadas.
 * - Si cambió, dos dispositivos la tocaron sin verse: se unen las palabras (no se
 *   pierde ninguna) y se queda el nombre del servidor.
 */
export function resolverLista(
  servidor: { lista: ListaEstado; actualizado: Date; borrada: boolean } | null,
  cliente: ListaEstado,
  base: Date | null
): { lista: ListaEstado; choque: boolean } {
  if (!servidor || servidor.borrada) return { lista: cliente, choque: false };
  if (base && servidor.actualizado.getTime() <= base.getTime()) {
    return { lista: cliente, choque: false };
  }
  return {
    lista: { name: servidor.lista.name, words: [...new Set([...servidor.lista.words, ...cliente.words])] },
    choque: true,
  };
}

export const igualLista = (a: ListaEstado, b: ListaEstado): boolean =>
  a.name === b.name && a.words.length === b.words.length && a.words.every((w) => b.words.includes(w));

export type AvanceTema = { nivel: number; racha: number };

/**
 * La regla del día a día para el nivel de un tema (#70), la misma idea que
 * `resolverProgreso`.
 *
 * - Si el servidor no cambió desde la `base` que el teléfono vio, el cambio entra
 *   tal cual, incluida una racha que volvió a cero por un fallo.
 * - Si cambió, dos aparatos practicaron sin verse: gana el nivel más alto (nunca se
 *   retrocede lo ganado) y, a igual nivel, la racha más larga.
 */
export function resolverTema(
  servidor: { avance: AvanceTema; actualizado: Date } | null,
  cliente: AvanceTema,
  base: Date | null
): { avance: AvanceTema; choque: boolean } {
  if (!servidor) return { avance: cliente, choque: false };
  if (base && servidor.actualizado.getTime() <= base.getTime()) {
    return { avance: cliente, choque: false };
  }
  const s = servidor.avance;
  const gana =
    cliente.nivel > s.nivel || (cliente.nivel === s.nivel && cliente.racha > s.racha) ? cliente : s;
  return { avance: { nivel: gana.nivel, racha: gana.racha }, choque: true };
}

export const igualTema = (a: AvanceTema, b: AvanceTema): boolean =>
  a.nivel === b.nivel && a.racha === b.racha;
