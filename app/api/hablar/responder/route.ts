/**
 * Sigue la conversación hablada con la IA (#78): transcribe tu turno con Azure
 * Speech (el mismo servicio que la pronunciación, #68, pero sin evaluarla),
 * genera la respuesta con Claude y la sintetiza con ElevenLabs. Tres costos
 * distintos, tres topes distintos (ver lib/uso-voz.ts, lib/uso-ia.ts, lib/uso-tts.ts).
 */

import { auth } from '@/auth';
import { pedidoSiguiente, sanearSiguiente, SISTEMA_HABLA, type Turno } from '@/lib/habla-ia';
import { sintetizar } from '@/lib/tts';
import { temaPorId } from '@/lib/temas';
import { COSTE_HABLA, devolver, hoy, LIMITE_DIARIO, reservar, restantes } from '@/lib/uso-ia';
import { devolverCaracteres, mesActual, reservarCaracteres } from '@/lib/uso-tts';
import { devolverVoz, LIMITE_VOZ, reservarVoz, restantesVoz } from '@/lib/uso-voz';

export const maxDuration = 30;

const MODELO = 'claude-haiku-5-5';

/** Un WAV de 16 kHz y 16 bits pesa unos 32 KB por segundo: esto da de sobra para 20 s. */
const MAX_BYTES = 1_200_000;

const mala = (mensaje: string, status = 400) => Response.json({ error: mensaje }, { status });

export async function POST(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return mala('Sin sesión', 401);

  const claveAzure = process.env.AZURE_SPEECH_KEY;
  const region = process.env.AZURE_SPEECH_REGION;
  const claveIA = process.env.ANTHROPIC_API_KEY;
  if (!claveAzure || !region || !claveIA) return mala('La conversación no está configurada', 503);

  let datos: FormData;
  try {
    datos = await req.formData();
  } catch {
    return mala('El cuerpo no es un formulario');
  }
  const idTema = datos.get('tema');
  const numNivel = Number(datos.get('nivel'));
  const audio = datos.get('audio');
  let historia: Turno[] = [];
  try {
    const bruto = JSON.parse(String(datos.get('historia') ?? '[]'));
    if (Array.isArray(bruto)) {
      historia = bruto.filter(
        (t): t is Turno => t && (t.quien === 'ia' || t.quien === 'tu') && typeof t.texto === 'string'
      );
    }
  } catch {
    return mala('El historial no es JSON');
  }
  if (typeof idTema !== 'string') return mala('Falta el tema');
  const tema = temaPorId(idTema);
  const nivel = tema?.niveles[numNivel - 1];
  if (!tema || !nivel) return mala('Ese tema o nivel no existe');
  if (!(audio instanceof Blob) || audio.size < 1000) return mala('Falta la grabación');
  if (audio.size > MAX_BYTES) return mala('La grabación es demasiado larga');

  const dia = hoy();
  if (!(await reservarVoz(userId, dia))) {
    return Response.json({ error: `Hoy ya usaste tus ${LIMITE_VOZ} evaluaciones de voz; mañana vuelves a tener.` }, { status: 429 });
  }

  let dicho = '';
  try {
    const r = await fetch(
      `https://${region}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=en-US&format=detailed`,
      {
        method: 'POST',
        headers: { 'Ocp-Apim-Subscription-Key': claveAzure, 'Content-Type': 'audio/wav; codecs=audio/pcm; samplerate=16000', Accept: 'application/json' },
        body: await audio.arrayBuffer(),
        signal: AbortSignal.timeout(20_000),
      }
    );
    if (!r.ok) throw new Error(`Azure ${r.status}`);
    const d = (await r.json()) as { RecognitionStatus?: string; DisplayText?: string; NBest?: { Display?: string; Lexical?: string }[] };
    if (d.RecognitionStatus !== 'Success') {
      await devolverVoz(userId, dia);
      return Response.json({ sinVoz: true });
    }
    dicho = d.DisplayText ?? d.NBest?.[0]?.Display ?? d.NBest?.[0]?.Lexical ?? '';
    if (!dicho) {
      await devolverVoz(userId, dia);
      return Response.json({ sinVoz: true });
    }
  } catch (e) {
    await devolverVoz(userId, dia);
    console.error('Transcribir falló', e);
    return mala('No se pudo entender tu grabación. Inténtalo de nuevo.', 502);
  }

  if (!(await reservar(userId, dia, COSTE_HABLA))) {
    return Response.json(
      { error: `Hoy ya usaste tus ${LIMITE_DIARIO} puntos de IA; mañana vuelves a tener.`, transcripcion: dicho, restantes: 0 },
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
        messages: [{ role: 'user', content: pedidoSiguiente(tema, nivel, historia, dicho) }],
      }),
      signal: AbortSignal.timeout(25_000),
    });
    if (!r.ok) throw new Error(`Anthropic ${r.status}`);
    const cuerpo = (await r.json()) as { content?: { type: string; text?: string }[] };
    const salida = (cuerpo.content ?? []).filter((b) => b.type === 'text').map((b) => b.text ?? '').join('');
    const siguiente = sanearSiguiente(salida);
    if (!siguiente) throw new Error('Respuesta sin forma');

    const claveTts = process.env.ELEVENLABS_API_KEY;
    let audioBase64: string | null = null;
    const mes = mesActual();
    if (claveTts && (await reservarCaracteres(mes, siguiente.respuesta.length))) {
      try {
        audioBase64 = (await sintetizar(siguiente.respuesta, claveTts)).toString('base64');
      } catch {
        await devolverCaracteres(mes, siguiente.respuesta.length);
      }
    }

    return Response.json({
      transcripcion: dicho,
      respuesta: siguiente.respuesta,
      audio: audioBase64,
      restantes: Math.min(await restantes(userId, dia), await restantesVoz(userId, dia)),
    });
  } catch (e) {
    await devolver(userId, dia, COSTE_HABLA);
    console.error('Responder al hablar falló', e);
    return mala('No se pudo generar la respuesta. Inténtalo de nuevo.', 502);
  }
}
