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

export const igualProgreso = (a: Progress, b: Progress): boolean =>
  a.box === b.box && a.due === b.due && a.seen === b.seen && a.miss === b.miss;
