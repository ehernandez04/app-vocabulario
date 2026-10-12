import { describe, expect, it } from 'vitest';
import { limpiarNombre, listasDe, mazoActivo, nombreRepetido, palabrasDe, SIEMBRA, type Lista } from './listas';
import type { Word } from './srs';
import deck from '../data/deck.json';

const mazo: Word[] = ['a', 'b', 'c', 'd'].map((en) => ({ en, es: en }));
const l = (id: string, name: string, words: string[]): Lista => ({ id, name, words, createdAt: '2026-10-12' });

describe('listas', () => {
  const listas = [l('1', 'Trabajo', ['c', 'a']), l('2', 'Viajes', ['b', 'zzz'])];

  it('las palabras de una lista salen en el orden del mazo y se ignoran las que ya no existen', () => {
    expect(palabrasDe(listas[0], mazo).map((w) => w.en)).toEqual(['a', 'c']);
    expect(palabrasDe(listas[1], mazo).map((w) => w.en)).toEqual(['b']);
  });

  it('sin lista elegida, o con una que ya no existe, se repasa todo', () => {
    expect(mazoActivo(mazo, listas, null)).toBe(mazo);
    expect(mazoActivo(mazo, listas, 'borrada')).toBe(mazo);
    expect(mazoActivo(mazo, listas, '1').map((w) => w.en)).toEqual(['a', 'c']);
  });

  it('una lista vacía da un mazo vacío, no todo el mazo', () => {
    expect(mazoActivo(mazo, [l('3', 'Nada', [])], '3')).toEqual([]);
  });

  it('listasDe devuelve todas las listas de una palabra', () => {
    expect(listasDe([...listas, l('3', 'Otra', ['a'])], 'a').map((x) => x.id)).toEqual(['1', '3']);
  });

  it('el nombre se limpia y el repetido no distingue mayúsculas', () => {
    expect(limpiarNombre('  Mi   lista  ')).toBe('Mi lista');
    expect(limpiarNombre('x'.repeat(100))).toHaveLength(40);
    expect(nombreRepetido(listas, ' trabajo ')).toBe(true);
    expect(nombreRepetido(listas, 'Trabajo', '1')).toBe(false); // renombrarse a sí misma no choca
  });
});

describe('la siembra', () => {
  it('solo menciona palabras que existen en el mazo de fábrica', () => {
    const existentes = new Set((deck as Word[]).map((w) => w.en));
    for (const lista of SIEMBRA) for (const en of lista.words) expect(existentes.has(en), en).toBe(true);
  });

  it('toda palabra de fábrica está en alguna lista', () => {
    const repartidas = new Set(SIEMBRA.flatMap((x) => x.words));
    for (const w of deck as Word[]) expect(repartidas.has(w.en), w.en).toBe(true);
  });
});
