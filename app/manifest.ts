import type { MetadataRoute } from 'next';

/**
 * El manifiesto que hace instalable la app. Next lo sirve en /manifest.webmanifest.
 *
 * `display: standalone` es lo que quita la barra del navegador: sin eso, en el
 * iPhone la app abre como una pestaña más y no se siente instalada.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Vocabulario en Ruta',
    short_name: 'Vocabulario',
    description:
      'Repasa vocabulario inglés-español en el camino: tarjetas con audio, modo adivinar y modo manos libres.',
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait',
    lang: 'es',
    // El papel claro, que es la identidad de la app. El tema oscuro es una
    // elección dentro de la app, no el punto de partida.
    background_color: '#F3EFE6',
    theme_color: '#F3EFE6',
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
