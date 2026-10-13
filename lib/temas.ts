/**
 * Aprender por tema (#39). Todo lo de acá es puro, así que se puede probar sin
 * navegador. Dónde vas en cada tema vive en lib/local-store (y viaja a la cuenta, #70).
 *
 * Esqueleto (#63): los ejercicios están escritos a mano. Cuando llegue la
 * generación (#64) saldrán de la base, y la escalera real de niveles se revisa
 * en #65: los nombres de los niveles 3 a 5 son provisionales.
 */

/** Ejercicio de «elegir la forma correcta»: una frase en español y un hueco en la inglesa. */
export type Ejercicio = {
  /** Solo los generados lo traen: es el de la cuenta, para quitarlos (#72). */
  id?: string;
  es: string;
  /** Lo que va antes y después del hueco. */
  antes: string;
  despues: string;
  correcta: string;
  /** Opciones equivocadas, cada una con por qué lo está. */
  errores: Record<string, string>;
  /** Se muestra al acertar. */
  explicacion: string;
};

/** Cómo se contesta un ejercicio: eligiendo, escribiendo el hueco o traduciendo una frase. */
export type TipoEjercicio = 'elegir' | 'escribir' | 'traducir';

export const TIPOS: { id: TipoEjercicio; nombre: string }[] = [
  { id: 'elegir', nombre: 'Elegir' },
  { id: 'escribir', nombre: 'Escribir' },
  { id: 'traducir', nombre: 'Traducir' },
];

/**
 * Un ejercicio de escribir (#66). En `escribir` hay hueco (`antes` y `despues`) y
 * `aceptadas` son las palabras que lo llenan; en `traducir` no hay hueco y
 * `aceptadas` son frases enteras. Calificar es comparar con `aceptadas` y con las
 * claves de `errores`, sin red.
 */
export type EjercicioEscrito = {
  id?: string;
  es: string;
  antes?: string;
  despues?: string;
  aceptadas: string[];
  /** Respuestas equivocadas conocidas, cada una con por qué lo está. */
  errores: Record<string, string>;
  explicacion: string;
};

/** Lo que guarda la cuenta en `datos`, según el `tipo`. */
export type DatosEjercicio = Ejercicio | EjercicioEscrito;

/** Un ejercicio listo para practicar, de cualquiera de los tres tipos. */
export type Practica =
  | ({ tipo: 'elegir' } & Ejercicio)
  | ({ tipo: 'escribir' } & EjercicioEscrito)
  | ({ tipo: 'traducir' } & EjercicioEscrito)
  /** Dictado (#67): se oye `aceptadas[0]` y se escribe. Es un traducir presentado de otra forma. */
  | ({ tipo: 'escuchar' } & EjercicioEscrito);

export type Nivel = {
  nombre: string;
  ejemplo: string;
  /** Qué practica el nivel, en inglés, para el prompt de generación (#64). */
  foco: string;
  ejercicios: Ejercicio[];
};

export type Tema = {
  id: string;
  nombre: string;
  resumen: string;
  niveles: Nivel[];
};

/** Aciertos seguidos que hacen falta para subir de nivel. */
export const ACIERTOS_PARA_SUBIR = 10;

