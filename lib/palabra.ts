/**
 * Lo que sabe la app de una palabra más allá de su texto: la etiqueta que
 * distingue sus significados, y si ya la tienes.
 *
 * La clave de una palabra en todo el proyecto es su texto en inglés (progreso,
 * listas, sincronización). Dos significados de «run» necesitan dos claves, así
 * que la distinción va dentro del texto: «run (sustantivo)». Es lo que se
 * decidió (#50, opción A) en vez de cambiar la clave: no toca el modelo ni la
 * sincronización. Quien lo muestra o lo pronuncia usa `textoEn`, que quita la
 * etiqueta.
 */

export const POS = ['verbo', 'sustantivo', 'adjetivo', 'adverbio', 'expresión'] as const;
export type Pos = (typeof POS)[number];

const ETIQUETA = /^(.*?)\s+\(([^()]{1,30})\)$/;

/** «run (sustantivo)» → { texto: 'run', etiqueta: 'sustantivo' }. Sin etiqueta, etiqueta es null. */
export function partirEn(en: string): { texto: string; etiqueta: string | null } {
  const m = ETIQUETA.exec(en.trim());
  return m ? { texto: m[1].trim(), etiqueta: m[2].trim() } : { texto: en.trim(), etiqueta: null };
}

/** Lo que se muestra y se pronuncia: la palabra sin su etiqueta. */
export const textoEn = (en: string): string => partirEn(en).texto;

/** La forma comparable de una palabra: sin etiqueta, sin «to » de verbo, en minúsculas. */
export const base = (en: string): string =>
  textoEn(en).toLowerCase().replace(/^to\s+/, '').replace(/\s+/g, ' ').trim();

/** El tipo de palabra que se deduce de una etiqueta («verbo: dirigir» → verbo), o null. */
export const posDe = (etiqueta: string | null): Pos | null =>
  POS.find((p) => etiqueta === p || etiqueta?.startsWith(`${p}:`) || etiqueta?.startsWith(`${p} `)) ?? null;

export type Sentido = {
  /** El texto como se guardaría: «to run», «run». */
  en: string;
  pos: Pos;
  /** Un matiz corto en español, para distinguir dos significados del mismo tipo. */
  matiz: string;
  es: string;
  ipa: string;
  xe: string;
  xs: string;
  emoji: string;
};

/**
 * La clave de cada sentido propuesto. Con un solo sentido, el texto a secas, como
 * una palabra de siempre; con varios, lleva etiqueta: el tipo, y si dos son del
 * mismo tipo, el tipo y el matiz. Si aun así choca con algo que ya existe, se
 * numera.
 */
export function armarClaves(sentidos: Sentido[], existentes: Iterable<string>): string[] {
  const usadas = new Set([...existentes].map((e) => e.toLowerCase()));
  const porTipo = new Map<string, number>();
  for (const s of sentidos) porTipo.set(`${s.en}|${s.pos}`, (porTipo.get(`${s.en}|${s.pos}`) ?? 0) + 1);

  return sentidos.map((s) => {
    let clave = s.en;
    if (sentidos.length > 1) {
      const repetido = (porTipo.get(`${s.en}|${s.pos}`) ?? 0) > 1;
      const matiz = s.matiz.trim().slice(0, 22);
      clave = `${s.en} (${repetido && matiz ? `${s.pos}: ${matiz}` : s.pos})`;
    }
    let candidata = clave;
    for (let n = 2; usadas.has(candidata.toLowerCase()); n++) {
      candidata = sentidos.length > 1 || n > 2 ? `${clave.replace(/\)$/, '')} ${n})` : `${clave} (${n})`;
    }
    usadas.add(candidata.toLowerCase());
    return candidata;
  });
}

/**
 * ¿Ya tienes este sentido? Se compara la palabra sin «to » ni etiqueta, y el
 * tipo cuando se conoce. Una palabra tuya sin etiqueta y sin «to » (como
 * «outcome») no dice su tipo: cuenta como el mismo sentido, que es lo prudente.
 */
export function yaLaTienes(sentido: Pick<Sentido, 'en' | 'pos'>, mazo: string[]): string | null {
  const b = base(sentido.en);
  for (const en of mazo) {
    if (base(en) !== b) continue;
    const { etiqueta } = partirEn(en);
    const tipo = posDe(etiqueta) ?? (/^to\s/i.test(en) ? 'verbo' : null);
    if (tipo === null || tipo === sentido.pos) return en;
  }
  return null;
}

/** Valida lo que contesta el modelo: lo inválido se descarta, no tumba la respuesta. */
export function sanearSentidos(crudo: unknown, max = 6): Sentido[] {
  const lista = (crudo as { sentidos?: unknown } | null)?.sentidos;
  if (!Array.isArray(lista)) return [];
  const txt = (v: unknown, n: number) => (typeof v === 'string' ? v.trim().slice(0, n) : '');
  const vistos = new Set<string>();
  const out: Sentido[] = [];
  for (const c of lista) {
    if (!c || typeof c !== 'object') continue;
    const o = c as Record<string, unknown>;
    const en = txt(o.en, 80);
    const es = txt(o.es, 120);
    const pos = POS.find((p) => p === o.pos);
    if (!en || !es || !pos || /[()]/.test(en)) continue;
    const llave = `${en.toLowerCase()}|${es.toLowerCase()}`;
    if (vistos.has(llave)) continue;
    vistos.add(llave);
    out.push({
      en,
      pos,
      matiz: txt(o.matiz, 40),
      es,
      ipa: txt(o.ipa, 80),
      xe: txt(o.xe, 300),
      xs: txt(o.xs, 300),
      emoji: txt(o.emoji, 16) || '📝',
    });
    if (out.length >= max) break;
  }
  return out;
}
