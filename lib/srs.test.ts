import { describe, expect, it } from 'vitest';
import {
  addDays,
  daysBetween,
  emptyProgress,
  grade,
  isDue,
  nextStreak,
  session,
  today,
  type Progress,
  type Word,
} from './srs';

describe('fechas locales', () => {
  it('a las 11 de la noche sigue siendo hoy, no mañana', () => {
    // El caso que motivó que today() exista: en México, a las 23:00,
    // toISOString() ya devuelve el día siguiente en UTC. Si se usara, los
    // repasos se adelantarían un día y la racha se rompería sola.
    const nocheEnMexico = new Date(2026, 9, 9, 23, 30);
    expect(today(nocheEnMexico)).toBe('2026-10-09');
    expect(nocheEnMexico.toISOString().slice(0, 10)).toBe('2026-10-10');
  });

  it('suma días cruzando fin de mes y fin de año', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
  });

  it('cuenta días de calendario, no bloques de 24 horas', () => {
    // El domingo del cambio de horario tiene 23 o 25 horas. Contando
    // milisegundos, ese día valdría 0.96 o 1.04 y la racha se rompería.
    expect(daysBetween('2026-10-25', '2026-10-26')).toBe(1);
    expect(daysBetween('2026-03-29', '2026-03-30')).toBe(1);
    expect(daysBetween('2026-10-09', '2026-10-09')).toBe(0);
    expect(daysBetween('2026-10-09', '2026-10-01')).toBe(-8);
  });
});

describe('calificar', () => {
  const base: Progress = { box: 1, due: '2026-10-09', seen: 3, miss: 1 };

  it('acertar sube una caja y agenda según el intervalo nuevo', () => {
    const p = grade(base, true, '2026-10-09');
    expect(p.box).toBe(2);
    expect(p.due).toBe('2026-10-11'); // caja 2 = 2 días
    expect(p.seen).toBe(4);
    expect(p.miss).toBe(1);
  });

  it('fallar devuelve a la caja 1 aunque estuviera en la última', () => {
    const p = grade({ ...base, box: 5 }, false, '2026-10-09');
    expect(p.box).toBe(1);
    expect(p.due).toBe('2026-10-10'); // caja 1 = 1 día
    expect(p.miss).toBe(2);
  });

  it('la caja 5 es el techo', () => {
    expect(grade({ ...base, box: 5 }, true).box).toBe(5);
  });

  it('no muta el progreso original', () => {
    const copia = { ...base };
    grade(base, true);
    expect(base).toEqual(copia);
  });
});

describe('la sesión del día', () => {
  const mazo: Word[] = Array.from({ length: 30 }, (_, i) => ({
    en: `w${i}`,
    es: `p${i}`,
  }));

  it('solo trae lo vencido, cajas más bajas primero', () => {
    const progreso: Record<string, Progress> = {
      w0: { box: 3, due: '2026-10-01', seen: 0, miss: 0 },
      w1: { box: 1, due: '2026-10-01', seen: 0, miss: 0 },
      w2: { box: 2, due: '2026-10-01', seen: 0, miss: 0 },
      w3: { box: 1, due: '2026-12-01', seen: 0, miss: 0 }, // no vencida
    };
    const progressOf = (en: string) => progreso[en] ?? emptyProgress('2026-12-01');
    const s = session(mazo.slice(0, 4), progressOf, 20, '2026-10-09');

    expect(s.map((w) => w.en)).toEqual(['w1', 'w2', 'w0']);
  });

  it('corta en 20 aunque haya más vencidas', () => {
    const progressOf = () => emptyProgress('2026-10-01');
    expect(session(mazo, progressOf, 20, '2026-10-09')).toHaveLength(20);
  });

  it('si no hay nada vencido devuelve el mazo igual, para poder repasar', () => {
    const progressOf = () => emptyProgress('2026-12-01');
    expect(session(mazo, progressOf, 20, '2026-10-09').length).toBeGreaterThan(0);
  });

  it('isDue incluye el mismo día', () => {
    expect(isDue({ box: 1, due: '2026-10-09', seen: 0, miss: 0 }, '2026-10-09')).toBe(true);
    expect(isDue({ box: 1, due: '2026-10-10', seen: 0, miss: 0 }, '2026-10-09')).toBe(false);
  });
});

describe('racha', () => {
  it('el primer día arranca en 1', () => {
    expect(nextStreak(0, null, '2026-10-09')).toBe(1);
  });

  it('repasar dos veces el mismo día no la sube', () => {
    expect(nextStreak(4, '2026-10-09', '2026-10-09')).toBe(4);
  });

  it('ayer la sube', () => {
    expect(nextStreak(4, '2026-10-08', '2026-10-09')).toBe(5);
  });

  it('saltarse un día la reinicia', () => {
    expect(nextStreak(9, '2026-10-07', '2026-10-09')).toBe(1);
  });

  it('sobrevive al cambio de horario', () => {
    expect(nextStreak(3, '2026-10-25', '2026-10-26')).toBe(4);
  });
});
