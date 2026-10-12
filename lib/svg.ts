/**
 * Saneado del SVG que dibuja el modelo.
 *
 * Es contenido que viene de fuera de la confianza y acaba mostrado a quien abre
 * la app, así que no se sanea «quitando lo malo»: se reconstruye desde cero con
 * una lista corta de etiquetas y atributos conocidos, cada valor con su forma.
 * Lo que no encaja devuelve null y el dibujo se descarta. Además se muestra
 * siempre como imagen (`<img src="data:…">`), donde un SVG no puede ejecutar nada.
 */

const ETIQUETAS = new Set(['svg', 'g', 'path', 'circle', 'ellipse', 'rect', 'line', 'polyline', 'polygon']);

const NUMERO = /^-?\d*\.?\d+$/;
const COLOR = /^(none|#[0-9a-fA-F]{3,8}|[a-zA-Z]{3,20})$/;
const SOLO_NUMEROS = /^[\d\s.,eE+-]+$/;
const TRAZO_D = /^[MmLlHhVvCcSsQqTtAaZz\d\s.,eE+-]+$/;
const TRANSFORM = /^([a-z]+\([\d\s.,eE+-]+\)\s*)+$/;

const VALIDOS: Record<string, (v: string) => boolean> = {
  d: (v) => v.length <= 2000 && TRAZO_D.test(v),
  points: (v) => v.length <= 800 && SOLO_NUMEROS.test(v),
  fill: (v) => COLOR.test(v),
  stroke: (v) => COLOR.test(v),
  'stroke-linecap': (v) => ['round', 'butt', 'square'].includes(v),
  'stroke-linejoin': (v) => ['round', 'miter', 'bevel'].includes(v),
  'fill-rule': (v) => ['nonzero', 'evenodd'].includes(v),
  'stroke-dasharray': (v) => v.length <= 60 && SOLO_NUMEROS.test(v),
  transform: (v) => v.length <= 120 && TRANSFORM.test(v),
};
for (const n of ['cx', 'cy', 'r', 'rx', 'ry', 'x', 'y', 'x1', 'y1', 'x2', 'y2', 'width', 'height', 'stroke-width', 'opacity', 'fill-opacity', 'stroke-opacity']) {
  VALIDOS[n] = (v) => NUMERO.test(v);
}

const MAX_ELEMENTOS = 40;
const MAX_LARGO = 6000;
const RAIZ = 'xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"';
/** Lo único que se conserva de la raíz: la pintura que heredan sus hijos (los modelos la ponen ahí). */
const EN_RAIZ = new Set(['fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'fill-rule', 'opacity']);

/** Un SVG reconstruido y seguro, o null si algo no encaja. */
export function sanearSvg(crudo: unknown): string | null {
  if (typeof crudo !== 'string' || crudo.length > MAX_LARGO) return null;
  const m = /<svg[\s\S]*<\/svg>/i.exec(crudo);
  if (!m) return null;
  const src = m[0];
  // Comentarios, instrucciones, entidades y url(): fuera, ni se miran.
  if (/<!|<\?|&|url\s*\(|javascript:/i.test(src)) return null;

  const etiqueta = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)((?:\s+[a-zA-Z][a-zA-Z0-9-]*\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>/g;
  const atributo = /([a-zA-Z][a-zA-Z0-9-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;

  let pos = 0;
  let salida = '';
  let elementos = 0;
  let raiz = false;
  let cerrada = false;
  const pila: string[] = [];

  for (let t = etiqueta.exec(src); t; t = etiqueta.exec(src)) {
    if (src.slice(pos, t.index).trim()) return null; // texto suelto
    pos = etiqueta.lastIndex;
    const [, cierre, nombreCrudo, atributos, autocierre] = t;
    const nombre = nombreCrudo.toLowerCase();
    if (!ETIQUETAS.has(nombre) || cerrada) return null;

    if (cierre) {
      if (pila.pop() !== nombre || autocierre) return null;
      salida += `</${nombre}>`;
      if (nombre === 'svg') cerrada = true;
      continue;
    }

    if (++elementos > MAX_ELEMENTOS) return null;
    if (nombre === 'svg') {
      if (raiz || autocierre) return null; // un solo <svg>, y el de fuera
      raiz = true;
    } else if (!raiz) {
      return null;
    }
    let attrs = '';
    for (let a = atributo.exec(atributos); a; a = atributo.exec(atributos)) {
      const nom = a[1].toLowerCase();
      const val = (a[2] ?? a[3] ?? '').trim();
      if (nombre === 'svg') {
        // Ancho, alto, espacio de nombres y evento onload los pone o los quita la app;
        // de la raíz solo pasa la pintura que heredan los hijos.
        if (EN_RAIZ.has(nom) && VALIDOS[nom](val)) attrs += ` ${nom}="${val}"`;
        else if (!['viewbox', 'xmlns', 'width', 'height', 'version', 'xmlns:xlink'].includes(nom)) return null;
        continue;
      }
      const valida = VALIDOS[nom];
      if (!valida || !valida(val)) return null;
      attrs += ` ${nom}="${val}"`;
    }
    salida += nombre === 'svg' ? `<svg ${RAIZ}${attrs}>` : `<${nombre}${attrs}${autocierre ? '/>' : '>'}`;
    if (!autocierre) pila.push(nombre);
    else if (nombre === 'svg') return null;
  }
  if (src.slice(pos).trim() || pila.length || !cerrada) return null;
  return salida;
}

/** Para mostrarlo con `<img src>`: un SVG así no ejecuta scripts ni carga nada. */
export const svgAImagen = (svg: string): string => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
