/**
 * Suscribir este aparato al recordatorio diario (#14), o darlo de baja.
 * La hora y la zona viajan con la suscripción: el cron decide con ellas.
 */

import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { HORA_RE, zonaValida } from '@/lib/recordatorio';

const mala = (mensaje: string, status = 400) => Response.json({ error: mensaje }, { status });

const texto = (v: unknown, max: number) => (typeof v === 'string' && v.length > 0 && v.length <= max ? v : null);

export async function POST(req: Request) {
  const userId = (await auth())?.user?.id;
  if (!userId) return mala('Sin sesión', 401);

  let c: { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown }; hour?: unknown; tz?: unknown };
  try {
    c = await req.json();
  } catch {
    return mala('El cuerpo no es JSON');
  }
  const endpoint = texto(c.endpoint, 1000);
  const p256dh = texto(c.keys?.p256dh, 200);
  const clave = texto(c.keys?.auth, 100);
  if (!endpoint || !p256dh || !clave || !endpoint.startsWith('https://')) return mala('Suscripción no válida');
  if (typeof c.hour !== 'string' || !HORA_RE.test(c.hour)) return mala('La hora no es válida');
  if (!zonaValida(c.tz)) return mala('La zona horaria no es válida');

  const usuario = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!usuario) return mala('Sesión sin cuenta', 401);

  // Un mismo aparato puede cambiar de dueño (otra cuenta en el mismo navegador):
  // el endpoint manda y pasa a la cuenta nueva.
  await prisma.pushSub.upsert({
    where: { endpoint },
    create: { userId, endpoint, p256dh, auth: clave, hour: c.hour, tz: c.tz },
    update: { userId, p256dh, auth: clave, hour: c.hour, tz: c.tz },
  });
  return Response.json({ ok: true });
}

export async function DELETE(req: Request) {
  const userId = (await auth())?.user?.id;
  if (!userId) return mala('Sin sesión', 401);
  const { endpoint } = (await req.json().catch(() => ({}))) as { endpoint?: unknown };
  if (typeof endpoint !== 'string') return mala('Falta la suscripción');
  await prisma.pushSub.deleteMany({ where: { endpoint, userId } });
  return Response.json({ ok: true });
}
