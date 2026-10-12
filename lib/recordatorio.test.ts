import { describe, expect, it } from 'vitest';
import { enZona, HORA_RE, textoAviso, tocaAvisar, zonaValida } from './recordatorio';

const s = { hour: '08:30', tz: 'Europe/Madrid', lastSentDay: null as string | null };

describe('recordatorio', () => {
  it('lee el día y la hora en la zona de la persona, no en la del servidor', () => {
    // 06:45 UTC de un día de octubre = 08:45 en Madrid (horario de verano)
    expect(enZona(new Date('2026-10-12T06:45:00Z'), 'Europe/Madrid')).toEqual({ dia: '2026-10-12', minutos: 8 * 60 + 45 });
    // 23:30 UTC ya es el día siguiente en Madrid
    expect(enZona(new Date('2026-10-12T23:30:00Z'), 'Europe/Madrid').dia).toBe('2026-10-13');
  });

  it('sigue siendo a las 8:30 locales tras el cambio de horario', () => {
    const verano = new Date('2026-10-24T06:40:00Z'); // 08:40 CEST
    const invierno = new Date('2026-10-26T07:40:00Z'); // 08:40 CET
    expect(tocaAvisar(s, null, verano)).toBe(true);
    expect(tocaAvisar(s, null, invierno)).toBe(true);
    expect(tocaAvisar(s, null, new Date('2026-10-26T06:40:00Z'))).toBe(false); // 07:40 CET: aún no
  });

  it('no avisa antes de la hora ni cuando ya pasó la ventana', () => {
    expect(tocaAvisar(s, null, new Date('2026-10-12T06:00:00Z'))).toBe(false); // 08:00
    expect(tocaAvisar(s, null, new Date('2026-10-12T10:00:00Z'))).toBe(false); // 12:00
  });

  it('no avisa dos veces el mismo día ni a quien ya repasó', () => {
    const ahora = new Date('2026-10-12T06:45:00Z');
    expect(tocaAvisar({ ...s, lastSentDay: '2026-10-12' }, null, ahora)).toBe(false);
    expect(tocaAvisar({ ...s, lastSentDay: '2026-10-11' }, null, ahora)).toBe(true);
    expect(tocaAvisar(s, '2026-10-12', ahora)).toBe(false);
    expect(tocaAvisar(s, '2026-10-11', ahora)).toBe(true);
  });

  it('valida hora y zona', () => {
    expect(HORA_RE.test('08:30')).toBe(true);
    expect(HORA_RE.test('24:00')).toBe(false);
    expect(HORA_RE.test('8:30')).toBe(false);
    expect(zonaValida('Europe/Madrid')).toBe(true);
    expect(zonaValida('Marte/Olympus')).toBe(false);
    expect(zonaValida(5)).toBe(false);
  });

  it('el texto concuerda en singular y calla la racha de un solo día', () => {
    expect(textoAviso(12, 6).cuerpo).toBe('Te esperan 12 palabras. Tu racha de 6 días sigue viva.');
    expect(textoAviso(1, 1).cuerpo).toBe('Te espera 1 palabra.');
    expect(textoAviso(0, 0).cuerpo).toBe('Hay palabras listas para repasar.');
  });
});
