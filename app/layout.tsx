import type { Metadata, Viewport } from 'next';
import { JetBrains_Mono, Manrope } from 'next/font/google';
import { RegistrarSW } from '@/components/RegistrarSW';
import './globals.css';
import './app.css';

// Display: la palabra en inglés, compacta y con letter-spacing negativo.
const display = Manrope({
  subsets: ['latin'],
  weight: ['800'],
  variable: '--fuente-display',
});

// Cuerpo: toda la interfaz, y el español en negrita.
const ui = Manrope({
  subsets: ['latin'],
  weight: ['400', '500', '700', '800'],
  variable: '--fuente-ui',
});

// Monoespaciada: la fonética.
const mono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['500'],
  variable: '--fuente-mono',
});

export const metadata: Metadata = {
  title: 'Paso a Paso',
  description:
    'Repasa vocabulario inglés-español en el camino: tarjetas con audio, modo adivinar y modo manos libres.',
  appleWebApp: { capable: true, title: 'Paso a Paso', statusBarStyle: 'default' },
};

export const viewport: Viewport = {
  themeColor: '#0E0B1F',
  viewportFit: 'cover',
};

/**
 * Solo el armazón mínimo: tipografías, tema y service worker.
 *
 * Las pestañas y el estado viven en (app)/layout, que exige sesión. Entrar y
 * sin-acceso cuelgan de acá y se ven sin ella: si no, la pantalla de entrada
 * mostraría la barra de navegación de una app en la que todavía no entraste.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // data-skin, no prefers-color-scheme: la app arranca en oscuro (Aurora) y el botón manda.
    <html
      lang="es"
      data-skin="dark"
      className={`${display.variable} ${ui.variable} ${mono.variable}`}
    >
      <body>
        <RegistrarSW />
        <div className="app">{children}</div>
      </body>
    </html>
  );
}
