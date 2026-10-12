import { describe, expect, it } from 'vitest';
import { armarClaves, base, partirEn, posDe, sanearSentidos, textoEn, yaLaTienes, type Sentido } from './palabra';

const s = (en: string, pos: Sentido['pos'], es = en, matiz = ''): Sentido => ({ en, pos, matiz, es, ipa: '', xe: '', xs: '', emoji: '📝' });

describe('la etiqueta', () => {
  it('se parte y se quita al mostrar', () => {
    expect(partirEn('run (sustantivo)')).toEqual({ texto: 'run', etiqueta: 'sustantivo' });
    expect(partirEn('to run (verbo: dirigir)')).toEqual({ texto: 'to run', etiqueta: 'verbo: dirigir' });
    expect(partirEn('the way')).toEqual({ texto: 'the way', etiqueta: null });
    expect(textoEn('run (sustantivo)')).toBe('run');
  });

  it('el tipo se deduce de la etiqueta', () => {
    expect(posDe('verbo')).toBe('verbo');
    expect(posDe('verbo: dirigir')).toBe('verbo');
    expect(posDe(null)).toBeNull();
  });

  it('la base ignora mayúsculas, el «to » y la etiqueta', () => {
    expect(base('To Run (verbo)')).toBe('run');
    expect(base('  the   way ')).toBe('the way');
  });
});

describe('las claves de los sentidos', () => {
  it('un solo sentido va a secas, como una palabra de siempre', () => {
    expect(armarClaves([s('reliable', 'adjetivo')], [])).toEqual(['reliable']);
  });

  it('varios sentidos llevan el tipo', () => {
    expect(armarClaves([s('to run', 'verbo'), s('run', 'sustantivo')], [])).toEqual(['to run (verbo)', 'run (sustantivo)']);
  });

  it('dos del mismo tipo suman el matiz', () => {
    const k = armarClaves([s('to run', 'verbo', 'correr', 'correr'), s('to run', 'verbo', 'dirigir', 'dirigir'), s('run', 'sustantivo')], []);
    expect(k).toEqual(['to run (verbo: correr)', 'to run (verbo: dirigir)', 'run (sustantivo)']);
  });

  it('si choca con algo que ya existe, se numera', () => {
    expect(armarClaves([s('run', 'sustantivo')], ['run'])).toEqual(['run (2)']);
    expect(armarClaves([s('to run', 'verbo'), s('run', 'sustantivo')], ['to run (verbo)'])).toEqual(['to run (verbo 2)', 'run (sustantivo)']);
  });
});

describe('¿ya la tienes?', () => {
  const mazo = ['to remind', 'outcome', 'run (sustantivo)', 'to struggle'];

  it('reconoce la misma palabra aunque cambie el «to » o las mayúsculas', () => {
    expect(yaLaTienes(s('to remind', 'verbo'), mazo)).toBe('to remind');
    expect(yaLaTienes(s('Remind', 'verbo'), mazo)).toBe('to remind');
  });

  it('una palabra tuya sin tipo cuenta como el mismo sentido', () => {
    expect(yaLaTienes(s('outcome', 'sustantivo'), mazo)).toBe('outcome');
  });

  it('el mismo texto con otro tipo no es repetida', () => {
    expect(yaLaTienes(s('to run', 'verbo'), mazo)).toBeNull();
    expect(yaLaTienes(s('struggle', 'sustantivo'), mazo)).toBeNull(); // «to struggle» es un verbo
    expect(yaLaTienes(s('run', 'sustantivo'), mazo)).toBe('run (sustantivo)');
  });
});

describe('sanearSentidos', () => {
  it('descarta lo inválido y lo repetido', () => {
    const r = sanearSentidos({
      sentidos: [
        { en: 'run', es: 'correr', pos: 'verbo' },
        { en: 'run', es: 'correr', pos: 'verbo' }, // repetido
        { en: 'run', es: 'x', pos: 'inventado' }, // tipo inválido
        { en: 'run (x)', es: 'x', pos: 'verbo' }, // paréntesis: lo pone la app
        { es: 'sin inglés', pos: 'verbo' },
        'basura',
      ],
    });
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ en: 'run', es: 'correr', emoji: '📝' });
  });

  it('un matiz escrito como comparación se queda con el primer término', () => {
    const r = sanearSentidos({ sentidos: [{ en: 'to run', es: 'correr', pos: 'verbo', matiz: 'correr vs dirigir' }, { en: 'to run', es: 'dirigir', pos: 'verbo', matiz: 'dirigir, gestionar' }] });
    expect(r.map((x) => x.matiz)).toEqual(['correr', 'dirigir']);
  });

  it('una respuesta sin forma devuelve vacío', () => {
    expect(sanearSentidos(null)).toEqual([]);
    expect(sanearSentidos({ sentidos: 3 })).toEqual([]);
  });
});