const WILL: Tema = {
  id: 'will',
  nombre: 'will',
  resumen: 'Futuro, promesas y decisiones al momento.',
  niveles: [
    {
      nombre: 'Afirmativo',
      foco:
        'Affirmative statements with will: will + base verb (no "to"), the same form for every person. Typical mistakes: "will to", "wills", "am will", "will" after the verb.',
      ejemplo: 'I will call you later.',
      ejercicios: [
        {
          es: 'Te llamaré más tarde.',
          antes: 'I',
          despues: 'call you later.',
          correcta: 'will',
          errores: {
            'will to': 'Después de «will» el verbo va sin «to»: «I will call».',
            'am will': '«Will» ya expresa el futuro y no se combina con «am».',
          },
          explicacion: '«Will» + verbo en forma base: «I will call».',
        },
        {
          es: 'Ella nos ayudará.',
          antes: 'She',
          despues: 'help us.',
          correcta: 'will',
          errores: {
            wills: '«Will» nunca cambia, ni con he, she o it.',
            'will to': 'Después de «will» el verbo va sin «to».',
          },
          explicacion: '«Will» es igual para todas las personas.',
        },
        {
          es: 'Mañana hará sol.',
          antes: 'It',
          despues: 'be sunny tomorrow.',
          correcta: 'will',
          errores: {
            is: 'Con «is» quedaría «is be», dos verbos seguidos. Con «will» el verbo va en base: «will be».',
            wills: '«Will» nunca cambia, ni con it.',
          },
          explicacion: '«Will be» es el futuro de «is».',
        },
        {
          es: 'Nosotros llegaremos a las ocho.',
          antes: 'We',
          despues: 'arrive at eight.',
          correcta: 'will',
          errores: {
            'will to': 'Después de «will» el verbo va sin «to».',
            wills: '«Will» nunca cambia, ni con we.',
          },
          explicacion: '«We will arrive»: «will» y el verbo en base.',
        },
        {
          es: 'Te prometo que lo haré.',
          antes: 'I promise I',
          despues: 'do it.',
          correcta: 'will',
          errores: {
            'do will': '«Will» va antes del verbo principal, no después de «do».',
            'will to': 'Después de «will» el verbo va sin «to».',
          },
          explicacion: 'Las promesas se hacen con «will».',
        },
      ],
    },
    {
      nombre: 'Negativo e interrogativo',
      foco:
        'Negatives and questions with will: won\u2019t / will not, and questions with will first (also after a question word). Typical mistakes: "don\u2019t will", "Do will you", "won\u2019t to".',
      ejemplo: 'Will you come? I won’t go.',
      ejercicios: [
        {
          es: 'Mañana no llamaré a mi jefe.',
          antes: 'I',
          despues: 'call my boss tomorrow.',
          correcta: 'won’t',
          errores: {
            'will not to': 'Después de «will not» el verbo va sin «to».',
            'don’t will': 'La negación se pega a «will»: «will not» o «won’t», sin «don’t».',
          },
          explicacion: '«Won’t» es la forma corta de «will not».',
        },
        {
          es: '¿Vendrás a la fiesta?',
          antes: '',
          despues: 'you come to the party?',
          correcta: 'Will',
          errores: {
            'Do will': 'Con «will» no hace falta «do»: «will» pasa al principio de la pregunta.',
            Are: '«Are» no forma el futuro. Para eso va «will».',
          },
          explicacion: 'En preguntas, «will» va primero: «Will you come?».',
        },
        {
          es: 'Ellos no nos esperarán.',
          antes: 'They',
          despues: 'wait for us.',
          correcta: 'won’t',
          errores: {
            'don’t will': 'La negación se pega a «will»: «won’t».',
            'won’t to': 'Después de «won’t» el verbo va sin «to».',
          },
          explicacion: '«Won’t» + verbo en base: «they won’t wait».',
        },
        {
          es: '¿Ella te ayudará?',
          antes: '',
          despues: 'she help you?',
          correcta: 'Will',
          errores: {
            'Does will': 'Con «will» no hace falta «does»: «will» pasa al principio.',
            Wills: '«Will» nunca cambia, ni con she.',
          },
          explicacion: '«Will she help you?»',
        },
        {
          es: 'No lo olvidaré.',
          antes: 'I',
          despues: 'forget it.',
          correcta: 'won’t',
          errores: {
            'will not to': 'Después de «will not» el verbo va sin «to».',
            'don’t': 'Para el futuro la negación es «won’t», no «don’t».',
          },
          explicacion: '«I won’t forget it.»',
        },
        {
          es: '¿Qué harás mañana?',
          antes: 'What',
          despues: 'you do tomorrow?',
          correcta: 'will',
          errores: {
            'do will': 'Con «will» no hace falta «do»: «what will you do».',
            are: '«Are» no forma el futuro. Para eso va «will».',
          },
          explicacion: 'Con palabra de pregunta, «will» va justo después: «What will you do?».',
        },
      ],
    },
    // Sin ejercicios a mano: los de estos niveles los genera la IA (#64).
    {
      nombre: 'Will contra going to',
      ejemplo: 'Decisión al momento o plan',
      foco: 'Will versus going to: will for instant decisions, promises and offers; going to for plans already made and predictions based on evidence.',
      ejercicios: [],
    },
    {
      nombre: 'Primer condicional',
      ejemplo: 'If it rains, I will stay.',
      foco: 'First conditional: if + present simple, will + base verb. Typical mistakes: "if it will rain", "if it rains, I stay" (when a future result is meant).',
      ejercicios: [],
    },
    {
      nombre: 'Contracciones y uso natural',
      ejemplo: 'I’ll, won’t, I’ll be there',
      foco: 'Natural use: I\u2019ll, we\u2019ll, won\u2019t, I\u2019ll probably, I think I\u2019ll, I\u2019ll be there. Typical mistakes: probably in the wrong place, overusing "will not" in speech.',
      ejercicios: [],
    },
  ],
};

export const TEMAS: Tema[] = [WILL];

export const temaPorId = (id: string) => TEMAS.find((t) => t.id === id);

/** Calificar es comparar con lo conocido: sin red y sin gastar nada. */
export function explicar(e: Ejercicio, elegida: string): { acierto: boolean; mensaje: string } {
  if (elegida === e.correcta) return { acierto: true, mensaje: e.explicacion };
  return {
    acierto: false,
    mensaje: e.errores[elegida] ?? `La forma correcta era «${e.correcta}».`,
  };
}

