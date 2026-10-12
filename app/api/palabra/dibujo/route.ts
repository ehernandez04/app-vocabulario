/**
 * Dibujo con IA para una palabra (#53): devuelve un SVG pequeño que ilustra el
 * significado, hecho por el modelo que elige quien lo pide.
 *
 * Gasta dinero: va detrás del login y contra el mismo tope diario que las
 * búsquedas, con un coste mayor. El SVG que contesta el modelo no se devuelve tal
 * cual: se reconstruye con una lista corta de etiquetas y atributos (lib/svg.ts).
 */

import { auth } from '@/auth';
import { sanearSvg } from '@/lib/svg';
import { COSTE_DIBUJO, devolver, hoy, LIMITE_DIARIO, reservar, restantes } from '@/lib/uso-ia';

export const maxDuration = 60;

/** El nombre que ve el usuario → el modelo. Haiku, Sonnet y Opus, de menos a más fino. */
const MODELOS = {
  haiku: 'claude-haiku-5-5',
  sonnet: 'claude-sonnet-5-5',
  opus: 'claude-opus-5-5',
} as const;

const SISTEMA = `You draw tiny flat illustrations for vocabulary flashcards. Reply with ONLY one <svg> element, nothing else.
Rules: viewBox="0 0 64 64", no width/height, no text or letters, no <script>, no external references, no images, no gradients/filters. Only these elements: svg, g, path, circle, ellipse, rect, line, polyline, polygon.
Style: bold flat shapes, rounded line caps, 2.5px strokes in #1C1B19, fills from this palette only: #FFE066 #FFB4A2 #B8E1FF #C8F0A8 #F3EFE6. One clear central subject that suggests the meaning at a glance; at most 8 shapes; under 1200 characters.
When the word is abstract, draw a metaphor or a small scene that shows the idea (not a literal box or symbol).`;

const mala = (mensaje: string, status = 400) => Response.json({ error: mensaje }, { status });

export async function POST(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return mala('Sin sesión', 401);

  const clave = process.env.ANTHROPIC_API_KEY;
  if (!clave) return mala('El asistente no está configurado', 503);

  let en = '';
  let es = '';
  let modelo: keyof typeof MODELOS = 'haiku';
  try {
    const c = (await req.json()) as { en?: unknown; es?: unknown; modelo?: unknown };
    en = typeof c.en === 'string' ? c.en.trim().slice(0, 80) : '';
    es = typeof c.es === 'string' ? c.es.trim().slice(0, 120) : '';
    if (typeof c.modelo === 'string' && c.modelo in MODELOS) modelo = c.modelo as keyof typeof MODELOS;
  } catch {
    return mala('El cuerpo no es JSON');
  }
  if (!en) return mala('Falta la palabra');

  const dia = hoy();
  if (!(await reservar(userId, dia, COSTE_DIBUJO))) {
    return Response.json(
      { error: `Hoy ya usaste tus ${LIMITE_DIARIO} puntos de IA (un dibujo vale ${COSTE_DIBUJO}); mañana vuelves a tener.`, restantes: await restantes(userId, dia) },
      { status: 429 }
    );
  }

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': clave, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: MODELOS[modelo],
        max_tokens: 2500,
        output_config: { effort: 'low' },
        system: SISTEMA,
        messages: [{ role: 'user', content: `English word: "${en}"${es ? ` (Spanish: ${es})` : ''}. Draw it.` }],
      }),
      signal: AbortSignal.timeout(50000),
    });
    if (!r.ok) throw new Error(`Anthropic ${r.status}`);
    const datos = (await r.json()) as { content?: { type: string; text?: string }[] };
    const salida = (datos.content ?? []).filter((b) => b.type === 'text').map((b) => b.text ?? '').join('');
    const svg = sanearSvg(salida);
    if (!svg) throw new Error('El SVG no pasó el saneado');
    return Response.json({ svg, restantes: await restantes(userId, dia) });
  } catch (e) {
    await devolver(userId, dia, COSTE_DIBUJO); // un dibujo que falla por culpa nuestra no cuenta
    console.error('palabra/dibujo', e instanceof Error ? e.message : e);
    return mala('No salió el dibujo. Inténtalo otra vez o quédate con el emoji.', 502);
  }
}
