import { describe, expect, it } from 'vitest';
import { fusionarProgreso, fusionarRacha, resolverProgreso } from './fusion';

const p = (box: number, due = '2026-10-12', seen = 0, miss = 0) => ({ box, due, seen, miss });

describe('fusionarProgreso', () => {
  it('sin nada previo, entra tal cual', () => {
    expect(fusionarProgreso(null, p(3, '2026-10-20', 4, 1))).toEqual(p(3, '2026-10-20', 4, 1));
  });

  it('gana la caja más alta, venga de donde venga', () => {
    expect(fusionarProgreso(p(2, '2026-10-14'), p(4, '2026-10-28')).box).toBe(4);
    expect(fusionarProgreso(p(4, '2026-10-28'), p(2, '2026-10-14')).box).toBe(4);
  });

  it('la fecha acompaña a la caja ganadora', () => {
    expect(fusionarProgreso(p(2, '2026-10-14'), p(4, '2026-10-28')).due).toBe('2026-10-28');
    expect(fusionarProgreso(p(4, '2026-10-28'), p(2, '2026-10-14')).due).toBe('2026-10-28');
  });

  it('a igualdad de caja se queda lo que ya estaba', () => {
    expect(fusionarProgreso(p(3, '2026-10-20'), p(3, '2026-10-15')).due).toBe('2026-10-20');
  });

  it('seen y miss toman el mayor y no se suman', () => {
    const r = fusionarProgreso(p(3, '2026-10-20', 5, 2), p(3, '2026-10-20', 5, 2));
    expect(r.seen).toBe(5);
    expect(r.miss).toBe(2);
  });
});

describe('fusionarRacha', () => {
  it('gana el día más reciente', () => {
    const r = fusionarRacha({ streak: 9, lastDay: '2026-10-01' }, { streak: 2, lastDay: '2026-10-12' });
    expect(r).toEqual({ streak: 2, lastDay: '2026-10-12' });
  });

  it('el mismo día, la más larga', () => {
    const r = fusionarRacha({ streak: 3, lastDay: '2026-10-12' }, { streak: 7, lastDay: '2026-10-12' });
    expect(r.streak).toBe(7);
  });

  it('un teléfono sin racha no borra la de la cuenta', () => {
    const actual = { streak: 5, lastDay: '2026-10-12' };
    expect(fusionarRacha(actual, { streak: 0, lastDay: null })).toEqual(actual);
  });

  it('una cuenta sin racha recibe la del teléfono', () => {
    const nueva = { streak: 4, lastDay: '2026-10-12' };
    expect(fusionarRacha({ streak: 0, lastDay: null }, nueva)).toEqual(nueva);
  });
});

describe('resolverProgreso', () => {
  const antes = new Date('2026-10-12T10:00:00.000Z');
  const despues = new Date('2026-10-12T11:00:00.000Z');

  it('sin fila en el servidor, entra lo del teléfono', () => {
    const r = resolverProgreso(null, p(2), null);
    expect(r).toEqual({ progreso: p(2), choque: false });
  });

  it('un fallo normal baja la caja: el servidor no cambió desde la base', () => {
    const servidor = { progreso: p(4, '2026-10-20'), actualizado: antes };
    const r = resolverProgreso(servidor, p(1, '2026-10-13', 7, 2), antes);
    expect(r.progreso.box).toBe(1);
    expect(r.choque).toBe(false);
  });

  it('un acierto normal sube la caja', () => {
    const servidor = { progreso: p(2), actualizado: antes };
    expect(resolverProgreso(servidor, p(3), antes).progreso.box).toBe(3);
  });

  it('dos dispositivos tocaron la misma palabra: gana la caja más alta', () => {
    const servidor = { progreso: p(4, '2026-10-20', 6), actualizado: despues };
    const r = resolverProgreso(servidor, p(1, '2026-10-13', 3), antes);
    expect(r.progreso.box).toBe(4);
    expect(r.progreso.due).toBe('2026-10-20');
    expect(r.choque).toBe(true);
  });

  it('en un choque, la caja del teléfono gana si es más alta', () => {
    const servidor = { progreso: p(2), actualizado: despues };
    expect(resolverProgreso(servidor, p(5, '2026-10-28'), antes).progreso.box).toBe(5);
  });

  it('un teléfono que nunca vio la fila (sin base) cuenta como choque', () => {
    const servidor = { progreso: p(3), actualizado: antes };
    const r = resolverProgreso(servidor, p(1), null);
    expect(r.progreso.box).toBe(3);
    expect(r.choque).toBe(true);
  });

  it('el mismo milisegundo cuenta como sin cambios', () => {
    const servidor = { progreso: p(4), actualizado: antes };
    expect(resolverProgreso(servidor, p(1), new Date(antes.getTime())).choque).toBe(false);
  });
});
