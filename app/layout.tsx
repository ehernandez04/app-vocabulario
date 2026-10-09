import type { Metadata, Viewport } from 'next';
import { Bricolage_Grotesque, Caveat, DM_Sans } from 'next/font/google';
import { RegistrarSW } from '@/components/RegistrarSW';
import { Tabbar } from '@/components/Tabbar';
import { Toast } from '@/components/Toast';
import { ProveedorEstado } from './estado';
import './globals.css';
import './app.css';

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
  description:
    'Repasa vocabulario inglés-español en el camino: tarjetas con audio, modo adivinar y modo manos libres.',
  appleWebApp: { capable: true, title: 'Vocabulario', statusBarStyle: 'default' },
};

export const viewport: Viewport = {
  themeColor: '#F3EFE6',
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // data-skin, no prefers-color-scheme: la app arranca en claro y el botón manda.
    <html
      lang="es"
      data-skin="light"
      className={`${display.variable} ${ui.variable} ${hand.variable}`}
    >
      <body>
        <RegistrarSW />
        <ProveedorEstado>
          <div className="app">
            <Toast />
            <main className="views">{children}</main>
            <Tabbar />
          </div>
        </ProveedorEstado>
      </body>
    </html>
  );
}
