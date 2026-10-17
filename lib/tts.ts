/**
 * Síntesis de voz en caliente con ElevenLabs (#78): la respuesta de la IA al
 * conversar no se puede pregenerar, porque cada frase es nueva. Primer uso en
 * caliente de ElevenLabs en el servidor; antes solo lo llamaba el script de
 * generar el mazo (scripts/generate-audio.mjs).
 *
 * Misma voz y mismo `model_id` que ese script, para no sumar otra decisión:
 * Sarah, la voz por defecto del mazo.
 */

const VOZ_ID = 'EXAVITQu4vr4xnSDxMaL'; // Sarah, la voz por defecto del mazo (scripts/generate-audio.mjs)

export async function sintetizar(texto: string, clave: string): Promise<Buffer> {
  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOZ_ID}`, {
    method: 'POST',
    headers: { 'xi-api-key': clave, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
    body: JSON.stringify({
      text: texto,
      model_id: 'eleven_multilingual_v2',
      voice_settings: { stability: 0.5, similarity_boost: 0.75 },
    }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!r.ok) throw new Error(`ElevenLabs ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
}
