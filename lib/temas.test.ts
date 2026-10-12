import { describe, expect, it } from 'vitest';
import { ACIERTOS_PARA_SUBIR, TEMAS, explicar, opcionesDe, registrar } from './temas';

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
