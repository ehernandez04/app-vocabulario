/**
 * El tope diario del asistente de IA, compartido por la búsqueda de palabras y el
 * dibujo. Cada llamada cuesta dinero, así que el tope protege el gasto aunque
 * alguien encuentre la dirección de la app. Un dibujo pesa más que una búsqueda.
 */

import { prisma } from './prisma';

/** «Puntos» por persona y día. Una búsqueda vale 1 y un dibujo 2 (ver CLAUDE.md). */
export const LIMITE_DIARIO = 30;
export const COSTE_BUSQUEDA = 1;
export const COSTE_DIBUJO = 2;

/** El día UTC, YYYY-MM-DD. No hace falta que coincida con el día local de quien estudia. */
export const hoy = (): string => new Date().toISOString().slice(0, 10);

/** Reserva `coste` puntos del día. false = ya no caben. */
export async function reservar(userId: string, dia: string, coste: number): Promise<boolean> {
  const tomada = await prisma.aiUsage.updateMany({
    where: { userId, day: dia, count: { lte: LIMITE_DIARIO - coste } },
    data: { count: { increment: coste } },
  });
  if (tomada.count > 0) return true;
  const fila = await prisma.aiUsage.findUnique({ where: { userId_day: { userId, day: dia } } });
  if (fila) return false; // existe y no cabe más
  await prisma.aiUsage.createMany({ data: [{ userId, day: dia, count: coste }], skipDuplicates: true });
  return true;
}

/** Devuelve lo reservado: una llamada que falla por culpa nuestra no cuenta. */
export const devolver = (userId: string, dia: string, coste: number) =>
  prisma.aiUsage.updateMany({ where: { userId, day: dia, count: { gte: coste } }, data: { count: { decrement: coste } } });

export async function restantes(userId: string, dia: string): Promise<number> {
  const f = await prisma.aiUsage.findUnique({ where: { userId_day: { userId, day: dia } } });
  return Math.max(0, LIMITE_DIARIO - (f?.count ?? 0));
}
