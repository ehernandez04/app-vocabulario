/** Piezas compartidas por las vistas. Portado de legacy/src/lib/ui.js. */

import type { Word } from './srs';

export const NOTES = ['#FFE066', '#FFB4A2', '#B8E1FF', '#C8F0A8'];

/**
 * `plural(1,'palabra')` → "1 palabra"; `plural(3,'palabra')` → "3 palabras".
 * Las frases con verbo no las cubre: "1 palabra te espera" contra "2 palabras
 * te esperan" hay que escribirlas a mano. Ya se coló dos veces.
 */
export const plural = (n: number, singular: string, plural = singular + 's') =>
  `${n} ${n === 1 ? singular : plural}`;

/** Color de la nota de una palabra, por su posición en el mazo. No se guarda. */
export const noteColor = (deck: Word[], w: Word) =>
  NOTES[Math.max(0, deck.indexOf(w)) % NOTES.length];

/** Color de las notas que asoman detrás: siempre distinto al de encima. */
export const peekColor = (deck: Word[], w: Word, n: number) =>
  NOTES[(Math.max(0, deck.indexOf(w)) + n) % NOTES.length];

export const saludo = (d = new Date()) => {
  const h = d.getHours();
  return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
};
