'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { IconHablar, IconInicio, IconTarjetas, IconTemas } from './icons';

/** `rutas` son las pantallas que cuentan como esa pestaña: los tres modos de repaso viven bajo «Palabras». */
const PESTANAS = [
  { href: '/', label: 'Inicio', Icono: IconInicio, rutas: ['/'] },
  { href: '/temas', label: 'Temas', Icono: IconTemas, rutas: ['/temas'] },
  { href: '/hablar', label: 'Hablar', Icono: IconHablar, rutas: ['/hablar'] },
  { href: '/palabras', label: 'Palabras', Icono: IconTarjetas, rutas: ['/palabras', '/tarjetas', '/adivinar', '/camino'] },
];

export function Tabbar() {
  const ruta = usePathname();
  // Dentro de un tema (vista, práctica y conversación) se sale con «← Inicio» o «✕»; las listas sí llevan barra.
  if (ruta.startsWith('/temas/')) return null;
  return (
    <nav className="tabbar" aria-label="Secciones">
      {PESTANAS.map(({ href, label, Icono, rutas }) => (
        <Link
          key={href}
          href={href}
          className="tab"
          aria-current={rutas.includes(ruta) ? 'page' : undefined}
        >
          <Icono />
          {label}
        </Link>
      ))}
    </nav>
  );
}
