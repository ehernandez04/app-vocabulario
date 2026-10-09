import { serwist } from '@serwist/next/config';

/**
 * Configuración del service worker.
 *
 * Va aparte del build de Next a propósito: `@serwist/next` en su modo normal
 * se engancha al bundler y **no funciona con Turbopack**, que es el build por
 * defecto de Next 16. Este modo lo construye el CLI después de `next build`,
 * leyendo lo que Next ya dejó en disco, y por eso sí convive con Turbopack.
 */
export default serwist({
  swSrc: 'app/sw.ts',
  swDest: 'public/sw.js',
  globDirectory: '.next',
});
