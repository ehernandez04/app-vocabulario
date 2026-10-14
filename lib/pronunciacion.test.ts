import { describe, expect, it } from 'vitest';
import { describirSonido, estadoDe, interpretar, type RespuestaAzure } from './pronunciacion';
import { codificarWav } from './wav';

const fonema = (Phoneme: string, AccuracyScore: number, otro?: string) => ({
  Phoneme,
  AccuracyScore,
  ...(otro ? { NBestPhonemes: [{ Phoneme, Score: AccuracyScore }, { Phoneme: otro, Score: 80 }] } : {}),
});

const respuesta = (over: Partial<NonNullable<RespuestaAzure['NBest']>[0]> = {}): RespuestaAzure => ({
  RecognitionStatus: 'Success',
  NBest: [
    {
      Display: 'Dad will pay for the taxi.',
      AccuracyScore: 82,
      CompletenessScore: 100,
      Words: [
        { Word: 'dad', AccuracyScore: 90 },
        { Word: 'the', AccuracyScore: 40, Phonemes: [fonema('ð', 22, 'd'), fonema('ə', 70)] },
      ],
      ...over,
    },
  ],
});

describe('estadoDe', () => {
  it('es generoso: se te entiende con una precisión moderada si dijiste la frase entera', () => {
    expect(estadoDe(70, 100)).toBe('bien');
    expect(estadoDe(70, 70)).toBe('casi'); // le faltan palabras
    expect(estadoDe(50, 90)).toBe('casi');
    expect(estadoDe(30, 100)).toBe('repite');
  });
});

describe('interpretar', () => {
  it('marca las palabras flojas y el sonido más flojo, con con qué se confundió', () => {
    const r = interpretar(respuesta())!;
    expect(r.estado).toBe('bien');
    expect(r.flojas).toEqual(['the']);
    expect(r.sonido).toEqual({ palabra: 'the', esperado: 'ð', sonaComo: 'd' });
    expect(r.oido).toBe('Dad will pay for the taxi.');
  });

  it('lee las notas tanto sueltas como dentro de PronunciationAssessment', () => {
    const r = interpretar({
      RecognitionStatus: 'Success',
      NBest: [{ PronunciationAssessment: { AccuracyScore: 20, CompletenessScore: 100 }, Words: [] }],
    })!;
    expect(r.estado).toBe('repite');
  });

  it('una palabra omitida cuenta como floja aunque Azure le ponga nota alta', () => {
    const r = interpretar(respuesta({ Words: [{ Word: 'for', AccuracyScore: 100, ErrorType: 'Omission' }] }))!;
    expect(r.flojas).toEqual(['for']);
  });

  it('sin nada que evaluar devuelve null, para pedir otra toma sin cobrar', () => {
    expect(interpretar({ RecognitionStatus: 'NoMatch' })).toBeNull();
    expect(interpretar({ RecognitionStatus: 'Success', NBest: [] })).toBeNull();
  });

  it('señala un sonido flojo aunque su palabra salga bien (caso real de Azure)', () => {
    const r = interpretar(
      respuesta({
        Words: [
          { Word: 'will', AccuracyScore: 97, Phonemes: [fonema('w', 56, 'd'), fonema('ɪ', 100)] },
          { Word: 'we', AccuracyScore: 97, ErrorType: 'Insertion', Phonemes: [fonema('w', 10, 'ɹ')] },
        ],
      })
    )!;
    expect(r.flojas).toEqual([]);
    expect(r.sonido).toEqual({ palabra: 'will', esperado: 'w', sonaComo: 'd' });
  });

  it('sin palabras flojas no hay sonido que señalar', () => {
    const r = interpretar(respuesta({ Words: [{ Word: 'dad', AccuracyScore: 95 }] }))!;
    expect(r.flojas).toEqual([]);
    expect(r.sonido).toBeUndefined();
  });
});

describe('describirSonido', () => {
  it('nombra el sonido como lo escribe quien habla español y da un consejo', () => {
    expect(describirSonido({ palabra: 'the', esperado: 'ð', sonaComo: 'd' })).toEqual({
      titulo: 'La th de «the» suena como /d/',
      consejo: 'Lengua entre los dientes, como en «the», y haz vibrar la voz.',
    });
  });

  it('con un sonido sin ficha usa el símbolo, y sin confusión dice que sale flojo', () => {
    expect(describirSonido({ palabra: 'bird', esperado: 'ɜ' })?.titulo).toBe('El sonido /ɜ/ de «bird» sale flojo');
    expect(describirSonido(undefined)).toBeNull();
  });
});

describe('codificarWav', () => {
  it('escribe una cabecera WAV válida de 16 kHz, mono y 16 bits', () => {
    const wav = codificarWav(new Float32Array([0, 1, -1]));
    const v = new DataView(wav);
    const txt = (i: number, n: number) => String.fromCharCode(...new Uint8Array(wav, i, n));
    expect(txt(0, 4)).toBe('RIFF');
    expect(txt(8, 4)).toBe('WAVE');
    expect(v.getUint32(24, true)).toBe(16000);
    expect(v.getUint16(22, true)).toBe(1);
    expect(v.getUint16(34, true)).toBe(16);
    expect(v.getUint32(40, true)).toBe(6);
    expect([v.getInt16(44, true), v.getInt16(46, true), v.getInt16(48, true)]).toEqual([0, 32767, -32768]);
  });
});
