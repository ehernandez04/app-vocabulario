/**
 * El cron del recordatorio (#14). Corre cada ~15 min y avisa a quien le toque
 * según la hora y la zona que eligió. No lleva sesión: lo llama un programador
 * externo con `Authorization: Bearer $CRON_SECRET`.
 */

import { prisma } from '@/lib/prisma';
import { enviar, pushConfigurado } from '@/lib/push';
import { enZona, textoAviso, tocaAvisar } from '@/lib/recordatorio';

export const maxDuration = 60;

export async function GET(req: Request) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto || req.headers.get('authorization') !== `Bearer ${secreto}`) {
    return Response.json({ error: 'No autorizado' }, { status: 401 });
  }
  if (!pushConfigurado()) return Response.json({ error: 'Los avisos no están configurados' }, { status: 503 });

  const ahora = new Date();
  const subs = await prisma.pushSub.findMany({ include: { user: { select: { lastDay: true, streak: true } } } });

  let enviados = 0;
  for (const s of subs) {
    if (!tocaAvisar(s, s.user.lastDay, ahora)) continue;
    const { dia } = enZona(ahora, s.tz);
    const pendientes = await prisma.progress.count({ where: { userId: s.userId, due: { lte: dia } } });
    // Se marca antes de enviar: si el envío tarda y el cron se solapa, mejor un
    // aviso perdido que dos iguales.
    const tomada = await prisma.pushSub.updateMany({
      where: { id: s.id, OR: [{ lastSentDay: null }, { lastSentDay: { not: dia } }] },
      data: { lastSentDay: dia },
    });
    if (tomada.count === 0) continue;
    if (await enviar(s, textoAviso(pendientes, s.user.streak))) enviados++;
  }
  return Response.json({ revisadas: subs.length, enviados });
}
