import type { Metadata, Viewport } from 'next';
import { Bricolage_Grotesque, Caveat, DM_Sans } from 'next/font/google';
import './globals.css';

// Display: la palabra en inglés, con letter-spacing negativo.
const display = Bricolage_Grotesque({
  subsets: ['latin'],
  weight: ['800'],
  variable: '--fuente-display',
});

// Cuerpo: toda la interfaz.
const ui = DM_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--fuente-ui',
});

// Manuscrita: solo para el español.
const hand = Caveat({
  subsets: ['latin'],
  weight: ['700'],
  variable: '--fuente-hand',
});

export const metadata: Metadata = {
  title: 'Vocabulario en Ruta',
  description: 'Repasar vocabulario inglés-español en el camino, con audio y repetición espaciada',
};

export const viewport: Viewport = {
  themeColor: '#F3EFE6',
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // data-skin, no prefers-color-scheme: la app arranca en claro y el botón manda.
    <html lang="es" data-skin="light" className={`${display.variable} ${ui.variable} ${hand.variable}`}>
      <body>{children}</body>
    </html>
  );
}
