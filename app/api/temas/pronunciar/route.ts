/**
 * Evalúa la pronunciación de una toma contra una frase (#68) con Azure Speech
 * (pronunciation assessment). Exige login y tiene un tope diario propio
 * (lib/uso-voz.ts). La clave de Azure vive solo en el servidor; sin ella la ruta
 * contesta 503, como las demás rutas de IA.
 */

import { auth } from '@/auth';
import { interpretar, type RespuestaAzure } from '@/lib/pronunciacion';
import { hoy } from '@/lib/uso-ia';
import { devolverVoz, LIMITE_VOZ, reservarVoz, restantesVoz } from '@/lib/uso-voz';

export const maxDuration = 30;

/** Un WAV de 16 kHz y 16 bits pesa unos 32 KB por segundo: esto da de sobra para 8 s. */
const MAX_BYTES = 600_000;

const mala = (mensaje: string, status = 400) => Response.json({ error: mensaje }, { status });

export async function POST(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return mala('Sin sesión', 401);

  const clave = process.env.AZURE_SPEECH_KEY;
  const region = process.env.AZURE_SPEECH_REGION;
  if (!clave || !region) return mala('La evaluación de pronunciación no está configurada', 503);

  let datos: FormData;
  try {
    datos = await req.formData();
  } catch {
    return mala('El cuerpo no es un formulario');
  }
  const texto = datos.get('texto');
  const audio = datos.get('audio');
  if (typeof texto !== 'string' || !texto.trim() || texto.length > 200) return mala('Falta la frase');
  if (!(audio instanceof Blob) || audio.size < 1000) return mala('Falta la grabación');
  if (audio.size > MAX_BYTES) return mala('La grabación es demasiado larga');

  const dia = hoy();
  if (!(await reservarVoz(userId, dia))) {
    return Response.json(
      { error: `Hoy ya usaste tus ${LIMITE_VOZ} evaluaciones de voz; mañana vuelves a tener.`, restantes: 0 },
      { status: 429 }
    );
  }

  const evaluacion = {
    ReferenceText: texto.trim(),
    GradingSystem: 'HundredMark',
    Granularity: 'Phoneme',
    Dimension: 'Comprehensive',
    EnableMiscue: 'True',
    PhonemeAlphabet: 'IPA',
    NBestPhonemeCount: 3,
  };

  try {
    const r = await fetch(
      `https://${region}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=en-US&format=detailed`,
      {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': clave,
          'Content-Type': 'audio/wav; codecs=audio/pcm; samplerate=16000',
          Accept: 'application/json',
          'Pronunciation-Assessment': Buffer.from(JSON.stringify(evaluacion)).toString('base64'),
        },
        body: await audio.arrayBuffer(),
        signal: AbortSignal.timeout(20_000),
      }
    );
    if (!r.ok) {
      await devolverVoz(userId, dia);
      console.error('Azure Speech respondió', r.status);
      return mala('No se pudo evaluar tu pronunciación. Inténtalo de nuevo.', 502);
    }
    const resultado = interpretar((await r.json()) as RespuestaAzure);
    const restantes = await restantesVoz(userId, dia);
    // Sin voz que evaluar (silencio o ruido): se pide otra toma y no se cobra.
    if (!resultado) {
      await devolverVoz(userId, dia);
      return Response.json({ sinVoz: true, restantes: restantes + 1 });
    }
    return Response.json({ ...resultado, restantes });
  } catch (e) {
    await devolverVoz(userId, dia);
    console.error('Evaluar pronunciación falló', e);
    return mala('No se pudo evaluar tu pronunciación. Inténtalo de nuevo.', 502);
  }
}
