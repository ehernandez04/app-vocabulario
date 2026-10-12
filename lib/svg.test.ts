import { describe, expect, it } from 'vitest';
import { sanearSvg, svgAImagen } from './svg';

/** Salidas reales de los modelos (ver #53), sin retocar. */
const REALES: [string, string][] = [
  [
    "reloj haiku",
    "<svg viewBox=\"0 0 64 64\" xmlns=\"http://www.w3.org/2000/svg\">\n<circle cx=\"32\" cy=\"34\" r=\"22\" fill=\"#F3EFE6\" stroke=\"#1C1B19\" stroke-width=\"2.5\"/>\n<circle cx=\"32\" cy=\"34\" r=\"16\" fill=\"#B8E1FF\" stroke=\"#1C1B19\" stroke-width=\"2.5\"/>\n<path d=\"M32 34 V23\" stroke=\"#1C1B19\" stroke-width=\"2.5\" stroke-linecap=\"round\"/>\n<path d=\"M32 34 L40 39\" stroke=\"#1C1B19\" stroke-width=\"2.5\" stroke-linecap=\"round\"/>\n<path d=\"M26 6 H38\" stroke=\"#1C1B19\" stroke-width=\"2.5\" stroke-linecap=\"round\"/>\n<path d=\"M32 6 V12\" stroke=\"#1C1B19\" stroke-width=\"2.5\" stroke-linecap=\"round\"/>\n<circle cx=\"32\" cy=\"34\" r=\"2\" fill=\"#FFE066\" stroke=\"#1C1B19\" stroke-width=\"2.5\"/>\n<path d=\"M50 14 L56 8\" stroke=\"#FFB4A2\" stroke-width=\"2.5\" stroke-linecap=\"round\"/>\n</svg>"
  ],
  [
    "remind opus",
    "<svg viewBox=\"0 0 64 64\" xmlns=\"http://www.w3.org/2000/svg\"><circle cx=\"32\" cy=\"32\" r=\"28\" fill=\"#B8E1FF\"/><rect x=\"23\" y=\"10\" width=\"18\" height=\"50\" rx=\"9\" fill=\"#FFB4A2\" stroke=\"#1C1B19\" stroke-width=\"2.5\" stroke-linecap=\"round\"/><path d=\"M27 16q5-3 10 0v5q-5 2-10 0z\" fill=\"#F3EFE6\" stroke=\"#1C1B19\" stroke-width=\"2.5\" stroke-linejoin=\"round\"/><rect x=\"21.5\" y=\"32\" width=\"21\" height=\"6\" rx=\"2\" fill=\"#FFE066\" stroke=\"#1C1B19\" stroke-width=\"2.5\"/><path d=\"M42 35q8-9 13-3q-2 7-13 3z\" fill=\"#FFE066\" stroke=\"#1C1B19\" stroke-width=\"2.5\" stroke-linejoin=\"round\"/><path d=\"M42 35q9 3 10 10q-7 2-10-10z\" fill=\"#FFE066\" stroke=\"#1C1B19\" stroke-width=\"2.5\" stroke-linejoin=\"round\"/><path d=\"M12 14l4 4M10 24h5M18 8l2 5\" stroke=\"#1C1B19\" stroke-width=\"2.5\" stroke-linecap=\"round\"/></svg>"
  ],
  [
    "overwhelming opus",
    "<svg viewBox=\"0 0 64 64\" xmlns=\"http://www.w3.org/2000/svg\" fill=\"none\" stroke=\"#1C1B19\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 58 C4 30 16 8 38 8 C52 8 60 18 56 28 C53 34 44 34 44 26 C44 21 50 20 51 25 C46 22 40 28 36 40 C33 48 32 54 32 58 Z\" fill=\"#B8E1FF\"/><path d=\"M14 40 C18 30 24 22 32 18\" /><circle cx=\"49\" cy=\"42\" r=\"4\" fill=\"#FFB4A2\"/><path d=\"M49 46 L49 53 M44 44 L49 49 L54 44 M49 53 L46 58 M49 53 L52 58\"/><path d=\"M4 58 L60 58\"/><circle cx=\"56\" cy=\"34\" r=\"1.5\" fill=\"#F3EFE6\"/><circle cx=\"41\" cy=\"36\" r=\"1.5\" fill=\"#F3EFE6\"/></svg>"
  ],
  [
    "shortcut sonnet",
    "<svg viewBox=\"0 0 64 64\" xmlns=\"http://www.w3.org/2000/svg\" stroke=\"#1C1B19\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><rect x=\"4\" y=\"4\" width=\"56\" height=\"56\" rx=\"8\" fill=\"#F3EFE6\"/><path d=\"M12 50 V28 Q12 18 22 18 H34 Q42 18 42 26 V32 Q42 40 50 40\" fill=\"none\" stroke=\"#B8E1FF\" stroke-width=\"7\"/><path d=\"M12 50 L50 14\" fill=\"none\" stroke=\"#FFE066\" stroke-width=\"7\"/><path d=\"M12 50 L50 14\" fill=\"none\"/><circle cx=\"12\" cy=\"50\" r=\"5\" fill=\"#C8F0A8\"/><path d=\"M42 12 H52 V22 Z\" fill=\"#FFB4A2\"/></svg>"
  ]
];

