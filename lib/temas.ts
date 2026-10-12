/**
 * Aprender por tema (#39). Todo lo de acá es puro, salvo las dos funciones que
 * tocan localStorage: así se puede probar sin navegador.
 *
 * Esqueleto (#63): los ejercicios están escritos a mano. Cuando llegue la
 * generación (#64) saldrán de la base, y la escalera real de niveles se revisa
 * en #65: los nombres de los niveles 3 a 5 son provisionales.
 */

/** Ejercicio de «elegir la forma correcta»: una frase en español y un hueco en la inglesa. */
export type Ejercicio = {
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

export type Nivel = {
  nombre: string;
  ejemplo: string;
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
    // Provisionales: la escalera real se revisa en #65 y los ejercicios llegan con #64.
    { nombre: 'Will contra going to', ejemplo: 'Decisión al momento o plan', ejercicios: [] },
    { nombre: 'Primer condicional', ejemplo: 'If it rains, I will stay.', ejercicios: [] },
    { nombre: 'Contracciones y uso natural', ejemplo: 'I’ll, won’t, I’ll be there', ejercicios: [] },
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

/** Cuántos niveles tienen ejercicios, es decir, hasta dónde se puede llegar hoy. */
export const nivelesDisponibles = (t: Tema) => t.niveles.filter((n) => n.ejercicios.length).length;

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

/**
 * De momento el nivel de cada tema vive solo en el teléfono. Si viaja a la
 * cuenta o no se decide en #64, junto con el modelo de datos.
 */
const clave = (id: string) => `tema:${id}`;

export function cargarProgreso(id: string): Progreso {
  try {
    const p = JSON.parse(localStorage.getItem(clave(id)) ?? 'null');
    if (p && Number.isInteger(p.nivel) && Number.isInteger(p.racha) && p.nivel >= 1 && p.racha >= 0) {
      return { nivel: p.nivel, racha: p.racha };
    }
  } catch {
    // sin almacenamiento o dato roto: se empieza de cero
  }
  return PROGRESO_INICIAL;
}

export function guardarProgreso(id: string, p: Progreso) {
  try {
    localStorage.setItem(clave(id), JSON.stringify(p));
  } catch {
    // modo privado o lleno: el avance de esta sesión se pierde, nada más
  }
}
