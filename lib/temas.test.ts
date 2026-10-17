import { describe, expect, it } from 'vitest';
import {
  ACIERTOS_PARA_SUBIR,
  TEMAS,
  calificarDictado,
  calificarEscrito,
  claveComparacion,
  explicar,
  fraseCompleta,
  normalizar,
  opcionesDe,
  paraParte,
  registrar,
  type EjercicioEscrito,
  type Practica,
} from './temas';

describe('ejercicios escritos a mano', () => {
  it('cada uno tiene la correcta fuera de los errores y una explicación por error', () => {
    for (const t of TEMAS)
      for (const n of t.niveles)
        for (const e of n.ejercicios) {
          expect(Object.keys(e.errores)).not.toContain(e.correcta);
          expect(Object.keys(e.errores).length).toBeGreaterThanOrEqual(2);
          for (const m of Object.values(e.errores)) expect(m.length).toBeGreaterThan(10);
        }
  });
});

describe('explicar', () => {
  const e = TEMAS[0].niveles[0].ejercicios[0];
  it('acierta con la correcta', () => {
    expect(explicar(e, e.correcta).acierto).toBe(true);
  });
  it('devuelve la explicación del error típico', () => {
    const r = explicar(e, 'will to');
    expect(r.acierto).toBe(false);
    expect(r.mensaje).toContain('sin «to»');
  });
  it('si el error no está catalogado, da la forma correcta', () => {
    expect(explicar(e, 'otra').mensaje).toContain(e.correcta);
  });
});

describe('opcionesDe', () => {
  it('trae todas las opciones sin repetir', () => {
    const e = TEMAS[0].niveles[0].ejercicios[0];
    const o = opcionesDe(e);
    expect(new Set(o).size).toBe(3);
    expect(o).toContain(e.correcta);
  });
});

describe('registrar', () => {
  it('un fallo vuelve la racha a cero y conserva el nivel', () => {
    expect(registrar({ nivel: 2, racha: 6 }, false, 2).progreso).toEqual({ nivel: 2, racha: 0 });
  });
  it('un acierto suma a la racha', () => {
    expect(registrar({ nivel: 1, racha: 3 }, true, 2).progreso).toEqual({ nivel: 1, racha: 4 });
  });
  it('con la racha completa sube de nivel', () => {
    const r = registrar({ nivel: 1, racha: ACIERTOS_PARA_SUBIR - 1 }, true, 2);
    expect(r).toEqual({ progreso: { nivel: 2, racha: 0 }, subio: true });
  });
  it('en el último nivel disponible no sube y la racha se queda llena', () => {
    const r = registrar({ nivel: 2, racha: ACIERTOS_PARA_SUBIR - 1 }, true, 2);
    expect(r).toEqual({ progreso: { nivel: 2, racha: ACIERTOS_PARA_SUBIR }, subio: false });
  });
});

describe('normalizar', () => {
  it('ignora mayúsculas, puntuación y el tipo de apóstrofo', () => {
    expect(normalizar("  Won't. ")).toBe(normalizar('won’t'));
    expect(normalizar('If it rains,  I will stay home!')).toBe('if it rains i will stay home');
  });
  it('iguala las contracciones de will con la forma larga', () => {
    expect(normalizar("I'll stay")).toBe(normalizar('I will stay'));
    expect(normalizar('I won’t go')).toBe(normalizar('I will not go'));
  });
  it('no confunde palabras distintas', () => {
    expect(normalizar('wont')).not.toBe(normalizar("won't"));
  });
});

describe('claveComparacion', () => {
  it('abre las contracciones habituales', () => {
    expect(claveComparacion("I'm sure he doesn't know")).toBe(claveComparacion('I am sure he does not know'));
    expect(claveComparacion('They’re here, and we’ve eaten')).toBe(claveComparacion('They are here and we have eaten'));
    expect(claveComparacion("It's late; I can't go")).toBe(claveComparacion('It is late I cannot go'));
    expect(claveComparacion("She'd come")).toBe(claveComparacion('She would come'));
  });
  it('no confunde frases distintas', () => {
    expect(claveComparacion("I'm sure")).not.toBe(claveComparacion('I sure'));
    expect(claveComparacion("don't go")).not.toBe(claveComparacion('go'));
  });
});

