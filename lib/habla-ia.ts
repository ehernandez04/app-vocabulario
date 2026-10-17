/**
 * Práctica en vivo con la IA (#78): el prompt de la conversación y el saneado
 * de lo que devuelve. Es puro, para poder probarlo sin red.
 *
 * Todo en inglés, porque el objetivo es hablar inglés: la IA hace un papel
 * (camarero, compañero de trabajo…) ligado al tema y al nivel donde vas, y
 * mantiene el foco gramatical del nivel sin que se note la lección.
 */

import type { Nivel, Tema } from './temas';

export type Turno = { quien: 'ia' | 'tu'; texto: string };

const limpio = (v: unknown, max: number): string | null => {
  if (typeof v !== 'string') return null;
  const s = v.replace(/\s+/g, ' ').trim();
  return s && s.length <= max ? s : null;
};

export const SISTEMA_HABLA =
  'You are an English conversation partner for a Spanish-speaking learner, inside a language-learning app. ' +
  'You play a short everyday role tied to the given topic, naturally using the grammar point in focus without ' +
  'naming it or explaining it. Keep turns short (1-2 sentences) and natural, like real speech. Match the level: ' +
  'early levels get simple, short sentences; later levels get more natural, idiomatic phrasing. Reply with JSON ' +
  'only, no markdown, using double quotes.';

/** Arranca una conversación nueva: una situación breve y la primera línea de la IA en su papel. */
export function pedidoInicio(tema: Tema, nivel: Nivel): string {
  return (
    `Topic: ${tema.nombre} (${tema.resumen}). Level focus: ${nivel.foco}\n\n` +
    'Invent a short everyday situation (one sentence, second person, e.g. "You are ordering coffee and I\'m the ' +
    'barista.") where the learner will naturally need the level focus above, and write your first line in that role. ' +
    'Reply as JSON: {"situacion": "...", "apertura": "..."}'
  );
}

/** Sigue la conversación con lo último que dijo quien practica. */
export function pedidoSiguiente(tema: Tema, nivel: Nivel, historia: Turno[], dicho: string): string {
  const transcripcion = historia.map((t) => `${t.quien === 'ia' ? 'You' : 'Learner'}: ${t.texto}`).join('\n');
  return (
    `Topic: ${tema.nombre}. Level focus: ${nivel.foco}\n\n` +
    `Conversation so far:\n${transcripcion}\nLearner: ${dicho}\n\n` +
    'Reply in your role, naturally, staying in character. If what the learner said is hard to understand, react ' +
    'the way a patient native speaker would instead of correcting them. Reply as JSON: {"respuesta": "..."}'
  );
}

/** Lee la respuesta del modelo: busca el primer objeto JSON del texto. */
function leerJson(texto: string): Record<string, unknown> | null {
  const ini = texto.indexOf('{');
  const fin = texto.lastIndexOf('}');
  if (ini < 0 || fin < ini) return null;
  try {
    return JSON.parse(texto.slice(ini, fin + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function sanearInicio(texto: string): { situacion: string; apertura: string } | null {
  const o = leerJson(texto);
  if (!o) return null;
  const situacion = limpio(o.situacion, 200);
  const apertura = limpio(o.apertura, 300);
  return situacion && apertura ? { situacion, apertura } : null;
}

export function sanearSiguiente(texto: string): { respuesta: string } | null {
  const o = leerJson(texto);
  if (!o) return null;
  const respuesta = limpio(o.respuesta, 300);
  return respuesta ? { respuesta } : null;
}
