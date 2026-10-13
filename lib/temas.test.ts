import { describe, expect, it } from 'vitest';
import { ACIERTOS_PARA_SUBIR, TEMAS, calificarEscrito, explicar, normalizar, opcionesDe, registrar, type EjercicioEscrito } from './temas';

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

describe('calificarEscrito', () => {
  const hueco: EjercicioEscrito = {
    es: 'Mañana no llamaré a mi jefe.',
    antes: 'I',
    despues: 'call my boss tomorrow.',
    aceptadas: ['won’t', 'will never'],
    errores: { 'don’t will': 'La negación se pega a «will».' },
    explicacion: '«Won’t» es «will not».',
  };
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
