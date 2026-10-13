/**
 * La copia local y su relación con el servidor, sin red ni IndexedDB.
 *
 * Está separada de lib/sync.ts a propósito: construir la petición y aplicar la
 * respuesta es donde se pierde el avance de alguien si algo está mal, y puro se
 * puede probar con casos concretos. Todo lo que muta, muta `Copia` en el sitio;
 * quien la llama decide cómo persistirlo.
 *
 * El modelo, en corto:
 *  - Cada avance cambiado queda «sucio» (`sucios`) hasta que el servidor lo
 *    confirma. Se sube el estado actual, no una cola de operaciones: es
 *    idempotente y no puede duplicar un repaso.
 *  - `versiones` guarda, por palabra, el `updatedAt` del servidor que el teléfono
 *    vio por última vez. Es la `base` con la que el servidor decide si hubo
 *    choque (ver lib/fusion.resolverProgreso).
 *  - Las palabras propias altas y bajas esperan en `pendientes`.
 */

import { fusionarRacha, igualLista, igualProgreso, igualTema, type AvanceTema, type Racha } from './fusion';
import type { Lista } from './listas';
import type { Progress, Word } from './srs';
import { svgAImagen } from './svg';

export type Pendiente = { tipo: 'alta' | 'baja'; word: Word };

export type Copia = {
  words: Record<string, Word>;
  progress: Record<string, Progress>;
  racha: Racha;
  /** Versión del servidor vista por última vez, por palabra. */
  versiones: Record<string, string>;
  /** Palabras cuyo avance cambió y el servidor aún no lo confirmó. */
  sucios: Record<string, true>;
  pendientes: Record<string, Pendiente>;
  /** null = nunca se sincronizó. */
  cursor: string | null;
  /** Las listas, por id. */
  listas: Record<string, Lista>;
  /** Versión del servidor vista por última vez, por lista. */
  listasVersiones: Record<string, string>;
  /** Listas creadas o editadas que el servidor aún no confirmó. */
  listasSucias: Record<string, true>;
  /** Listas borradas que el servidor aún no confirmó. */
  listasBorradas: Record<string, true>;
  /** Nivel y racha de cada tema (#70), por id de tema. */
  temas: Record<string, AvanceTema>;
  /** Versión del servidor vista por última vez, por tema. */
  temasVersiones: Record<string, string>;
  /** Temas cuyo avance cambió y el servidor aún no lo confirmó. */
  temasSucios: Record<string, true>;
};

export type Peticion = {
  desde: string | null;
  words: ({ en: string; es: string; ipa?: string; emoji?: string; xe?: string; xs?: string; svg?: string } & {
    borrada?: true;
  })[];
  progress: (Progress & { en: string; base: string | null })[];
  lists: { id: string; name: string; words: string[]; base: string | null; borrada?: true }[];
  temas: (AvanceTema & { tema: string; base: string | null })[];
  streak: number;
  lastDay: string | null;
};

/** Qué se mandó exactamente, para saber después qué cambió mientras viajaba. */
export type Enviado = {
  progress: Record<string, Progress>;
  pendientes: Record<string, Pendiente['tipo']>;
  listas: Record<string, Lista>;
  listasBorradas: Record<string, true>;
  temas: Record<string, AvanceTema>;
};

export type Respuesta = {
  cursor: string;
  words: (Pick<Word, 'en' | 'es' | 'ipa' | 'emoji' | 'xe' | 'xs'> & {
    svg?: string | null;
    borrada: boolean;
    createdAt?: string;
  })[];
  progress: (Progress & { en: string; version: string })[];
  lists?: { id: string; name: string; words: string[]; createdAt: string; version: string; borrada: boolean }[];
  /** Listas nuevas que el servidor fundió con otra del mismo nombre: id del teléfono → id definitivo. */
  reasignadas?: Record<string, string>;
  temas?: (AvanceTema & { tema: string; version: string })[];
  streak: number;
  lastDay: string | null;
};

/** Qué tocó la respuesta, para persistir solo eso. */
export type Tocado = { progress: string[]; words: string[]; listas: string[]; temas: string[] };

const intacto = (p: Progress) => p.seen > 0 || p.box > 1;

/**
 * La primera sincronización de un teléfono que ya traía datos: lo que había
 * antes de que existiera la marca de «sucio» no está marcado, y bajar el
 * servidor encima perdería los repasos hechos desde la primera subida. Se marca
 * todo como pendiente, sin versión: el servidor lo trata como choque y gana la
 * caja más alta, que es la salida segura (nunca se pierde lo aprendido).
 */
function marcarLoPrevio(c: Copia) {
  for (const [en, p] of Object.entries(c.progress)) {
    if (intacto(p) && !c.versiones[en]) c.sucios[en] = true;
  }
  for (const w of Object.values(c.words)) {
    if (w.mine && !c.pendientes[w.en]) c.pendientes[w.en] = { tipo: 'alta', word: w };
  }
}

