/**
 * El tope diario de evaluaciones de pronunciación (#68), aparte del de IA: Azure
 * cobra por segundo de audio y practicar hablando no debe gastar los puntos de las
 * búsquedas y los dibujos. Mismo mecanismo que lib/uso-ia.ts.
 */

import { prisma } from './prisma';

export const LIMITE_VOZ = 20;

export async function reservarVoz(userId: string, dia: string): Promise<boolean> {
  const tomada = await prisma.voiceUsage.updateMany({
    where: { userId, day: dia, count: { lt: LIMITE_VOZ } },
    data: { count: { increment: 1 } },
  });
  if (tomada.count > 0) return true;
  const fila = await prisma.voiceUsage.findUnique({ where: { userId_day: { userId, day: dia } } });
  if (fila) return false; // existe y no cabe más
  await prisma.voiceUsage.createMany({ data: [{ userId, day: dia, count: 1 }], skipDuplicates: true });
  return true;
}

/** Devuelve lo reservado: una evaluación que falla por culpa nuestra no cuenta. */
export const devolverVoz = (userId: string, dia: string) =>
  prisma.voiceUsage.updateMany({ where: { userId, day: dia, count: { gte: 1 } }, data: { count: { decrement: 1 } } });

export async function restantesVoz(userId: string, dia: string): Promise<number> {
  const f = await prisma.voiceUsage.findUnique({ where: { userId_day: { userId, day: dia } } });
  return Math.max(0, LIMITE_VOZ - (f?.count ?? 0));
}
