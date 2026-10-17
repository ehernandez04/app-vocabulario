/** Cuántos turnos de conversación le quedan hoy a quien pregunta: el mínimo de IA y de voz. */

import { auth } from '@/auth';
import { hoy, restantes } from '@/lib/uso-ia';
import { restantesVoz } from '@/lib/uso-voz';

export async function GET() {
  const userId = (await auth())?.user?.id;
  if (!userId) return Response.json({ error: 'Sin sesión' }, { status: 401 });
  const dia = hoy();
  const [ia, voz] = await Promise.all([restantes(userId, dia), restantesVoz(userId, dia)]);
  return Response.json({ restantes: Math.min(ia, voz) });
}
