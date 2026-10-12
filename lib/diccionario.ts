/**
 * Pronunciación de un diccionario real (dictionaryapi.dev, gratuito y sin clave).
 *
 * El modelo traduce muy bien pero se equivoca más en la fonética de palabras
 * raras; el diccionario no inventa. Si falla o no conoce la palabra, no pasa
 * nada: se queda la que propuso el modelo.
 */

const PLAZO_MS = 3000;

export async function pronunciacion(palabra: string): Promise<string | null> {
  const q = palabra.trim().toLowerCase().replace(/^to\s+/, '');
  if (!q || q.length > 60) return null;
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), PLAZO_MS);
  try {
    const r = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(q)}`, {
      signal: ctl.signal,
      cache: 'no-store',
    });
    if (!r.ok) return null;
    const entradas = (await r.json()) as {
      phonetic?: string;
      phonetics?: { text?: string }[];
    }[];
    for (const e of Array.isArray(entradas) ? entradas : []) {
      const texto = e.phonetics?.find((p) => p.text)?.text ?? e.phonetic;
      if (typeof texto === 'string' && texto.trim()) return texto.trim().slice(0, 80);
    }
    return null;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}
