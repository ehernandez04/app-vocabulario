/**
 * Asistente para agregar una palabra (#50): escribes «run» y devuelve sus
 * significados, separados por tipo, con traducción, pronunciación y una frase.
 *
 * Gasta dinero en cada llamada (Claude), así que va detrás del login y con un
 * tope diario por persona. La clave de la API vive solo aquí, en el servidor.
 *
 * La pronunciación sale de un diccionario real cuando lo hay; el modelo la
 * propone y el diccionario la corrige. La traducción es del modelo.
 */

import { auth } from '@/auth';
import { pronunciacion } from '@/lib/diccionario';
import { POS, sanearSentidos, type Sentido } from '@/lib/palabra';
import { prisma } from '@/lib/prisma';

export const maxDuration = 30;

/** Búsquedas por persona y día. Ver CLAUDE.md. */
export const LIMITE_DIARIO = 30;

const MODELO = 'claude-haiku-5-5';

const SISTEMA = `You help a Spanish speaker learn English vocabulary. The user gives you an English word or short phrase (it may be inflected, e.g. "running", or slightly misspelled). Reply with ONLY a JSON object, no prose, no code fences:

{"sentidos":[{"en":"...","pos":"...","matiz":"...","es":"...","ipa":"...","xe":"...","xs":"...","emoji":"..."}]}

Rules:
- List the most common DISTINCT senses, grouped by part of speech, at most 4 in total. If the word has one main sense, return one.
- "en": the base form as it should be studied. Verbs in the infinitive with "to " ("to run"); nouns, adjectives and adverbs without articles ("run", "reliable"). Never add parentheses.
- "pos": exactly one of: ${POS.join(', ')}.
- "matiz": 1-2 Spanish words naming THIS sense, only when another sense has the same part of speech (e.g. "correr" for one, "dirigir" for the other). Never compare ("X vs Y"), never list alternatives; otherwise leave empty.
- "es": the Spanish translation, short and natural (neutral Spanish). Verbs in the infinitive.
- "ipa": American English IPA between slashes, e.g. "/rʌn/".
- "xe": one natural example sentence in English (about B1 level) that uses that sense. "xs": its Spanish translation.
- "emoji": one emoji that suggests the meaning.
- If the input is not an English word or phrase, or you cannot tell, return {"sentidos":[]}.`;

const mala = (mensaje: string, status = 400) => Response.json({ error: mensaje }, { status });

/** Reserva una búsqueda del día. false = ya se acabaron. */
async function reservar(userId: string, dia: string): Promise<boolean> {
  const tomada = await prisma.aiUsage.updateMany({
    where: { userId, day: dia, count: { lt: LIMITE_DIARIO } },
    data: { count: { increment: 1 } },
  });
  if (tomada.count > 0) return true;
  const fila = await prisma.aiUsage.findUnique({ where: { userId_day: { userId, day: dia } } });
  if (fila) return false; // existe y no cabe más
  await prisma.aiUsage.createMany({ data: [{ userId, day: dia, count: 1 }], skipDuplicates: true });
  return true;
}

const devolver = (userId: string, dia: string) =>
  prisma.aiUsage.updateMany({ where: { userId, day: dia, count: { gt: 0 } }, data: { count: { decrement: 1 } } });

export async function POST(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return mala('Sin sesión', 401);

  const clave = process.env.ANTHROPIC_API_KEY;
  if (!clave) return mala('El asistente no está configurado', 503);

  let texto = '';
  try {
    const cuerpo = (await req.json()) as { texto?: unknown };
    texto = typeof cuerpo.texto === 'string' ? cuerpo.texto.trim().replace(/\s+/g, ' ') : '';
  } catch {
    return mala('El cuerpo no es JSON');
  }
  if (!texto || texto.length > 60) return mala('Escribe una palabra o frase corta en inglés');

  const dia = new Date().toISOString().slice(0, 10);
  if (!(await reservar(userId, dia))) {
    return Response.json(
      { error: `Hoy ya usaste tus ${LIMITE_DIARIO} búsquedas; mañana vuelves a tener. Puedes agregar a mano.`, restantes: 0 },
      { status: 429 }
    );
  }

  let sentidos: Sentido[] = [];
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': clave, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: MODELO,
        max_tokens: 1500,
        // En Haiku 5.5 el pensamiento viene encendido: sin esto cada palabra gasta de más.
        output_config: { effort: 'low' },
        system: SISTEMA,
        messages: [{ role: 'user', content: texto }],
      }),
      signal: AbortSignal.timeout(25000),
    });
    if (!r.ok) throw new Error(`Anthropic ${r.status}`);
    const datos = (await r.json()) as { content?: { type: string; text?: string }[] };
    const salida = (datos.content ?? []).filter((b) => b.type === 'text').map((b) => b.text ?? '').join('');
    const json = salida.slice(salida.indexOf('{'), salida.lastIndexOf('}') + 1);
    sentidos = sanearSentidos(JSON.parse(json));
  } catch (e) {
    await devolver(userId, dia); // una búsqueda que falla por culpa nuestra no cuenta
    console.error('palabra/buscar', e instanceof Error ? e.message : e);
    return mala('No se pudo consultar al asistente. Inténtalo de nuevo o agrega a mano.', 502);
  }

  // El diccionario corrige la pronunciación, una consulta por palabra distinta.
  const bases = [...new Set(sentidos.map((s) => s.en.toLowerCase().replace(/^to\s+/, '')))];
  const pron = new Map(await Promise.all(bases.map(async (b) => [b, await pronunciacion(b)] as const)));
  let delDiccionario = 0;
  for (const s of sentidos) {
    const ipa = pron.get(s.en.toLowerCase().replace(/^to\s+/, ''));
    if (ipa) {
      s.ipa = ipa;
      delDiccionario++;
    }
  }

  const gastadas = await prisma.aiUsage.findUnique({ where: { userId_day: { userId, day: dia } } });
  return Response.json({
    sentidos,
    restantes: Math.max(0, LIMITE_DIARIO - (gastadas?.count ?? 0)),
    pronunciacionDeDiccionario: delDiccionario,
  });
}
