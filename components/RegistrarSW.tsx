'use client';

import { useEffect } from 'react';

/**
 * Registra el service worker.
 *
 * En el modo normal de `@serwist/next` esto lo inyectaba el bundler, pero ese
 * modo no convive con Turbopack, así que el registro va a mano.
 *
 * Solo en producción: en desarrollo el service worker sirve la versión
 * anterior desde caché y uno pasa media hora viendo cambios fantasma antes de
 * entender qué está pasando. Además `sw.js` solo existe tras `pnpm build`.
 */
export function RegistrarSW() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Sin service worker la app funciona igual, solo que sin modo avión.
    });
  }, []);

  return null;
}