export function construirPeticion(c: Copia): { cuerpo: Peticion; enviado: Enviado } {
  if (c.cursor === null) marcarLoPrevio(c);
  // Una lista sin versión nunca llegó al servidor, aunque el teléfono ya se haya
  // sincronizado antes (las listas se estrenaron después que el resto).
  for (const id of Object.keys(c.listas)) {
    if (!c.listasVersiones[id] && !c.listasBorradas[id]) c.listasSucias[id] = true;
  }

  const progress = Object.keys(c.sucios)
    .filter((en) => c.progress[en])
    .map((en) => ({ en, ...c.progress[en], base: c.versiones[en] ?? null }));

  const words = Object.values(c.pendientes).map(({ tipo, word }) => ({
    en: word.en,
    es: word.es || word.en, // el servidor exige texto en las dos; una baja solo necesita `en`
    ipa: word.ipa,
    emoji: word.emoji,
    xe: word.xe,
    xs: word.xs,
    svg: word.svg,
    ...(tipo === 'baja' ? { borrada: true as const } : {}),
  }));

  const lists: Peticion['lists'] = [
    ...Object.keys(c.listasSucias)
      .filter((id) => c.listas[id] && !c.listasBorradas[id])
      .map((id) => ({
        id,
        name: c.listas[id].name,
        words: c.listas[id].words,
        base: c.listasVersiones[id] ?? null,
      })),
    ...Object.keys(c.listasBorradas).map((id) => ({
      id,
      name: c.listas[id]?.name ?? '',
      words: [],
      base: c.listasVersiones[id] ?? null,
      borrada: true as const,
    })),
  ];

  const temas = Object.keys(c.temasSucios)
    .filter((id) => c.temas[id])
    .map((tema) => ({ tema, ...c.temas[tema], base: c.temasVersiones[tema] ?? null }));

  return {
    cuerpo: { desde: c.cursor, words, progress, lists, temas, streak: c.racha.streak, lastDay: c.racha.lastDay },
    enviado: {
      progress: Object.fromEntries(
        Object.keys(c.sucios)
          .filter((en) => c.progress[en])
          .map((en) => [en, { ...c.progress[en] }])
      ),
      pendientes: Object.fromEntries(Object.entries(c.pendientes).map(([en, p]) => [en, p.tipo])),
      listas: Object.fromEntries(
        Object.keys(c.listasSucias)
          .filter((id) => c.listas[id])
          .map((id) => [id, { ...c.listas[id], words: [...c.listas[id].words] }])
      ),
      listasBorradas: { ...c.listasBorradas },
      temas: Object.fromEntries(
        Object.keys(c.temasSucios)
          .filter((id) => c.temas[id])
          .map((id) => [id, { ...c.temas[id] }])
      ),
    },
  };
}

/**
 * Aplica lo que contestó el servidor.
 *
 * Lo delicado es el repaso que ocurre MIENTRAS la petición viaja: si el usuario
 * califica otra palabra (o la misma) en ese rato, el servidor contesta con el
 * estado de antes, y aplicarlo tal cual pisaría el repaso nuevo. Por eso, un
 * avance que ya no es el que se mandó se queda como está, sigue sucio, y solo se
 * actualiza su versión base.
 */
