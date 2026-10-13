/**
 * Ejercicios de «aprender por tema» generados por el modelo (#64): el prompt y
 * el saneado de lo que devuelve. Es puro, para poder probarlo sin red.
 *
 * El modelo nunca se usa tal cual: cada ejercicio pasa por `sanearEjercicios`,
 * que descarta lo que no encaja. Un ejercicio mal formado enseña mal, y como se
 * califica comparando con lo que trae, un error aquí se repetiría en cada intento.
 */

import type { Ejercicio, Nivel, Tema } from './temas';

/** Cuántos ejercicios se piden por tanda. */
export const POR_TANDA = 40;

const comillas = (s: string) => s.replace(/'/g, '’').replace(/\s+/g, ' ').trim();

/** Una frase sin hueco ni espacios sobrantes, y con el apóstrofo tipográfico de la app. */
const limpio = (v: unknown, max: number): string | null => {
  if (typeof v !== 'string') return null;
  const s = comillas(v);
  return s.length <= max ? s : null;
};

/**
 * Lee la respuesta del modelo. Si el JSON entero está bien, se usa tal cual; si
 * una comilla de más lo rompe (pasa), se rescata cada ejercicio por separado en
 * vez de perder la tanda completa: pagamos una llamada por 40, no por uno.
 */
export function leerEjercicios(texto: string): { ejercicios: unknown[] } {
  const ini = texto.indexOf('{');
  const fin = texto.lastIndexOf('}');
  if (ini < 0 || fin < ini) return { ejercicios: [] };
  const json = texto.slice(ini, fin + 1);
  try {
    return JSON.parse(json) as { ejercicios: unknown[] };
  } catch {
    // seguimos abajo
  }
  // Una comilla suelta desfasa cualquier lectura por llaves, así que se corta donde
  // empieza cada ejercicio (todos arrancan con {"es":) y se lee cada trozo aparte.
  const sueltos: unknown[] = [];
  const inicios = [...json.matchAll(/\{\s*"es"\s*:/g)].map((m) => m.index ?? 0);
  inicios.forEach((desde, i) => {
    const trozo = json.slice(desde, inicios[i + 1] ?? json.length);
    // El último trozo trae pegado el cierre de la lista y del objeto: se prueba
    // cortar en cada «}» desde el final hasta que el JSON quede bien.
    for (let cierre = trozo.lastIndexOf('}'); cierre > 0; cierre = trozo.lastIndexOf('}', cierre - 1)) {
      try {
        sueltos.push(JSON.parse(trozo.slice(0, cierre + 1)));
        break;
      } catch {
        // seguimos con el «}» anterior; si ninguno sirve, se pierde solo este ejercicio
      }
    }
  });
  return { ejercicios: sueltos };
}

export function sanearEjercicios(bruto: unknown, yaTengo: Iterable<string> = []): Ejercicio[] {
  const lista = (bruto as { ejercicios?: unknown })?.ejercicios;
  if (!Array.isArray(lista)) return [];
  const vistas = new Set([...yaTengo].map((e) => comillas(e).toLowerCase()));
  const salida: Ejercicio[] = [];

  for (const x of lista) {
    if (!x || typeof x !== 'object') continue;
    const o = x as Record<string, unknown>;
    const es = limpio(o.es, 140);
    const correcta = limpio(o.correcta, 40);
    const explicacion = limpio(o.explicacion, 200);
    const antes = typeof o.antes === 'string' ? comillas(o.antes) : null;
    const despues = typeof o.despues === 'string' ? comillas(o.despues) : null;
    if (!es || !correcta || !explicacion || antes === null || despues === null) continue;
    if (antes.length > 80 || despues.length > 80 || !(antes + despues)) continue;
    if (/_{2,}/.test(antes + despues)) continue; // el hueco lo pone la app

    const errores: Record<string, string> = {};
    if (o.errores && typeof o.errores === 'object' && !Array.isArray(o.errores)) {
      for (const [opcion, porque] of Object.entries(o.errores as Record<string, unknown>)) {
        const k = limpio(opcion, 40);
        const v = limpio(porque, 200);
        if (k && v && k.toLowerCase() !== correcta.toLowerCase()) errores[k] = v;
      }
    }
    // Dos opciones equivocadas, ni más ni menos: tres botones caben en el teléfono.
    if (Object.keys(errores).length !== 2) continue;

    const clave = es.toLowerCase();
    if (vistas.has(clave)) continue;
    vistas.add(clave);
    salida.push({ es, antes, despues, correcta, errores, explicacion });
  }
  return salida;
}

export const SISTEMA = `You write grammar exercises for a Spanish speaker learning English. Reply with ONLY a JSON object, no prose, no code fences.

Each exercise is "choose the right form": a Spanish sentence to translate, and the English sentence with ONE gap. The learner picks among three options.

Format:
{"ejercicios":[{"es":"...","antes":"...","despues":"...","correcta":"...","errores":{"wrong1":"why","wrong2":"why"},"explicacion":"..."}]}

Rules:
- "es": a natural Spanish sentence (neutral Spanish, everyday situations: work, travel, home, friends).
- "antes" and "despues": the English text before and after the gap. Never write underscores. At least one of them is not empty.
- "correcta": the words that fill the gap (1-3 words). Putting it in the gap must give a correct sentence that translates "es".
- "errores": EXACTLY two wrong options, each a plausible mistake a Spanish speaker really makes, as keys. Each value is a short explanation IN SPANISH of why that option is wrong, naming the rule (e.g. "Después de «will» el verbo va sin «to».").
- "explicacion": one short Spanish sentence stating the rule that makes the correct option right.
- Use the typographic apostrophe in contractions (won’t, I’ll).
- EXACTLY ONE option must be correct. Each wrong option must be clearly wrong or clearly out of place in THAT sentence, never merely "less natural" or "also possible". If two forms could both be said, add a context cue to the sentence (and to its Spanish translation) that rules one out, or pick a different sentence. Test every exercise by reading each option into the gap.
- Test only the level's focus. Do not make the answer depend on other grammar (present continuous, present simple for schedules, modal verbs other than will) unless the level is about it.
- Keep the gap short: 1-2 words, never a whole clause. The correct answer must keep the sentence's meaning identical to "es".
- Wrong options must be forms a Spanish speaker would really produce (interference from Spanish, or mixing up the forms of this topic), never nonsense like "go to to".
- Vary subjects, verbs, vocabulary and sentence shapes. Do not repeat a sentence. Stay strictly at the requested level: do not use grammar from later levels.`;

/** El mensaje del usuario: qué tema y nivel, y qué frases evitar. */
export function pedido(tema: Tema, nivel: Nivel, cantidad: number, evitar: string[]): string {
  const partes = [
    `Topic: ${tema.nombre}`,
    `Level: ${nivel.nombre}`,
    `Focus: ${nivel.foco}`,
    `Write ${cantidad} exercises.`,
  ];
  if (evitar.length) partes.push(`Do not reuse these Spanish sentences:\n${evitar.map((e) => `- ${e}`).join('\n')}`);
  return partes.join('\n');
}