const NUEVOS: [string, string][] = [
  [
    'hurdle opus (líneas con x1, y1…)',
    '<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><rect x="4" y="52" width="56" height="6" rx="2" fill="#C8F0A8" stroke="#1C1B19" stroke-width="2.5"/><line x1="16" y1="32" x2="16" y2="52" stroke="#1C1B19" stroke-width="2.5" stroke-linecap="round"/><polyline points="10,52 16,52 22,52" fill="none" stroke="#1C1B19" stroke-width="2.5" stroke-linecap="round"/><path d="M6 20 Q32 2 58 18" fill="none" stroke="#1C1B19" stroke-width="2.5" stroke-linecap="round" stroke-dasharray="4 4"/></svg>',
  ],
  [
    'hurdle sonnet (pintura en la raíz)',
    '<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" stroke="#1C1B19" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="50" width="56" height="6" rx="3" fill="#C8F0A8"/><line x1="16" y1="50" x2="14" y2="28"/><circle cx="32" cy="8" r="4" fill="#B8E1FF"/></svg>',
  ],
];

it.each(NUEVOS)('acepta %s', (_n, svg) => {
  expect(sanearSvg(svg)).not.toBeNull();
});

const ENVOLTURA = (dentro: string) => `<svg viewBox="0 0 64 64">${dentro}</svg>`;

describe('sanearSvg', () => {
  it.each(REALES)('acepta lo que dibujó el modelo: %s', (_n, svg) => {
    const limpio = sanearSvg(svg);
    expect(limpio).not.toBeNull();
    expect(limpio).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 64 64"[^>]*>/);
    expect(limpio).not.toMatch(/script|onload|href|style=/i);
  });

  it('reconstruye la raíz: el ancho, el alto y el espacio de nombres no pasan', () => {
    const out = sanearSvg('<svg width="9999" height="9999" viewBox="0 0 64 64"><circle cx="1" cy="2" r="3"/></svg>');
    expect(out).toBe('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="1" cy="2" r="3"/></svg>');
  });

  it('rechaza un evento en la raíz', () => {
    expect(sanearSvg('<svg viewBox="0 0 64 64" onload="x()"><g/></svg>')).toBeNull();
  });

  it('conserva la pintura de la raíz, que los modelos usan para heredar el trazo', () => {
    const out = sanearSvg('<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" stroke="#1C1B19" stroke-width="2.5"><line x1="1" y1="2" x2="3" y2="4"/></svg>');
    expect(out).toContain('stroke="#1C1B19" stroke-width="2.5"');
    expect(out).toContain('<line x1="1" y1="2" x2="3" y2="4"/>');
  });

  it('tolera texto del modelo alrededor del <svg>', () => {
    expect(sanearSvg('Aquí va:\n```svg\n' + ENVOLTURA('<rect x="1" y="1" width="5" height="5"/>') + '\n```')).not.toBeNull();
  });

  it.each([
    ['un script', ENVOLTURA('<script>alert(1)</script>')],
    ['un evento', ENVOLTURA('<circle cx="1" cy="1" r="1" onclick="x()"/>')],
    ['un enlace', ENVOLTURA('<a href="https://x.com"><circle cx="1" cy="1" r="1"/></a>')],
    ['foreignObject', ENVOLTURA('<foreignObject><div>hola</div></foreignObject>')],
    ['una imagen', ENVOLTURA('<image href="https://x.com/a.png"/>')],
    ['style', ENVOLTURA('<style>*{}</style>')],
    ['un atributo style', ENVOLTURA('<rect x="1" y="1" width="1" height="1" style="fill:red"/>')],
    ['url() en un relleno', ENVOLTURA('<rect x="1" y="1" width="1" height="1" fill="url(#a)"/>')],
    ['texto', ENVOLTURA('<g>hola</g>')],
    ['una entidad', ENVOLTURA('<g>&lt;</g>')],
    ['un comentario', ENVOLTURA('<!-- hola --><g/>')],
    ['etiquetas sin cerrar', ENVOLTURA('<g><circle cx="1" cy="1" r="1"/>')],
    ['un número que no lo es', ENVOLTURA('<circle cx="1);alert(1" cy="1" r="1"/>')],
    ['un trazo con letras raras', ENVOLTURA('<path d="M0 0 L9 9 <script>"/>')],
    ['un color con comillas', ENVOLTURA('<rect x="1" y="1" width="1" height="1" fill="red;x"/>')],
    ['un svg anidado', ENVOLTURA('<svg><g/></svg>')],
  ])('rechaza %s', (_n, svg) => {
    expect(sanearSvg(svg)).toBeNull();
  });

  it('rechaza lo vacío, lo enorme y lo que no es texto', () => {
    expect(sanearSvg('')).toBeNull();
    expect(sanearSvg(null)).toBeNull();
    expect(sanearSvg(ENVOLTURA('<g/>'.repeat(50)))).toBeNull(); // demasiados elementos
    expect(sanearSvg('x'.repeat(7000))).toBeNull();
  });
});

describe('svgAImagen', () => {
  it('lo convierte en una imagen de datos', () => {
    expect(svgAImagen('<svg a="b"/>')).toBe('data:image/svg+xml;utf8,%3Csvg%20a%3D%22b%22%2F%3E');
  });
});
