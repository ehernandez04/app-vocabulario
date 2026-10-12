import { describe, expect, it } from 'vitest';
import { aplicarRespuesta, construirPeticion, type Copia, type Respuesta } from './sync-copia';
import type { Lista } from './listas';
import type { Progress } from './srs';

const p = (box: number, due = '2026-10-12', seen = 0, miss = 0): Progress => ({ box, due, seen, miss });

const copia = (c: Partial<Copia> = {}): Copia => ({
  words: {},
  progress: {},
  racha: { streak: 0, lastDay: null },
  versiones: {},
  sucios: {},
  pendientes: {},
  cursor: '2026-10-12T10:00:00.000Z', // ya sincronizada, salvo que el caso diga otra cosa
  listas: {},
  listasVersiones: {},
  listasSucias: {},
  listasBorradas: {},
  ...c,
});

const resp = (r: Partial<Respuesta> = {}): Respuesta => ({
  cursor: '2026-10-12T11:00:00.000Z',
  words: [],
  progress: [],
  lists: [],
  streak: 0,
  lastDay: null,
  ...r,
});

describe('construirPeticion', () => {
  it('manda solo lo sucio, con la versión base que el teléfono vio', () => {
    const c = copia({
      progress: { 'the way': p(1, '2026-10-13', 5, 1), 'to achieve': p(2) },
      sucios: { 'the way': true },
      versiones: { 'the way': 'V1', 'to achieve': 'V9' },
    });
    const { cuerpo } = construirPeticion(c);
    expect(cuerpo.progress).toEqual([{ en: 'the way', ...p(1, '2026-10-13', 5, 1), base: 'V1' }]);
    expect(cuerpo.desde).toBe('2026-10-12T10:00:00.000Z');
  });

  it('una palabra que el servidor nunca vio sube con base null', () => {
    const c = copia({ progress: { nueva: p(1) }, sucios: { nueva: true } });
    expect(construirPeticion(c).cuerpo.progress[0].base).toBeNull();
  });

  it('las altas y las bajas viajan; la baja lleva borrada', () => {
    const c = copia({
      pendientes: {
        a: { tipo: 'alta', word: { en: 'a', es: 'la a', emoji: '🅰️' } },
        b: { tipo: 'baja', word: { en: 'b', es: 'la b' } },
      },
    });
    const { cuerpo } = construirPeticion(c);
    expect(cuerpo.words.find((w) => w.en === 'a')?.borrada).toBeUndefined();
    expect(cuerpo.words.find((w) => w.en === 'b')?.borrada).toBe(true);
  });

  it('la primera sincronización marca como pendiente lo que ya había, sin versión', () => {
    const c = copia({
      cursor: null,
      progress: { 'the way': p(3, '2026-10-20', 4, 1), intacta: p(1) },
      words: { mia: { en: 'mia', es: 'mía', mine: true } },
    });
    const { cuerpo } = construirPeticion(c);
    expect(cuerpo.progress.map((x) => x.en)).toEqual(['the way']); // la intacta no se sube
    expect(cuerpo.progress[0].base).toBeNull();
    expect(cuerpo.words.map((w) => w.en)).toEqual(['mia']);
  });

  it('no vuelve a marcar lo previo si ya hubo una sincronización', () => {
    const c = copia({ progress: { 'the way': p(3, '2026-10-20', 4, 1) } });
    expect(construirPeticion(c).cuerpo.progress).toEqual([]);
  });
});

