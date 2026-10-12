/**
 * Sincroniza la copia local con la cuenta.
 *
 * La lógica que decide qué se manda y cómo se aplica la respuesta vive en
 * lib/sync-copia.ts, pura y probada. Esto solo la une con el almacén y la red.
 *
 * Nunca lanza ni bloquea: sin señal, o con el servidor caído, devuelve `ok:
 * false` y todo queda marcado como pendiente para la próxima. El repaso no
 * espera a esto jamás.
 */

import * as store from './local-store';
import { aplicarRespuesta, construirPeticion, type Respuesta } from './sync-copia';

export type Resultado = { ok: boolean; cambios: boolean };

/** Si algo cambia mientras viaja una petición, se encadena otra; con tope. */
const MAX_VUELTAS = 3;

let enVuelo: Promise<Resultado> | null = null;
let otra = false;

export function sincronizar(): Promise<Resultado> {
  // Una sola a la vez. Quien llega mientras otra viaja no abre una paralela
  // (dos peticiones con la misma base se pisarían): pide que se repita.
  if (enVuelo) {
    otra = true;
    return enVuelo;
  }
  enVuelo = ejecutar().finally(() => {
    enVuelo = null;
  });
  return enVuelo;
}

async function ejecutar(): Promise<Resultado> {
  let cambios = false;
  try {
    for (let vuelta = 0; vuelta < MAX_VUELTAS; vuelta++) {
      otra = false;
      const copia = store.copiaSync();
      const { cuerpo, enviado } = construirPeticion(copia);

      const r = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(cuerpo),
      });
      if (!r.ok) return { ok: false, cambios };

      const tocado = aplicarRespuesta(copia, enviado, (await r.json()) as Respuesta);
      store.guardarSync(copia, tocado);
      if (tocado.progress.length || tocado.words.length) cambios = true;
      if (!otra) break;
    }
    return { ok: true, cambios };
  } catch {
    return { ok: false, cambios };
  }
}
