import { describe, expect, it } from 'vitest';
import { aplicarCambios, ultimaVersion, type Guardado, type Recibido } from './ejercicios-local';

const datos = { es: 'x', antes: 'a', despues: 'b', correcta: 'c', errores: { d: 'p', e: 'q' }, explicacion: 'z' };
const g = (id: string, nivel = 1): Guardado => ({ id, tema: 'will', nivel, datos, updatedAt: '2026-10-12T10:00:00Z', deletedAt: null });
const r = (id: string, extra: Partial<Recibido> = {}): Recibido => ({
  id, nivel: 1, datos, updatedAt: '2026-10-13T10:00:00Z', deletedAt: null, ...extra,
});

describe('aplicarCambios', () => {
  it('añade lo nuevo y conserva lo que había', () => {
    expect(aplicarCambios([g('a')], 'will', [r('b')]).map((x) => x.id).sort()).toEqual(['a', 'b']);
  });
  it('lo cambiado pisa lo anterior', () => {
    const [x] = aplicarCambios([g('a', 1)], 'will', [r('a', { nivel: 2 })]);
    expect(x.nivel).toBe(2);
  });
  it('lo quitado desaparece', () => {
    expect(aplicarCambios([g('a'), g('b')], 'will', [r('a', { deletedAt: '2026-10-13T11:00:00Z' })]).map((x) => x.id)).toEqual(['b']);
  });
});

describe('ultimaVersion', () => {
  it('toma la fecha más reciente', () => {
    expect(ultimaVersion([r('a'), r('b', { updatedAt: '2026-10-14T00:00:00Z' })], null)).toBe('2026-10-14T00:00:00Z');
  });
  it('sin cambios conserva la anterior', () => {
    expect(ultimaVersion([], '2026-10-12T00:00:00Z')).toBe('2026-10-12T00:00:00Z');
  });
});