describe('aplicarRespuesta', () => {
  it('lo confirmado deja de estar sucio y guarda su versión', () => {
    const c = copia({ progress: { x: p(2, '2026-10-14', 1) }, sucios: { x: true } });
    const { enviado } = construirPeticion(c);
    aplicarRespuesta(c, enviado, resp({ progress: [{ en: 'x', ...p(2, '2026-10-14', 1), version: 'V2' }] }));
    expect(c.sucios).toEqual({});
    expect(c.versiones.x).toBe('V2');
    expect(c.cursor).toBe('2026-10-12T11:00:00.000Z');
  });

  it('un repaso hecho mientras viajaba la petición NO se pisa', () => {
    const c = copia({ progress: { x: p(2, '2026-10-14', 1) }, sucios: { x: true } });
    const { enviado } = construirPeticion(c);
    c.progress.x = p(3, '2026-10-16', 2); // el usuario acierta otra vez, en vuelo
    aplicarRespuesta(c, enviado, resp({ progress: [{ en: 'x', ...p(2, '2026-10-14', 1), version: 'V2' }] }));
    expect(c.progress.x.box).toBe(3); // lo nuevo se conserva
    expect(c.sucios.x).toBe(true); // y sigue pendiente de subir
    expect(c.versiones.x).toBe('V2'); // sobre la versión nueva, para que el servidor no vea choque
  });

  it('una palabra calificada por primera vez en vuelo también se conserva', () => {
    const c = copia({ progress: { x: p(1) } });
    const { enviado } = construirPeticion(c); // x no estaba sucia: no se mandó
    c.progress.x = p(2, '2026-10-14', 1);
    c.sucios.x = true;
    aplicarRespuesta(c, enviado, resp({ progress: [{ en: 'x', ...p(1), version: 'V3' }] }));
    expect(c.progress.x.box).toBe(2);
    expect(c.sucios.x).toBe(true);
  });

  it('lo que cambió en otro dispositivo se aplica a lo que no está sucio', () => {
    const c = copia({ progress: { x: p(1) } });
    const { enviado } = construirPeticion(c);
    aplicarRespuesta(c, enviado, resp({ progress: [{ en: 'x', ...p(4, '2026-10-28', 8, 1), version: 'V5' }] }));
    expect(c.progress.x).toEqual(p(4, '2026-10-28', 8, 1));
    expect(c.versiones.x).toBe('V5');
  });

  it('el resultado de un choque (la caja más alta del servidor) reemplaza lo mandado', () => {
    const c = copia({ progress: { x: p(1, '2026-10-13', 3) }, sucios: { x: true } });
    const { enviado } = construirPeticion(c);
    aplicarRespuesta(c, enviado, resp({ progress: [{ en: 'x', ...p(4, '2026-10-28', 6), version: 'V6' }] }));
    expect(c.progress.x.box).toBe(4);
    expect(c.sucios.x).toBeUndefined();
  });

  it('un avance que el servidor no devolvió deja de reenviarse', () => {
    const c = copia({ progress: { huerfana: p(2, '2026-10-14', 1) }, sucios: { huerfana: true } });
    const { enviado } = construirPeticion(c);
    aplicarRespuesta(c, enviado, resp());
    expect(c.sucios).toEqual({});
  });

  it('una palabra propia llegada de otro dispositivo entra al mazo', () => {
    const c = copia();
    aplicarRespuesta(
      c,
      construirPeticion(c).enviado,
      resp({ words: [{ en: 'commute', es: 'desplazarse', ipa: '', emoji: '🚇', xe: '', xs: '', borrada: false, createdAt: '2026-10-11T00:00:00.000Z' }] })
    );
    expect(c.words.commute).toMatchObject({ es: 'desplazarse', mine: true, addedAt: '2026-10-11T00:00:00.000Z' });
  });

  it('una baja que llega de otro dispositivo quita la palabra y su avance', () => {
    const c = copia({
      words: { vieja: { en: 'vieja', es: 'vieja', mine: true } },
      progress: { vieja: p(3) },
      versiones: { vieja: 'V1' },
    });
    aplicarRespuesta(c, construirPeticion(c).enviado, resp({ words: [{ en: 'vieja', es: 'vieja', ipa: '', emoji: '', xe: '', xs: '', borrada: true }] }));
    expect(c.words.vieja).toBeUndefined();
    expect(c.progress.vieja).toBeUndefined();
    expect(c.versiones.vieja).toBeUndefined();
  });

  it('si la volviste a agregar mientras tanto, la baja remota no la borra', () => {
    const c = copia({ words: { x: { en: 'x', es: 'x', mine: true } } });
    const { enviado } = construirPeticion(c); // en ese momento no había alta pendiente
    c.pendientes.x = { tipo: 'alta', word: c.words.x };
    aplicarRespuesta(c, enviado, resp({ words: [{ en: 'x', es: 'x', ipa: '', emoji: '', xe: '', xs: '', borrada: true }] }));
    expect(c.words.x).toBeDefined();
  });

  it('las altas y bajas confirmadas dejan de estar pendientes; las nuevas no', () => {
    const c = copia({
      pendientes: { a: { tipo: 'alta', word: { en: 'a', es: 'a' } }, b: { tipo: 'baja', word: { en: 'b', es: 'b' } } },
    });
    const { enviado } = construirPeticion(c);
    c.pendientes.c = { tipo: 'alta', word: { en: 'c', es: 'c' } }; // llegó en vuelo
    aplicarRespuesta(c, enviado, resp());
    expect(Object.keys(c.pendientes)).toEqual(['c']);
  });

  it('el avance de una palabra recién quitada no la hace revivir', () => {
    const c = copia({ pendientes: { x: { tipo: 'baja', word: { en: 'x', es: 'x' } } } });
    aplicarRespuesta(c, construirPeticion(c).enviado, resp({ progress: [{ en: 'x', ...p(2), version: 'V1' }] }));
    expect(c.progress.x).toBeUndefined();
  });

  it('la racha más reciente gana', () => {
    const c = copia({ racha: { streak: 2, lastDay: '2026-10-10' } });
    aplicarRespuesta(c, construirPeticion(c).enviado, resp({ streak: 6, lastDay: '2026-10-12' }));
    expect(c.racha).toEqual({ streak: 6, lastDay: '2026-10-12' });
  });
});

