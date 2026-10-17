/** Cuántos puntos de IA lleva gastados quien pregunta hoy. Solo lectura: no reserva nada. */

import { auth } from '@/auth';
import { hoy, LIMITE_DIARIO, restantes } from '@/lib/uso-ia';

export async function GET() {
  const userId = (await auth())?.user?.id;
  if (!userId) return Response.json({ error: 'Sin sesión' }, { status: 401 });
  return Response.json({ restantes: await restantes(userId, hoy()), limite: LIMITE_DIARIO });
}
