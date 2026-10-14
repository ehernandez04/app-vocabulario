/**
 * Pronunciación (#62, #68). Lo de acá es puro: traduce la respuesta de Azure
 * Speech (pronunciation assessment) a lo que la app dice, sin números sueltos.
 *
 * El objetivo es que se te entienda, no borrar el acento, así que los umbrales
 * son generosos y hablan de «se te entiende». Son provisionales: hay que
 * calibrarlos con grabaciones reales antes de darlos por buenos.
 */

export type EstadoVoz = 'bien' | 'casi' | 'repite';

/** Se te entiende bien: precisión y frase completa por encima de estos mínimos. */
export const UMBRAL_BIEN = { precision: 65, completa: 85 };
/** Casi: se entiende en buena parte. Por debajo, conviene repetir. */
export const UMBRAL_CASI = { precision: 45, completa: 60 };
/** Una palabra con menos de esto se marca como floja. */
export const UMBRAL_PALABRA = 60;
/**
 * Un sonido con menos de esto se señala aunque su palabra salga bien: con voces
 * nativas de prueba todos pasan de 80, y quien tiene acento fuerte saca 50-60 en
 * un sonido dentro de una palabra con 97.
 */
export const UMBRAL_FONEMA = 60;

export type Sonido = {
  /** La palabra donde está el sonido flojo. */
  palabra: string;
  /** El sonido esperado, en IPA. */
  esperado: string;
  /** Con qué sonido se confundió, si Azure lo dice. */
  sonaComo?: string;
};

export type ResultadoVoz = {
  estado: EstadoVoz;
  /** Palabras de la referencia que salieron flojas o no se dijeron, tal como están en la frase. */
  flojas: string[];
  /** El sonido más flojo de las palabras flojas, si lo hay. */
  sonido?: Sonido;
  /** Qué entendió Azure, para mostrar si hace falta. */
  oido: string;
};

type Num = number | undefined;
type Fonema = { Phoneme?: string; AccuracyScore?: Num; PronunciationAssessment?: { AccuracyScore?: Num }; NBestPhonemes?: { Phoneme?: string; Score?: Num }[] };
type Palabra = { Word?: string; AccuracyScore?: Num; ErrorType?: string; PronunciationAssessment?: { AccuracyScore?: Num; ErrorType?: string }; Phonemes?: Fonema[] };
type Mejor = {
  Display?: string;
  Lexical?: string;
  AccuracyScore?: Num;
  CompletenessScore?: Num;
  PronunciationAssessment?: { AccuracyScore?: Num; CompletenessScore?: Num };
  Words?: Palabra[];
};
export type RespuestaAzure = { RecognitionStatus?: string; NBest?: Mejor[] };

/** Según la versión del servicio, las notas vienen sueltas o dentro de `PronunciationAssessment`. */
const nota = (x: object, k: string): number | undefined => {
  const o = x as { PronunciationAssessment?: Record<string, unknown> } & Record<string, unknown>;
  const v = o.PronunciationAssessment?.[k] ?? o[k];
  return typeof v === 'number' ? v : undefined;
};

export function estadoDe(precision: number, completa: number): EstadoVoz {
  if (precision >= UMBRAL_BIEN.precision && completa >= UMBRAL_BIEN.completa) return 'bien';
  if (precision >= UMBRAL_CASI.precision && completa >= UMBRAL_CASI.completa) return 'casi';
  return 'repite';
}

/** null = Azure no oyó nada que evaluar (silencio, ruido): se pide repetir sin cobrar. */
export function interpretar(r: RespuestaAzure): ResultadoVoz | null {
  const m = r.NBest?.[0];
  if (r.RecognitionStatus !== 'Success' || !m) return null;
  const precision = nota(m, 'AccuracyScore') ?? 0;
  const completa = nota(m, 'CompletenessScore') ?? 0;

  const flojas: string[] = [];
  let peor: { nota: number; sonido: Sonido } | undefined;
  for (const w of m.Words ?? []) {
    const texto = w.Word ?? '';
    if (!texto) continue;
    const notaP = nota(w, 'AccuracyScore') ?? 100;
    const tipo = w.PronunciationAssessment?.ErrorType ?? w.ErrorType;
    // Una palabra de más (Insertion) no es de la frase: no se marca ni se mira.
    if (tipo === 'Insertion') continue;
    if (notaP < UMBRAL_PALABRA || tipo === 'Omission') flojas.push(texto);
    // Los sonidos se miran en todas las palabras: un sonido flojo puede estar en una palabra con buena nota.
    for (const f of w.Phonemes ?? []) {
      const nf = nota(f, 'AccuracyScore') ?? 100;
      if (!f.Phoneme || nf >= UMBRAL_FONEMA || (peor && nf >= peor.nota)) continue;
      const otro = f.NBestPhonemes?.find((n) => n.Phoneme && n.Phoneme !== f.Phoneme);
      peor = { nota: nf, sonido: { palabra: texto, esperado: f.Phoneme, ...(otro?.Phoneme ? { sonaComo: otro.Phoneme } : {}) } };
    }
  }
  return { estado: estadoDe(precision, completa), flojas, ...(peor ? { sonido: peor.sonido } : {}), oido: m.Display ?? m.Lexical ?? '' };
}

/** Cómo se escribe y se explica cada sonido a quien habla español. Solo los que más cuestan. */
const SONIDOS: Record<string, { grafia: string; consejo: string }> = {
  θ: { grafia: 'th', consejo: 'Pon la punta de la lengua entre los dientes y deja salir el aire.' },
  ð: { grafia: 'th', consejo: 'Lengua entre los dientes, como en «the», y haz vibrar la voz.' },
  ʃ: { grafia: 'sh', consejo: 'Labios algo redondeados y el aire sale como pidiendo silencio.' },
  tʃ: { grafia: 'ch', consejo: 'Como la «ch» del español, pero sin apretar tanto.' },
  dʒ: { grafia: 'j', consejo: 'Como una «y» fuerte, con la lengua pegada arriba al empezar.' },
  v: { grafia: 'v', consejo: 'Apoya los dientes de arriba en el labio de abajo; no es una «b».' },
  h: { grafia: 'h', consejo: 'Sale solo aire desde la garganta, más suave que la «j» española.' },
  ɪ: { grafia: 'i', consejo: 'Una «i» corta y relajada, sin llegar a la «i» española.' },
  ŋ: { grafia: 'ng', consejo: 'La lengua no toca delante: el sonido sale por la nariz, sin «g» marcada.' },
  ɹ: { grafia: 'r', consejo: 'La lengua se curva hacia atrás sin llegar a tocar; no vibra.' },
};

/** La frase que se le muestra a quien practica, o null si no hay un sonido que señalar. */
export function describirSonido(s: Sonido | undefined): { titulo: string; consejo?: string } | null {
  if (!s) return null;
  const info = SONIDOS[s.esperado];
  const grafia = info?.grafia;
  const sonido = grafia ? `la ${grafia} de «${s.palabra}»` : `el sonido /${s.esperado}/ de «${s.palabra}»`;
  const como = s.sonaComo ? ` suena como /${s.sonaComo}/` : ' sale flojo';
  return { titulo: sonido.charAt(0).toUpperCase() + sonido.slice(1) + como, consejo: info?.consejo };
}

export const TITULO_ESTADO: Record<EstadoVoz, string> = {
  bien: 'Se te entiende bien',
  casi: 'Casi',
  repite: 'Repítela',
};
