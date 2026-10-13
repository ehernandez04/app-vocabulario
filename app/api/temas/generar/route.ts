/**
 * Genera una tanda de ejercicios para un tema y nivel (#64) y la guarda en la
 * cuenta de quien la pide. Cuesta dinero (Claude) y exige conexión, así que va
 * detrás del login y cuenta contra el tope diario; practicar después no gasta.
 */

import { auth } from '@/auth';
import { leerEjercicios, pedido, POR_TANDA, sanearEjercicios, SISTEMA } from '@/lib/ejercicios-ia';
import { prisma } from '@/lib/prisma';
import { temaPorId, type Ejercicio } from '@/lib/temas';
import { COSTE_EJERCICIOS, devolver, hoy, LIMITE_DIARIO, reservar, restantes } from '@/lib/uso-ia';

export const maxDuration = 60;

const MODELO = 'claude-haiku-5-5';

const mala = (mensaje: string, status = 400) => Response.json({ error: mensaje }, { status });

export async function POST(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return mala('Sin sesión', 401);

  const clave = process.env.ANTHROPIC_API_KEY;
  if (!clave) return mala('El asistente no está configurado', 503);

  let idTema = '';
  let numNivel = 0;
  try {
    const c = (await req.json()) as { tema?: unknown; nivel?: unknown };
    idTema = typeof c.tema === 'string' ? c.tema : '';
    numNivel = typeof c.nivel === 'number' ? c.nivel : 0;
  } catch {
    return mala('El cuerpo no es JSON');
  }
  const tema = temaPorId(idTema);
  const nivel = tema?.niveles[numNivel - 1];
  if (!tema || !nivel) return mala('Ese tema o nivel no existe');

  // Lo que ya tiene (de mano y generado), para que la IA no lo repita.
  const previos = await prisma.temaEjercicio.findMany({
    where: { userId, tema: tema.id, nivel: numNivel, deletedAt: null },
    select: { datos: true },
    orderBy: { createdAt: 'desc' },
    take: 80,
  });
  const yaTengo = [...nivel.ejercicios.map((e) => e.es), ...previos.map((p) => (p.datos as Ejercicio).es)];

  const dia = hoy();
  if (!(await reservar(userId, dia, COSTE_EJERCICIOS))) {
    return Response.json(
      { error: `Hoy ya usaste tus ${LIMITE_DIARIO} puntos de IA; mañana vuelves a tener.`, restantes: 0 },
      { status: 429 }
    );
  }

  // Dos peticiones paralelas de la mitad: una sola de 40 tardaba cerca de un minuto,
  // al borde del límite. Cuestan lo mismo y se cuentan como un solo punto.
  const pedir = async (cantidad: number): Promise<Ejercicio[]> => {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': clave, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: MODELO,
        max_tokens: 8000,
        // En Haiku 5.5 el pensamiento viene encendido: sin esto cada tanda gasta de más.
        output_config: { effort: 'low' },
        system: SISTEMA,
        messages: [{ role: 'user', content: pedido(tema, nivel, cantidad, yaTengo.slice(0, 40)) }],
      }),
      signal: AbortSignal.timeout(55000),
    });
    if (!r.ok) throw new Error(`Anthropic ${r.status}`);
    const datos = (await r.json()) as { content?: { type: string; text?: string }[] };
    const salida = (datos.content ?? []).filter((b) => b.type === 'text').map((b) => b.text ?? '').join('');
    return sanearEjercicios(leerEjercicios(salida), yaTengo);
  };

  let nuevos: Ejercicio[] = [];
  try {
    const mitades = await Promise.allSettled([pedir(POR_TANDA / 2), pedir(POR_TANDA / 2)]);
    // Si una mitad falla se aprovecha la otra. Las dos no se ven entre sí: se quitan las repetidas al juntarlas.
    const buenas = mitades.flatMap((m) => (m.status === 'fulfilled' ? m.value : []));
    if (mitades.every((m) => m.status === 'rejected')) throw new Error('Fallaron las dos peticiones');
    nuevos = sanearEjercicios({ ejercicios: buenas }, yaTengo);
    if (!nuevos.length) throw new Error('Sin ejercicios válidos');
  } catch (e) {
    await devolver(userId, dia, COSTE_EJERCICIOS); // una tanda que falla por culpa nuestra no cuenta
    console.error('temas/generar', e instanceof Error ? e.message : e);
    return mala('No se pudieron generar ejercicios. Inténtalo de nuevo.', 502);
  }

  await prisma.temaEjercicio.createMany({
    data: nuevos.map((e) => ({ userId, tema: tema.id, nivel: numNivel, tipo: 'elegir', datos: e })),
  });

  return Response.json({ generados: nuevos.length, restantes: await restantes(userId, dia) });
}
