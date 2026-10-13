/**
 * Los ejercicios generados de una persona para un tema (#64). El teléfono los
 * descarga y los guarda; `desde` trae solo lo que cambió, incluidos los quitados
 * (con `deletedAt`), que es como se entera de que ya no valen.
 */

import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

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
