/**
 * El service worker. Es lo que hace que la app abra sin señal, que es el caso
 * de uso principal: repasar en el metro.
 *
 * El build inyecta en `__SW_MANIFEST` la lista de archivos con sus hashes, que
 * es justo la parte que no se puede escribir a mano.
 */

import { defaultCache } from '@serwist/next/worker';
import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist';
import { Serwist } from 'serwist';

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  // La versión nueva toma el control enseguida en vez de esperar a que se
  // cierren todas las pestañas. Sin esto, al desplegar un arreglo seguís
  // viendo la versión vieja hasta vaya a saber cuándo.
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
});

serwist.addEventListeners();
