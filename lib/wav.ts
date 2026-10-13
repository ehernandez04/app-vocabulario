/**
 * Pasa la toma del micrófono a WAV de 16 kHz y 16 bits (#68). Azure no entiende
 * lo que graba cada navegador (webm en Chrome, mp4 en iPhone), pero sí un WAV, así
 * que se decodifica acá y se manda así.
 */

export const HZ = 16000;

/** Muestras en coma flotante (-1..1) a un archivo WAV mono de 16 bits. */
export function codificarWav(muestras: Float32Array, hz = HZ): ArrayBuffer {
  const buf = new ArrayBuffer(44 + muestras.length * 2);
  const v = new DataView(buf);
  const texto = (en: number, t: string) => [...t].forEach((c, i) => v.setUint8(en + i, c.charCodeAt(0)));
  texto(0, 'RIFF');
  v.setUint32(4, 36 + muestras.length * 2, true);
  texto(8, 'WAVE');
  texto(12, 'fmt ');
  v.setUint32(16, 16, true); // tamaño del bloque fmt
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // mono
  v.setUint32(24, hz, true);
  v.setUint32(28, hz * 2, true); // bytes por segundo
  v.setUint16(32, 2, true); // bytes por muestra
  v.setUint16(34, 16, true);
  texto(36, 'data');
  v.setUint32(40, muestras.length * 2, true);
  muestras.forEach((m, i) => {
    const x = Math.max(-1, Math.min(1, m));
    v.setInt16(44 + i * 2, x < 0 ? x * 0x8000 : x * 0x7fff, true);
  });
  return buf;
}

/** Decodifica la toma, la baja a mono y 16 kHz y la deja como WAV. Solo en el navegador. */
export async function tomaAWav(toma: Blob): Promise<Blob> {
  const ac = new AudioContext();
  try {
    const original = await ac.decodeAudioData(await toma.arrayBuffer());
    const largo = Math.ceil(original.duration * HZ);
    const fuera = new OfflineAudioContext(1, largo, HZ);
    const fuente = fuera.createBufferSource();
    fuente.buffer = original;
    fuente.connect(fuera.destination);
    fuente.start();
    const mono = (await fuera.startRendering()).getChannelData(0);
    return new Blob([codificarWav(mono)], { type: 'audio/wav' });
  } finally {
    ac.close().catch(() => {});
  }
}
