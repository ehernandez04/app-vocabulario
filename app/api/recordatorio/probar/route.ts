/** «Enviar uno de prueba»: manda el aviso ahora a este aparato (#14). */

import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { enviar, pushConfigurado } from '@/lib/push';
import { enZona, textoAviso } from '@/lib/recordatorio';

export async function POST(req: Request) {
  const userId = (await auth())?.user?.id;
  if (!userId) return Response.json({ error: 'Sin sesión' }, { status: 401 });
  if (!pushConfigurado()) return Response.json({ error: 'Los avisos no están configurados' }, { status: 503 });

  const { endpoint } = (await req.json().catch(() => ({}))) as { endpoint?: unknown };
  if (typeof endpoint !== 'string') return Response.json({ error: 'Falta la suscripción' }, { status: 400 });

  const sub = await prisma.pushSub.findFirst({ where: { endpoint, userId } });
  if (!sub) return Response.json({ error: 'Este aparato no está suscrito' }, { status: 404 });

  const u = await prisma.user.findUnique({ where: { id: userId }, select: { streak: true } });
  const hoy = enZona(new Date(), sub.tz).dia;
  const pendientes = await prisma.progress.count({ where: { userId, due: { lte: hoy } } });
  const ok = await enviar(sub, textoAviso(pendientes, u?.streak ?? 0));
  return ok ? Response.json({ ok: true }) : Response.json({ error: 'No se pudo enviar' }, { status: 502 });
}
