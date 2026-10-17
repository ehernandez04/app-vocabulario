import type { MetadataRoute } from 'next';

/**
 * El manifiesto que hace instalable la app. Next lo sirve en /manifest.webmanifest.
 *
 * `display: standalone` es lo que quita la barra del navegador: sin eso, en el
 * iPhone la app abre como una pestaña más y no se siente instalada.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Paso a Paso',
    short_name: 'Paso a Paso',
    description:
      'Repasa vocabulario inglés-español en el camino: tarjetas con audio, modo adivinar y modo manos libres.',
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait',
    lang: 'es',
    // El violeta noche de Aurora, que es el punto de partida de la app.
    background_color: '#0E0B1F',
    theme_color: '#0E0B1F',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      {
        src: '/icons/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
