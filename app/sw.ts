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

// Recordatorio diario (#14). El servidor manda { titulo, cuerpo } y el aviso se
// muestra aunque la app esté cerrada. `tag` hace que un aviso nuevo reemplace al
// anterior en vez de apilarse si el teléfono estuvo sin señal varios días.
self.addEventListener('push', (event) => {
  let datos: { titulo?: string; cuerpo?: string } = {};
  try {
    datos = event.data?.json() ?? {};
  } catch {
    // Un push sin cuerpo legible igual debe mostrar algo: iOS castiga al sitio si no.
  }
  event.waitUntil(
    self.registration.showNotification(datos.titulo ?? 'Vocabulario', {
      body: datos.cuerpo ?? 'Hay palabras listas para repasar.',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: 'recordatorio-diario',
    })
  );
});

// Tocar el aviso lleva a la app: enfoca la ventana abierta o abre una.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    (async () => {
      const ventanas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const abierta = ventanas[0];
      if (abierta) return void (await abierta.focus());
      await self.clients.openWindow('/');
    })()
  );
});
