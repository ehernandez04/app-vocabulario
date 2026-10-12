/**
 * Listas de palabras: agrupaciones tuyas para repasar solo una parte del mazo.
 *
 * Una palabra puede estar en varias listas, sea de fábrica o propia. La lista
 * guarda los textos en inglés de sus palabras, que es la clave de una palabra en
 * todo el proyecto. Puro, sin IndexedDB: lo que se hace con ello vive en
 * lib/local-store.ts.
 */

import type { Word } from './srs';

export type Lista = {
  id: string;
  name: string;
  /** Textos en inglés de las palabras que contiene. */
  words: string[];
  createdAt: string;
};

export const MAX_NOMBRE = 40;

/**
 * Las tres listas con las que empieza cada quien, y lo que hay en ellas. Se
 * crean una sola vez y después son suyas: se renombran, se vacían o se borran.
 * Una palabra puede estar en dos (la repartición es a mano, sobre el mazo de
 * fábrica); las que ya no existan en el mazo se ignoran.
 */
export const SIEMBRA: { name: string; words: string[] }[] = [
  {
    name: 'Básicas',
    words: ['the way', 'however', 'meanwhile', 'nevertheless', 'outcome', 'willing', 'awkward', 'tricky', 'spare'],
  },
  {
    name: 'Trabajo',
    words: [
      'to achieve', 'reliable', 'to struggle', 'outcome', 'to remind',
      'to commute', 'deadline', 'insight', 'shortcut', 'overwhelming',
    ],
  },
  { name: 'Viajes', words: ['the way', 'to commute', 'to afford', 'to borrow', 'shortcut', 'spare'] },
];

/** Limpia un nombre de lista: sin espacios de más y con tope de largo. */
export const limpiarNombre = (n: string): string => n.trim().replace(/\s+/g, ' ').slice(0, MAX_NOMBRE);

/** ¿Ya hay una lista con ese nombre (sin importar mayúsculas)? `salvo` excluye una por id. */
export const nombreRepetido = (listas: Lista[], nombre: string, salvo?: string): boolean =>
  listas.some((l) => l.id !== salvo && l.name.toLowerCase() === limpiarNombre(nombre).toLowerCase());

/** Las palabras del mazo que pertenecen a la lista, en el orden del mazo. */
export function palabrasDe(lista: Lista, deck: Word[]): Word[] {
  const dentro = new Set(lista.words);
  return deck.filter((w) => dentro.has(w.en));
}

/** El mazo que se repasa: todo si no hay lista elegida (o ya no existe), o solo esa lista. */
export function mazoActivo(deck: Word[], listas: Lista[], elegida: string | null): Word[] {
  const lista = elegida ? listas.find((l) => l.id === elegida) : undefined;
  return lista ? palabrasDe(lista, deck) : deck;
}

/** Las listas en las que está una palabra. */
export const listasDe = (listas: Lista[], en: string): Lista[] => listas.filter((l) => l.words.includes(en));
