/**
 * Repetición espaciada: cinco cajas estilo Leitner.
 *
 * Acierto → la palabra sube una caja. Fallo → vuelve a la caja 1.
 * La próxima fecha sale del intervalo de la caja en la que quedó.
 *
 * Portado de legacy/src/lib/srs.js sin cambiar el comportamiento: es la pieza
 * que decide qué estudias cada día, y un cambio sutil acá se nota semanas
 * después y es imposible de rastrear.
 */

export const INTERVALS = [1, 2, 4, 8, 16] as const; // días, por caja 1..5
export const BOXES = INTERVALS.length;

export type Progress = {
  box: number;
  due: string;
  seen: number;
  miss: number;
};

export type Word = {
  en: string;
  es: string;
  ipa?: string;
  emoji?: string;
  img?: string;
  xe?: string;
  xs?: string;
  mine?: boolean;
  addedAt?: string;
};

/**
 * Fecha local en formato YYYY-MM-DD.
 *
 * A propósito NO se usa `toISOString()`: a las 11 de la noche en México ya devuelve
 * el día siguiente en UTC, y eso adelantaría los repasos y rompería la racha.
 */
export function today(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  return today(new Date(y, m - 1, d + n));
}

/** Diferencia en días de calendario, no en bloques de 24 h (sobrevive al cambio de horario). */
export function daysBetween(fromIso: string, toIso: string): number {
  const at = (iso: string) => {
    const [y, m, d] = iso.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((at(toIso) - at(fromIso)) / 86400000);
}

export const emptyProgress = (day = today()): Progress => ({ box: 1, due: day, seen: 0, miss: 0 });

/** Devuelve el progreso actualizado tras calificar. No muta el original. */
export function grade(p: Progress, knew: boolean, day = today()): Progress {
  const box = knew ? Math.min(BOXES, p.box + 1) : 1;
  return {
    box,
    due: addDays(day, INTERVALS[box - 1]),
    seen: p.seen + 1,
    miss: p.miss + (knew ? 0 : 1),
  };
}

export const isDue = (p: Progress, day = today()): boolean => p.due <= day;

/**
 * La sesión del día: lo que toca repasar, cajas más bajas primero.
 * Si no hay nada vencido devuelve el mazo entero, para poder repasar igual.
 */
export function session(
  deck: Word[],
  progressOf: (en: string) => Progress,
  limit = 20,
  day = today()
): Word[] {
  const due = deck.filter((w) => isDue(progressOf(w.en), day));
  const pool = due.length ? due : deck.slice();
  return shuffle(pool)
    .sort((a, b) => progressOf(a.en).box - progressOf(b.en).box)
    .slice(0, limit);
}

export function shuffle<T>(list: readonly T[]): T[] {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Racha de días seguidos. Si el último repaso fue ayer sube; si fue hoy se queda;
 * si fue antes vuelve a empezar.
 */
export function nextStreak(streak: number, lastDay: string | null, day = today()): number {
  if (!lastDay) return 1;
  const gap = daysBetween(lastDay, day);
  if (gap === 0) return streak;
  if (gap === 1) return streak + 1;
  return 1;
}
