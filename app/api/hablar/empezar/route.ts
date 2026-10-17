/**
 * Arranca una conversación hablada con la IA (#78): una situación y la primera
 * línea de la IA en su papel, con su audio. Cuenta como una vuelta del tope de
 * IA; la voz es aparte y puede faltar si se acabó el tope mensual de ElevenLabs,
 * sin que la conversación se rompa por eso.
 */

import { auth } from '@/auth';
import { pedidoInicio, sanearInicio, SISTEMA_HABLA } from '@/lib/habla-ia';
import { sintetizar } from '@/lib/tts';
import { temaPorId } from '@/lib/temas';
import { COSTE_HABLA, devolver, hoy, LIMITE_DIARIO, reservar, restantes } from '@/lib/uso-ia';
import { devolverCaracteres, mesActual, reservarCaracteres } from '@/lib/uso-tts';

export const maxDuration = 30;

const MODELO = 'claude-haiku-5-5';

const mala = (mensaje: string, status = 400) => Response.json({ error: mensaje }, { status });

export async function POST(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return mala('Sin sesión', 401);

  const claveIA = process.env.ANTHROPIC_API_KEY;
  if (!claveIA) return mala('El asistente no está configurado', 503);

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

  const dia = hoy();
  if (!(await reservar(userId, dia, COSTE_HABLA))) {
    return Response.json(
      { error: `Hoy ya usaste tus ${LIMITE_DIARIO} puntos de IA; mañana vuelves a tener.`, restantes: 0 },
      { status: 429 }
    );
  }

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': claveIA, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: MODELO,
        max_tokens: 500,
        output_config: { effort: 'low' },
        system: SISTEMA_HABLA,
        messages: [{ role: 'user', content: pedidoInicio(tema, nivel) }],
      }),
      signal: AbortSignal.timeout(25_000),
    });
    if (!r.ok) throw new Error(`Anthropic ${r.status}`);
    const datos = (await r.json()) as { content?: { type: string; text?: string }[] };
    const salida = (datos.content ?? []).filter((b) => b.type === 'text').map((b) => b.text ?? '').join('');
    const inicio = sanearInicio(salida);
    if (!inicio) throw new Error('Respuesta sin forma');

    const claveTts = process.env.ELEVENLABS_API_KEY;
    let audio: string | null = null;
    const mes = mesActual();
    if (claveTts && (await reservarCaracteres(mes, inicio.apertura.length))) {
      try {
        audio = (await sintetizar(inicio.apertura, claveTts)).toString('base64');
      } catch {
        await devolverCaracteres(mes, inicio.apertura.length);
      }
    }

    return Response.json({ ...inicio, audio, restantes: await restantes(userId, dia) });
  } catch (e) {
    await devolver(userId, dia, COSTE_HABLA);
    console.error('Empezar a hablar falló', e);
    return mala('No se pudo empezar la conversación. Inténtalo de nuevo.', 502);
  }
}
