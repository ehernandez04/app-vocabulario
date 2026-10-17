/**
 * El tope mensual de caracteres de ElevenLabs (#78), aparte de los puntos de IA
 * y del tope de voz: ElevenLabs cobra por caracteres sintetizados, no por
 * llamada, y es la misma cuota del plan gratuito (10.000/mes) de toda la
 * cuenta, no por persona. No hay nada que cachear: cada respuesta de la
 * conversación es una frase nueva.
 *
 * Margen bajo los 10.000 gratis para no arriesgarse a un mes con más de un
 * usuario de prueba a la vez.
 */

import { prisma } from './prisma';

export const LIMITE_TTS_MES = 9000;

/** El mes UTC, YYYY-MM. */
export const mesActual = (): string => new Date().toISOString().slice(0, 7);

/** Reserva `caracteres` del mes. false = ya no caben; la conversación sigue sin voz de la IA. */
export async function reservarCaracteres(mes: string, caracteres: number): Promise<boolean> {
  const tomada = await prisma.ttsUsage.updateMany({
    where: { month: mes, chars: { lte: LIMITE_TTS_MES - caracteres } },
    data: { chars: { increment: caracteres } },
  });
  if (tomada.count > 0) return true;
  const fila = await prisma.ttsUsage.findUnique({ where: { month: mes } });
  if (fila) return false; // existe y no caben más
  await prisma.ttsUsage.createMany({ data: [{ month: mes, chars: caracteres }], skipDuplicates: true });
  return true;
}

/** Devuelve lo reservado: una síntesis que falla por culpa nuestra no cuenta. */
export const devolverCaracteres = (mes: string, caracteres: number) =>
  prisma.ttsUsage.updateMany({ where: { month: mes, chars: { gte: caracteres } }, data: { chars: { decrement: caracteres } } });

export async function restantesCaracteres(mes: string): Promise<number> {
  const f = await prisma.ttsUsage.findUnique({ where: { month: mes } });
  return Math.max(0, LIMITE_TTS_MES - (f?.chars ?? 0));
}