describe('calificarEscrito', () => {
  const hueco: EjercicioEscrito = {
    es: 'Mañana no llamaré a mi jefe.',
    antes: 'I',
    despues: 'call my boss tomorrow.',
    aceptadas: ['won’t', 'will never'],
    errores: { 'don’t will': 'La negación se pega a «will».' },
    explicacion: '«Won’t» es «will not».',
  };
  it('acepta una traducción con contracciones abiertas o cerradas', () => {
    const t: EjercicioEscrito = {
      es: 'No sé si él está listo.',
      aceptadas: ["I don't know if he is ready."],
      errores: {},
      explicacion: 'Bien.',
    };
    expect(calificarEscrito(t, 'I do not know if he’s ready').estado).toBe('acierto');
  });
  it('acepta una respuesta aceptada, con otro apóstrofo y mayúsculas', () => {
    expect(calificarEscrito(hueco, "WON'T")).toEqual({ estado: 'acierto', mensaje: hueco.explicacion });
  });
  it('si acertó con otra forma, enseña la primera', () => {
    expect(calificarEscrito(hueco, 'will never')).toEqual({
      estado: 'acierto',
      mensaje: hueco.explicacion,
      alternativa: 'won’t',
    });
  });
  it('«will not» cuenta como «won’t» y no se muestra como alternativa', () => {
    expect(calificarEscrito(hueco, 'will not')).toEqual({ estado: 'acierto', mensaje: hueco.explicacion });
  });
  it('un error conocido es un fallo con su explicación', () => {
    expect(calificarEscrito(hueco, "don't will")).toEqual({ estado: 'fallo', mensaje: 'La negación se pega a «will».' });
  });
  it('lo desconocido, o vacío, queda en duda', () => {
    expect(calificarEscrito(hueco, 'shall not')).toEqual({ estado: 'duda' });
    expect(calificarEscrito(hueco, '   ')).toEqual({ estado: 'duda' });
  });
});

describe('dictado', () => {
  const frase: EjercicioEscrito = {
    es: 'Ella nos ayudará mañana.',
    aceptadas: ['She will help us tomorrow.', 'She’ll help us tomorrow.'],
    errores: { 'She wins help us tomorrow': 'x' },
    explicacion: 'x',
  };

  it('acepta la frase que sonó sin importar mayúsculas, puntuación o contracción', () => {
    expect(calificarDictado(frase, "she'll help us tomorrow").estado).toBe('acierto');
    expect(calificarDictado(frase, 'SHE WILL HELP US TOMORROW!').estado).toBe('acierto');
  });

  it('nunca queda en duda: lo que no coincide es un fallo, aunque sea un error conocido', () => {
    expect(calificarDictado(frase, '').estado).toBe('fallo');
    expect(calificarDictado(frase, 'She wins help us tomorrow').estado).toBe('fallo');
  });

  it('dice qué palabras faltaron y cuáles sobraron', () => {
    expect(calificarDictado(frase, 'She will help tomorrow')).toEqual({ estado: 'fallo', mensaje: 'Te faltó: us.' });
    expect(calificarDictado(frase, 'She wins help us tomorrow')).toEqual({
      estado: 'fallo',
      mensaje: 'Te faltó: will. Sobró: wins.',
    });
    expect(calificarDictado(frase, 'tomorrow help us will she').estado).toBe('fallo');
  });

});

describe('paraParte (#77)', () => {
  const base: EjercicioEscrito = {
    es: 'Ella nos ayudará mañana.',
    aceptadas: ['She will help us tomorrow.'],
    errores: {},
    explicacion: 'x',
  };
  const tr = (id: string): Practica => ({ ...base, id, tipo: 'traducir' });
  const esc: Practica = { ...base, tipo: 'escribir' };

  it('Ideas usa la lista tal cual, de cualquier tipo', () => {
    const lista = [tr('a'), esc];
    expect(paraParte(lista, 'ideas')).toBe(lista);
  });

  it('Listening toma solo los de traducir y los presenta como dictado', () => {
    expect(paraParte([tr('a'), esc, tr('b')], 'listening').map((e) => e.tipo)).toEqual(['escuchar', 'escuchar']);
  });

  it('Speaking toma solo los de traducir y los presenta como repetir', () => {
    expect(paraParte([tr('a'), esc, tr('b')], 'speaking').map((e) => e.tipo)).toEqual(['repetir', 'repetir']);
  });

  it('Speaking sin conexión se queda sin ejercicios, pero Listening no necesita voz', () => {
    expect(paraParte([tr('a'), tr('b')], 'speaking', false)).toEqual([]);
    expect(paraParte([tr('a'), tr('b')], 'listening', false).map((e) => e.tipo)).toEqual(['escuchar', 'escuchar']);
  });
});

describe('fraseCompleta (#109)', () => {
  it('en elegir arma la frase con la opción correcta en el hueco', () => {
    const e: Practica = {
      tipo: 'elegir',
      es: '¿Vendrás a la fiesta?',
      antes: '',
      despues: 'you come to the party?',
      correcta: 'Will',
      errores: {},
      explicacion: 'x',
    };
    expect(fraseCompleta(e)).toBe('Will you come to the party?');
  });

  it('en escribir arma la frase con la primera aceptada en el hueco', () => {
    const e: Practica = {
      tipo: 'escribir',
      es: 'Te llamaré más tarde.',
      antes: 'I',
      despues: 'call you later.',
      aceptadas: ['will'],
      errores: {},
      explicacion: 'x',
    };
    expect(fraseCompleta(e)).toBe('I will call you later.');
  });

  it('en traducir ya es la frase entera', () => {
    const e: Practica = {
      tipo: 'traducir',
      es: 'Usted recibirá una respuesta pronto.',
      aceptadas: ['You will receive a reply soon.', 'You will get a reply soon.'],
      errores: {},
      explicacion: 'x',
    };
    expect(fraseCompleta(e)).toBe('You will receive a reply soon.');
  });
});