export function aplicarRespuesta(c: Copia, enviado: Enviado, r: Respuesta): Tocado {
  const tocado: Tocado = { progress: [], words: [], listas: [], temas: [] };

  // Palabras primero: un avance puede referirse a una palabra recién llegada.
  for (const w of r.words) {
    const pendiente = c.pendientes[w.en];
    if (w.borrada) {
      // Si el usuario la volvió a agregar mientras tanto, manda lo suyo.
      if (pendiente?.tipo === 'alta' && enviado.pendientes[w.en] !== 'alta') continue;
      delete c.words[w.en];
      delete c.progress[w.en];
      delete c.versiones[w.en];
      delete c.sucios[w.en];
      tocado.words.push(w.en);
      tocado.progress.push(w.en);
      continue;
    }
    if (c.words[w.en] || pendiente?.tipo === 'baja') continue;
    c.words[w.en] = {
      en: w.en,
      es: w.es,
      ipa: w.ipa,
      emoji: w.emoji,
      xe: w.xe,
      xs: w.xs,
      // El dibujo viaja como SVG limpio y aquí se vuelve imagen, que es lo que pinta la pegatina.
      ...(w.svg ? { svg: w.svg, img: svgAImagen(w.svg) } : {}),
      mine: true,
      addedAt: w.createdAt ?? new Date().toISOString(),
    };
    tocado.words.push(w.en);
  }

  const vistos = new Set<string>();
  for (const s of r.progress) {
    vistos.add(s.en);
    const mandado = enviado.progress[s.en];
    const local = c.progress[s.en];
    // Una palabra que el usuario acaba de quitar no debe revivir por su avance.
    if (c.pendientes[s.en]?.tipo === 'baja') continue;

    const cambioEnVuelo =
      c.sucios[s.en] && (!mandado || !local || !igualProgreso(local, mandado));
    c.versiones[s.en] = s.version;
    tocado.progress.push(s.en);
    if (cambioEnVuelo) continue; // lo del teléfono es más nuevo: se queda y se vuelve a subir

    c.progress[s.en] = { box: s.box, due: s.due, seen: s.seen, miss: s.miss };
    delete c.sucios[s.en];
  }

  // Lo que se mandó y el servidor no devolvió (palabra desconocida o borrada):
  // seguir marcándolo solo lo reenviaría para siempre.
  for (const en of Object.keys(enviado.progress)) {
    if (vistos.has(en) || !c.sucios[en]) continue;
    if (c.progress[en] && igualProgreso(c.progress[en], enviado.progress[en])) {
      delete c.sucios[en];
      tocado.progress.push(en);
    }
  }

  // Listas. Primero los id reasignados: el servidor fundió una lista nueva con otra
  // del mismo nombre, y la local pasa a llamarse como la definitiva.
  for (const [viejo, nuevo] of Object.entries(r.reasignadas ?? {})) {
    const local = c.listas[viejo];
    if (!local || viejo === nuevo) continue;
    if (!c.listas[nuevo]) c.listas[nuevo] = { ...local, id: nuevo };
    else c.listas[nuevo] = { ...c.listas[nuevo], words: [...new Set([...c.listas[nuevo].words, ...local.words])] };
    delete c.listas[viejo];
    delete c.listasSucias[viejo];
    delete c.listasVersiones[viejo];
    tocado.listas.push(viejo, nuevo);
  }
  for (const l of r.lists ?? []) {
    const local = c.listas[l.id];
    const mandada = enviado.listas[l.id];
    if (l.borrada) {
      if (!local) continue;
      // Si la editaste mientras tanto, manda lo tuyo (y se vuelve a subir).
      if (c.listasSucias[l.id] && (!mandada || !igualLista(local, mandada))) {
        c.listasVersiones[l.id] = l.version;
        continue;
      }
      delete c.listas[l.id];
      delete c.listasSucias[l.id];
      delete c.listasVersiones[l.id];
      tocado.listas.push(l.id);
      continue;
    }
    if (c.listasBorradas[l.id]) continue; // la acabas de borrar: no revive por esto
    const cambioEnVuelo = c.listasSucias[l.id] && local && (!mandada || !igualLista(local, mandada));
    c.listasVersiones[l.id] = l.version;
    tocado.listas.push(l.id);
    if (cambioEnVuelo) continue; // lo del teléfono es más nuevo: se queda y se vuelve a subir
    c.listas[l.id] = { id: l.id, name: l.name, words: l.words, createdAt: l.createdAt };
    delete c.listasSucias[l.id];
  }
  for (const id of Object.keys(enviado.listasBorradas)) {
    // Confirmadas: la baja ya está en el servidor.
    delete c.listasBorradas[id];
    delete c.listasVersiones[id];
  }
  // Lo que se mandó y el servidor no devolvió (id ajeno o descartado): seguir
  // marcándolo solo lo reenviaría para siempre.
  for (const id of Object.keys(enviado.listas)) {
    if (!c.listasSucias[id] || (r.lists ?? []).some((l) => l.id === id)) continue;
    if (c.listas[id] && igualLista(c.listas[id], enviado.listas[id])) delete c.listasSucias[id];
  }

  // Temas, con el mismo cuidado que el avance: lo practicado mientras viajaba la
  // petición no se pisa con la respuesta.
  const temasVistos = new Set<string>();
  for (const t of r.temas ?? []) {
    temasVistos.add(t.tema);
    const mandado = enviado.temas[t.tema];
    const local = c.temas[t.tema];
    const cambioEnVuelo =
      c.temasSucios[t.tema] && local && (!mandado || !igualTema(local, mandado));
    c.temasVersiones[t.tema] = t.version;
    tocado.temas.push(t.tema);
    if (cambioEnVuelo) continue;
    c.temas[t.tema] = { nivel: t.nivel, racha: t.racha };
    delete c.temasSucios[t.tema];
  }
  // Lo que se mandó y el servidor no devolvió (tema desconocido): seguir
  // marcándolo solo lo reenviaría para siempre.
  for (const id of Object.keys(enviado.temas)) {
    if (temasVistos.has(id) || !c.temasSucios[id]) continue;
    if (c.temas[id] && igualTema(c.temas[id], enviado.temas[id])) {
      delete c.temasSucios[id];
      tocado.temas.push(id);
    }
  }

  for (const [en, tipo] of Object.entries(enviado.pendientes)) {
    if (c.pendientes[en]?.tipo === tipo) delete c.pendientes[en];
  }

  c.racha = fusionarRacha(c.racha, { streak: r.streak, lastDay: r.lastDay });
  c.cursor = r.cursor;
  return tocado;
}