describe('listas', () => {
  const L = (id: string, name: string, words: string[]): Lista => ({ id, name, words, createdAt: '2026-10-12T09:00:00.000Z' });
  const rl = (id: string, name: string, words: string[], version: string, borrada = false) => ({
    id, name, words, createdAt: '2026-10-12T09:00:00.000Z', version, borrada,
  });

  it('manda las sucias con su base y las borradas con borrada', () => {
    const c = copia({
      listas: { a: L('a', 'Trabajo', ['x']), b: L('b', 'Viajes', ['y']) },
      listasSucias: { a: true },
      listasVersiones: { a: 'V1', b: 'V2' },
      listasBorradas: { z: true },
    });
    const { cuerpo } = construirPeticion(c);
    expect(cuerpo.lists).toEqual([
      { id: 'a', name: 'Trabajo', words: ['x'], base: 'V1' },
      { id: 'z', name: '', words: [], base: null, borrada: true },
    ]);
  });

  it('la primera sincronización marca todas las listas locales, sin versión', () => {
    const c = copia({ cursor: null, listas: { a: L('a', 'Trabajo', []) } });
    expect(construirPeticion(c).cuerpo.lists).toEqual([{ id: 'a', name: 'Trabajo', words: [], base: null }]);
  });

  it('una lista que nunca llegó al servidor se sube aunque el teléfono ya se haya sincronizado', () => {
    const c = copia({ listas: { a: L('a', 'Trabajo', ['x']) } }); // cursor presente, sin versión
    expect(construirPeticion(c).cuerpo.lists.map((l) => l.id)).toEqual(['a']);
  });

  it('lo confirmado deja de estar sucio y guarda su versión', () => {
    const c = copia({ listas: { a: L('a', 'Trabajo', ['x']) }, listasSucias: { a: true } });
    const { enviado } = construirPeticion(c);
    aplicarRespuesta(c, enviado, resp({ lists: [rl('a', 'Trabajo', ['x'], 'V3')] }));
    expect(c.listasSucias).toEqual({});
    expect(c.listasVersiones.a).toBe('V3');
  });

  it('una edición hecha mientras viajaba la petición NO se pisa', () => {
    const c = copia({ listas: { a: L('a', 'Trabajo', ['x']) }, listasSucias: { a: true } });
    const { enviado } = construirPeticion(c);
    c.listas.a = L('a', 'Trabajo', ['x', 'y']); // el usuario agrega otra en vuelo
    aplicarRespuesta(c, enviado, resp({ lists: [rl('a', 'Trabajo', ['x'], 'V3')] }));
    expect(c.listas.a.words).toEqual(['x', 'y']);
    expect(c.listasSucias.a).toBe(true);
    expect(c.listasVersiones.a).toBe('V3');
  });

  it('una lista creada en otro dispositivo entra, y una borrada allí se quita', () => {
    const c = copia({ listas: { v: L('v', 'Vieja', ['x']) }, listasVersiones: { v: 'V1' } });
    aplicarRespuesta(c, construirPeticion(c).enviado, resp({ lists: [rl('n', 'Nueva', ['y'], 'V2'), rl('v', 'Vieja', [], 'V2', true)] }));
    expect(c.listas.n.words).toEqual(['y']);
    expect(c.listas.v).toBeUndefined();
  });

  it('una lista que acabas de borrar no revive con lo que baja', () => {
    const c = copia({ listasBorradas: { a: true } });
    aplicarRespuesta(c, construirPeticion(c).enviado, resp({ lists: [rl('a', 'Trabajo', ['x'], 'V2')] }));
    expect(c.listas.a).toBeUndefined();
  });

  it('una baja confirmada deja de estar pendiente', () => {
    const c = copia({ listasBorradas: { a: true }, listasVersiones: { a: 'V1' } });
    const { enviado } = construirPeticion(c);
    aplicarRespuesta(c, enviado, resp({ lists: [rl('a', 'Trabajo', [], 'V2', true)] }));
    expect(c.listasBorradas).toEqual({});
    expect(c.listasVersiones).toEqual({});
  });

  it('el servidor funde una lista nueva con otra del mismo nombre y la local adopta su id', () => {
    const c = copia({ listas: { local: L('local', 'Básicas', ['x']) }, listasSucias: { local: true } });
    const { enviado } = construirPeticion(c);
    aplicarRespuesta(
      c,
      enviado,
      resp({ lists: [rl('remota', 'Básicas', ['x', 'y'], 'V5')], reasignadas: { local: 'remota' } })
    );
    expect(c.listas.local).toBeUndefined();
    expect(c.listas.remota.words).toEqual(['x', 'y']);
    expect(c.listasSucias).toEqual({});
  });
});
