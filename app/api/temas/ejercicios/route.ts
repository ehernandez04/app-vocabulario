/**
 * Los ejercicios generados de una persona para un tema (#64). El teléfono los
 * descarga y los guarda; `desde` trae solo lo que cambió, incluidos los quitados
 * (con `deletedAt`), que es como se entera de que ya no valen.
 */

import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Quita un ejercicio (con marca de borrado) o lo devuelve: `{ id, quitado }`. */
export async function PATCH(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return Response.json({ error: 'Sin sesión' }, { status: 401 });

  const cuerpo = (await req.json().catch(() => null)) as { id?: unknown; quitado?: unknown } | null;
  if (!cuerpo || typeof cuerpo.id !== 'string' || !UUID.test(cuerpo.id) || typeof cuerpo.quitado !== 'boolean') {
    return Response.json({ error: 'Formato inesperado' }, { status: 400 });
  }
  // Solo los de esta cuenta. Si ya no existe, da igual: el resultado es el mismo.
  await prisma.temaEjercicio.updateMany({
    where: { id: cuerpo.id, userId },
    data: { deletedAt: cuerpo.quitado ? new Date() : null },
  });
  return Response.json({ ok: true });
}

export async function GET(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return Response.json({ error: 'Sin sesión' }, { status: 401 });

  const url = new URL(req.url);
  const tema = url.searchParams.get('tema');
  if (!tema) return Response.json({ error: 'Falta el tema' }, { status: 400 });
  const desdeTexto = url.searchParams.get('desde');
  const desde = desdeTexto ? new Date(desdeTexto) : null;
  if (desde && Number.isNaN(desde.getTime())) return Response.json({ error: 'Fecha inválida' }, { status: 400 });

  const filas = await prisma.temaEjercicio.findMany({
    where: { userId, tema, ...(desde ? { updatedAt: { gt: desde } } : { deletedAt: null }) },
    orderBy: { updatedAt: 'asc' },
  });
  return Response.json({
    ejercicios: filas.map((f) => ({
      id: f.id,
      nivel: f.nivel,
      tipo: f.tipo,
      datos: f.datos,
      updatedAt: f.updatedAt.toISOString(),
      deletedAt: f.deletedAt?.toISOString() ?? null,
    })),
  });
}