/** Las tres opciones, la correcta mezclada entre las equivocadas. */
export function opcionesDe(e: Ejercicio, azar: () => number = Math.random): string[] {
  const todas = [e.correcta, ...Object.keys(e.errores)];
  for (let i = todas.length - 1; i > 0; i--) {
    const j = Math.floor(azar() * (i + 1));
    [todas[i], todas[j]] = [todas[j], todas[i]];
  }
  return todas;
}

/**
 * El texto como se compara: sin mayúsculas, sin puntuación y con un solo tipo de
 * apóstrofo, para que «won't» y «Won’t.» valgan igual, y con «I'll» e «I will» iguales. Lo demás —palabras de más o de
 * menos, el orden— sí cuenta.
 */
export const normalizar = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[’‘`´]/g, "'")
    .replace(/[.,;:!?¡¿"“”()]/g, '')
    // Las contracciones de will valen como la forma larga: «I'll» es «I will».
    .replace(/\bwon't\b/g, 'will not')
    .replace(/'ll\b/g, ' will')
    .replace(/\s+/g, ' ')
    .trim();

export type Veredicto =
  | { estado: 'acierto'; mensaje: string; alternativa?: string }
  | { estado: 'fallo'; mensaje: string }
  /** No coincide con nada conocido: lo decide quien contesta si se le pregunta a la IA. */
  | { estado: 'duda' };

/** Califica lo escrito comparando con lo que el ejercicio ya sabe. Sin red y sin gastar nada. */
export function calificarEscrito(e: EjercicioEscrito, escrito: string): Veredicto {
  const n = normalizar(escrito);
  if (!n) return { estado: 'duda' };
  const aceptadas = e.aceptadas.map(normalizar);
  if (aceptadas.includes(n)) {
    // Si había otra forma, se muestra la primera por si la tuya no era la más natural.
    const primera = e.aceptadas[0];
    return {
      estado: 'acierto',
      mensaje: e.explicacion,
      ...(aceptadas.length > 1 && aceptadas[0] !== n ? { alternativa: primera } : {}),
    };
  }
  const conocido = Object.entries(e.errores).find(([k]) => normalizar(k) === n);
  if (conocido) return { estado: 'fallo', mensaje: conocido[1] };
  return { estado: 'duda' };
}

/** La frase que suena en un dictado: la primera forma aceptada del ejercicio. */
export const fraseDictado = (e: EjercicioEscrito): string => e.aceptadas[0];

/**
 * Califica un dictado contra lo que sonó, sin red. A diferencia de traducir, aquí
 * no hay dudas: o es la frase o no lo es, así que nunca se le pregunta a la IA.
 */
export function calificarDictado(e: EjercicioEscrito, escrito: string): Veredicto {
  const oida = fraseDictado(e);
  const n = normalizar(escrito);
  if (n === normalizar(oida)) return { estado: 'acierto', mensaje: '' };
  const palabras = (t: string) => normalizar(t).split(' ').filter(Boolean);
  const quedan = palabras(oida);
  const sobran: string[] = [];
  for (const w of palabras(escrito)) {
    const i = quedan.indexOf(w);
    if (i >= 0) quedan.splice(i, 1);
    else sobran.push(w);
  }
  const partes = [
    quedan.length ? `Te faltó: ${quedan.join(', ')}.` : '',
    sobran.length ? `Sobró: ${sobran.join(', ')}.` : '',
  ].filter(Boolean);
  return {
    estado: 'fallo',
    mensaje: partes.length ? partes.join(' ') : 'Las palabras están, pero en otro orden.',
  };
}

/**
 * Una de cada dos traducciones de la tanda se vuelve dictado (#67). Es solo la
 * presentación: el ejercicio es el mismo, así que no se genera ni se guarda nada.
 */
export function conDictados(lista: Practica[]): Practica[] {
  let n = 0;
  return lista.map((e) => (e.tipo === 'traducir' && n++ % 2 === 1 ? { ...e, tipo: 'escuchar' as const } : e));
}

export type Progreso = { nivel: number; racha: number };

export const PROGRESO_INICIAL: Progreso = { nivel: 1, racha: 0 };

/**
 * Un acierto suma a la racha; un fallo la vuelve a cero. Con la racha completa
 * se sube de nivel, siempre que el siguiente tenga ejercicios.
 */
export function registrar(
  p: Progreso,
  acierto: boolean,
  disponibles: number
): { progreso: Progreso; subio: boolean } {
  if (!acierto) return { progreso: { ...p, racha: 0 }, subio: false };
  const racha = Math.min(p.racha + 1, ACIERTOS_PARA_SUBIR);
  if (racha >= ACIERTOS_PARA_SUBIR && p.nivel < disponibles) {
    return { progreso: { nivel: p.nivel + 1, racha: 0 }, subio: true };
  }
  return { progreso: { ...p, racha }, subio: false };
}
