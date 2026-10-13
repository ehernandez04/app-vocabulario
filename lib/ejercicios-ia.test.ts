import { describe, expect, it } from 'vitest';
import { leerEjercicios, sanearEjercicios } from './ejercicios-ia';

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
