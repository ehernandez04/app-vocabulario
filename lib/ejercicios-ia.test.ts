import { describe, expect, it } from 'vitest';
import { conAceptada, leerEjercicios, sanearEjercicios, sanearEscritos } from './ejercicios-ia';

const bueno = {
  es: 'No lo olvidaré.',
  antes: 'I',
  despues: "forget it.",
  correcta: "won't",
  errores: { 'will not to': 'Después de «will not» el verbo va sin «to».', "don't": 'El futuro se niega con «won’t».' },
  explicacion: '«Won’t» es «will not».',
};

describe('sanearEjercicios', () => {
  it('acepta un ejercicio bien formado y normaliza el apóstrofo', () => {
    const [e] = sanearEjercicios({ ejercicios: [bueno] });
    expect(e.correcta).toBe('won’t');
    expect(Object.keys(e.errores)).toContain('don’t');
  });
  it('descarta lo que no es una lista', () => {
    expect(sanearEjercicios(null)).toEqual([]);
    expect(sanearEjercicios({ ejercicios: 'x' })).toEqual([]);
  });
  it('exige exactamente dos errores', () => {
    const uno = { ...bueno, errores: { 'will not to': 'Sin «to».' } };
    expect(sanearEjercicios({ ejercicios: [uno] })).toEqual([]);
  });
  it('descarta un error que es la propia correcta', () => {
    const raro = { ...bueno, errores: { "won't": 'x'.repeat(12), 'will not to': 'Sin «to» después.' } };
    expect(sanearEjercicios({ ejercicios: [raro] })).toEqual([]);
  });
  it('descarta huecos escritos con guiones bajos y frases sin texto inglés', () => {
    expect(sanearEjercicios({ ejercicios: [{ ...bueno, antes: 'I ___' }] })).toEqual([]);
    expect(sanearEjercicios({ ejercicios: [{ ...bueno, antes: '', despues: '' }] })).toEqual([]);
  });
  it('quita repetidas, también contra las que ya tenía', () => {
    expect(sanearEjercicios({ ejercicios: [bueno, bueno] })).toHaveLength(1);
    expect(sanearEjercicios({ ejercicios: [bueno] }, ['no lo olvidaré.'])).toEqual([]);
  });
});

describe('leerEjercicios', () => {
  const uno = JSON.stringify(bueno);
  it('lee un JSON entero con texto alrededor', () => {
    expect(leerEjercicios(`aquí va {"ejercicios":[${uno}]} listo`).ejercicios).toHaveLength(1);
  });
  it('rescata los buenos cuando uno trae una comilla de más', () => {
    const roto = uno.replace('"explicacion":"', '"explicacion":""');
    const r = leerEjercicios(`{"ejercicios":[${uno},${roto},${uno}]}`);
    expect(r.ejercicios).toHaveLength(2);
  });
  it('sin llaves devuelve una lista vacía', () => {
    expect(leerEjercicios('nada').ejercicios).toEqual([]);
  });
});

describe('sanearEscritos', () => {
  const hueco = {
    es: 'Mañana no llamaré a mi jefe.',
    antes: 'I',
    despues: 'call my boss tomorrow.',
    aceptadas: ["won't", 'will not'],
    errores: { "don't will": 'La negación se pega a «will».' },
    explicacion: '«Won’t» es «will not».',
  };
  const traducir = {
    es: 'Si llueve, me quedaré en casa.',
    aceptadas: ["If it rains, I'll stay home.", 'If it rains, I will stay at home.'],
    errores: { 'If it will rain, I stay home.': 'Después de «if» va presente.' },
    explicacion: 'Primer condicional.',
  };

  it('acepta un hueco bien formado y normaliza el apóstrofo', () => {
    const [e] = sanearEscritos({ ejercicios: [hueco] }, 'escribir');
    // «won’t» y «will not» son la misma respuesta para la app: no se guardan las dos.
    expect(e.aceptadas).toEqual(['won’t']);
    expect(e.antes).toBe('I');
  });
  it('acepta una traducción, que no lleva hueco', () => {
    const [e] = sanearEscritos({ ejercicios: [traducir] }, 'traducir');
    expect(e.antes).toBeUndefined();
    expect(e.aceptadas).toHaveLength(2);
  });
  it('descarta lo que no tiene respuesta aceptada o error con el que comparar', () => {
    expect(sanearEscritos({ ejercicios: [{ ...hueco, aceptadas: [] }] }, 'escribir')).toEqual([]);
    expect(sanearEscritos({ ejercicios: [{ ...hueco, errores: {} }] }, 'escribir')).toEqual([]);
  });
  it('un «error» que también es aceptada se quita, y si no queda ninguno se descarta', () => {
    const raro = { ...hueco, errores: { 'WON’T.': 'x'.repeat(12) } };
    expect(sanearEscritos({ ejercicios: [raro] }, 'escribir')).toEqual([]);
  });
  it('en escribir exige hueco con texto y sin guiones bajos', () => {
    expect(sanearEscritos({ ejercicios: [{ ...hueco, antes: '', despues: '' }] }, 'escribir')).toEqual([]);
    expect(sanearEscritos({ ejercicios: [{ ...hueco, antes: 'I ___' }] }, 'escribir')).toEqual([]);
  });
  it('quita repetidas, también contra las que ya tenía', () => {
    expect(sanearEscritos({ ejercicios: [traducir, traducir] }, 'traducir')).toHaveLength(1);
    expect(sanearEscritos({ ejercicios: [traducir] }, 'traducir', ['si llueve, me quedaré en casa.'])).toEqual([]);
  });
});

describe('conAceptada', () => {
  const datos = { aceptadas: ['cook'], errores: { 'cook the dinner': 'x' } };

  it('suma la respuesta que la IA aceptó y la saca de los errores', () => {
    expect(conAceptada(datos, 'cook the dinner')).toEqual({ aceptadas: ['cook', 'cook the dinner'], errores: {} });
  });

  it('no repite lo que ya vale, aunque cambie la puntuación o las mayúsculas', () => {
    expect(conAceptada(datos, 'Cook.')).toBeNull();
  });

  it('no toca un ejercicio de elegir', () => {
    expect(conAceptada({ errores: {} }, 'will')).toBeNull();
  });
});
