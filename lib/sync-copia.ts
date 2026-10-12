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

import { fusionarRacha, igualProgreso, type Racha } from './fusion';
import type { Progress, Word } from './srs';

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
};

export type Peticion = {
  desde: string | null;
  words: ({ en: string; es: string; ipa?: string; emoji?: string; xe?: string; xs?: string } & {
    borrada?: true;
  })[];
  progress: (Progress & { en: string; base: string | null })[];
  streak: number;
  lastDay: string | null;
};

/** Qué se mandó exactamente, para saber después qué cambió mientras viajaba. */
export type Enviado = {
  progress: Record<string, Progress>;
  pendientes: Record<string, Pendiente['tipo']>;
};

export type Respuesta = {
  cursor: string;
  words: (Pick<Word, 'en' | 'es' | 'ipa' | 'emoji' | 'xe' | 'xs'> & {
    borrada: boolean;
    createdAt?: string;
  })[];
  progress: (Progress & { en: string; version: string })[];
  streak: number;
  lastDay: string | null;
};

/** Qué tocó la respuesta, para persistir solo eso. */
export type Tocado = { progress: string[]; words: string[] };

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
    ...(tipo === 'baja' ? { borrada: true as const } : {}),
  }));

  return {
    cuerpo: { desde: c.cursor, words, progress, streak: c.racha.streak, lastDay: c.racha.lastDay },
    enviado: {
      progress: Object.fromEntries(
        Object.keys(c.sucios)
          .filter((en) => c.progress[en])
          .map((en) => [en, { ...c.progress[en] }])
      ),
      pendientes: Object.fromEntries(Object.entries(c.pendientes).map(([en, p]) => [en, p.tipo])),
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
  const tocado: Tocado = { progress: [], words: [] };

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

  for (const [en, tipo] of Object.entries(enviado.pendientes)) {
    if (c.pendientes[en]?.tipo === tipo) delete c.pendientes[en];
  }

  c.racha = fusionarRacha(c.racha, { streak: r.streak, lastDay: r.lastDay });
  c.cursor = r.cursor;
  return tocado;
}
