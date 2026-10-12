/**
 * Saneado del input que llega de un cliente.
 *
 * Todo lo que entra por /api/subir y /api/sync viene de un teléfono, o sea de
 * fuera de la confianza del servidor: se valida antes de tocar la base. Lo
 * inválido se descarta y se cuenta, no tumba la petición entera: un registro
 * raro no debe dejar a nadie sin poder subir las otras doscientas palabras.
 */

import { BOXES } from './srs';

export const FECHA = /^\d{4}-\d{2}-\d{2}$/;

export type PalabraEntrada = {
  en: string;
  es: string;
  ipa: string;
  emoji: string;
  xe: string;
  xs: string;
};
export type ProgresoEntrada = { box: number; due: string; seen: number; miss: number };

export const texto = (v: unknown, max: number): string | null =>
  typeof v === 'string' ? v.trim().slice(0, max) : null;

export const entero = (v: unknown, min: number, max: number): number | null =>
  typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max ? v : null;

export function palabra(v: unknown): PalabraEntrada | null {
  if (!v || typeof v !== 'object') return null;
  const w = v as Record<string, unknown>;
  const en = texto(w.en, 200);
  const es = texto(w.es, 200);
  if (!en || !es) return null;
  return {
    en,
    es,
    ipa: texto(w.ipa, 200) ?? '',
    emoji: texto(w.emoji, 16) || '📝',
    xe: texto(w.xe, 500) ?? '',
    xs: texto(w.xs, 500) ?? '',
  };
}

export function progreso(v: unknown): ProgresoEntrada | null {
  if (!v || typeof v !== 'object') return null;
  const p = v as Record<string, unknown>;
  const box = entero(p.box, 1, BOXES);
  const seen = entero(p.seen, 0, 1_000_000);
  const miss = entero(p.miss, 0, 1_000_000);
  if (box === null || seen === null || miss === null) return null;
  if (typeof p.due !== 'string' || !FECHA.test(p.due)) return null;
  return { box, due: p.due, seen, miss };
}

/** Una fecha ISO válida, o null. La versión que el cliente dice haber visto. */
export function instante(v: unknown): Date | null {
  if (typeof v !== 'string') return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

export const racha = (streak: unknown, lastDay: unknown) => ({
  streak: entero(streak, 0, 100_000) ?? 0,
  lastDay: typeof lastDay === 'string' && FECHA.test(lastDay) ? lastDay : null,
});
