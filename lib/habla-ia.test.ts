import { describe, expect, it } from 'vitest';
import { pedidoInicio, pedidoSiguiente, sanearInicio, sanearSiguiente, type Turno } from './habla-ia';
import { temaPorId } from './temas';

const tema = temaPorId('will')!;
const nivel = tema.niveles[0];

describe('pedidoInicio', () => {
  it('lleva el tema, el foco del nivel y pide el JSON esperado', () => {
    const p = pedidoInicio(tema, nivel);
    expect(p).toContain(tema.nombre);
    expect(p).toContain(nivel.foco);
    expect(p).toContain('"situacion"');
    expect(p).toContain('"apertura"');
  });
});

describe('pedidoSiguiente', () => {
  it('incluye la transcripción de la charla y lo último que dijo quien practica', () => {
    const historia: Turno[] = [
      { quien: 'ia', texto: "I'll be the barista. What would you like?" },
      { quien: 'tu', texto: 'A coffee, please.' },
    ];
    const p = pedidoSiguiente(tema, nivel, historia, 'With milk, thanks.');
    expect(p).toContain('You: ' + historia[0].texto);
    expect(p).toContain('Learner: ' + historia[1].texto);
    expect(p).toContain('Learner: With milk, thanks.');
    expect(p).toContain('"respuesta"');
  });
});

describe('sanearInicio', () => {
  it('acepta un JSON bien formado', () => {
    const r = sanearInicio('{"situacion":"You are ordering coffee.","apertura":"Hi! What can I get you?"}');
    expect(r).toEqual({ situacion: 'You are ordering coffee.', apertura: 'Hi! What can I get you?' });
  });
  it('lee el JSON aunque venga con texto alrededor', () => {
    const r = sanearInicio('aquí va {"situacion":"A","apertura":"B"} listo');
    expect(r).toEqual({ situacion: 'A', apertura: 'B' });
  });
  it('rechaza un JSON roto', () => {
    expect(sanearInicio('no es JSON')).toBeNull();
    expect(sanearInicio('{"situacion":"A"')).toBeNull();
  });
  it('exige las dos claves, no solo una', () => {
    expect(sanearInicio('{"situacion":"A"}')).toBeNull();
    expect(sanearInicio('{"apertura":"B"}')).toBeNull();
  });
  it('rechaza un texto demasiado largo', () => {
    const larga = 'a'.repeat(301);
    expect(sanearInicio(`{"situacion":"A","apertura":"${larga}"}`)).toBeNull();
  });
});

describe('sanearSiguiente', () => {
  it('acepta y recorta espacios de más', () => {
    expect(sanearSiguiente('{"respuesta":"  One  cappuccino,   coming up.  "}')).toEqual({
      respuesta: 'One cappuccino, coming up.',
    });
  });
  it('rechaza sin la clave "respuesta" o con un tipo que no es texto', () => {
    expect(sanearSiguiente('{"otra":"x"}')).toBeNull();
    expect(sanearSiguiente('{"respuesta":5}')).toBeNull();
  });
  it('rechaza un JSON roto', () => {
    expect(sanearSiguiente('nada')).toBeNull();
  });
});
