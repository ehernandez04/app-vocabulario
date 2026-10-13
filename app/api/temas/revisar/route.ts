/**
 * Revisa con la IA una respuesta escrita que el ejercicio no reconoció (#66).
 *
 * Solo se llega acá si quien practica lo pidió: calificar contra las respuestas
 * aceptadas y los errores conocidos ya se hizo en el teléfono, sin red. Cuesta
 * un punto del tope diario y exige conexión; una revisión que falla por culpa
 * nuestra no cuenta.
 */

import { auth } from '@/auth';
import { SISTEMA_REVISAR } from '@/lib/ejercicios-ia';
import { temaPorId } from '@/lib/temas';
import { COSTE_REVISION, devolver, hoy, LIMITE_DIARIO, reservar, restantes } from '@/lib/uso-ia';

export const maxDuration = 30;

const MODELO = 'claude-haiku-5-5';

const mala = (mensaje: string, status = 400) => Response.json({ error: mensaje }, { status });

const texto = (v: unknown, max: number): string | null =>
  typeof v === 'string' && v.trim() && v.length <= max ? v.trim() : null;

export async function POST(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return mala('Sin sesión', 401);

  const clave = process.env.ANTHROPIC_API_KEY;
  if (!clave) return mala('El asistente no está configurado', 503);

  let c: Record<string, unknown>;
  try {
    c = (await req.json()) as Record<string, unknown>;
  } catch {
    return mala('El cuerpo no es JSON');
  }
  const tema = typeof c.tema === 'string' ? temaPorId(c.tema) : undefined;
  const nivel = tema?.niveles[typeof c.nivel === 'number' ? c.nivel - 1 : -1];
  const es = texto(c.es, 200);
  const respuesta = texto(c.respuesta, 200);
  // En un hueco la IA ve la frase completa, no solo la palabra escrita.
  const antes = typeof c.antes === 'string' ? c.antes.slice(0, 120) : '';
  const despues = typeof c.despues === 'string' ? c.despues.slice(0, 120) : '';
  if (!tema || !nivel || !es || !respuesta) return mala('Faltan datos');

  const dia = hoy();
  if (!(await reservar(userId, dia, COSTE_REVISION))) {
    return Response.json(
      { error: `Hoy ya usaste tus ${LIMITE_DIARIO} puntos de IA; mañana vuelves a tener.`, restantes: 0 },
      { status: 429 }
    );
  }

  const ingles = [antes, respuesta, despues].filter(Boolean).join(' ').replace(/\s+/g, ' ');
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': clave, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: MODELO,
        max_tokens: 600,
        // En Haiku 5.5 el pensamiento viene encendido: sin esto cada revisión gasta de más.
        output_config: { effort: 'low' },
        system: SISTEMA_REVISAR,
        messages: [
          {
            role: 'user',
            content: `Spanish: ${es}\nLearner's English: ${ingles}\nLevel focus: ${nivel.foco}`,
          },
        ],
      }),
      signal: AbortSignal.timeout(25000),
    });
    if (!r.ok) throw new Error(`Anthropic ${r.status}`);
    const datos = (await r.json()) as { content?: { type: string; text?: string }[] };
    const salida = (datos.content ?? []).filter((b) => b.type === 'text').map((b) => b.text ?? '').join('');
    const ini = salida.indexOf('{');
    const fin = salida.lastIndexOf('}');
    const v = JSON.parse(salida.slice(ini, fin + 1)) as { acierto?: unknown; explicacion?: unknown };
    if (typeof v.acierto !== 'boolean' || typeof v.explicacion !== 'string' || !v.explicacion.trim()) {
      throw new Error('Respuesta sin formato');
    }
    return Response.json({
      acierto: v.acierto,
      mensaje: v.explicacion.trim().slice(0, 240),
      restantes: await restantes(userId, dia),
    });
  } catch (e) {
    await devolver(userId, dia, COSTE_REVISION); // una revisión que falla por culpa nuestra no cuenta
    console.error('temas/revisar', e instanceof Error ? e.message : e);
    return mala('No se pudo revisar tu respuesta. Inténtalo de nuevo.', 502);
  }
}
