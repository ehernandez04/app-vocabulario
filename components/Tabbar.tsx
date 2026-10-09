'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { IconAdivinar, IconAuriculares, IconInicio, IconTarjetas } from './icons';

const PESTANAS = [
  { href: '/', label: 'Inicio', Icono: IconInicio },
  { href: '/tarjetas', label: 'Tarjetas', Icono: IconTarjetas },
  { href: '/adivinar', label: 'Adivinar', Icono: IconAdivinar },
  { href: '/camino', label: 'Camino', Icono: IconAuriculares },
];

export function Tabbar() {
  const ruta = usePathname();
  return (
    <nav className="tabbar" aria-label="Secciones">
      {PESTANAS.map(({ href, label, Icono }) => (
        <Link
          key={href}
          href={href}
          className="tab"
          aria-current={ruta === href ? 'page' : undefined}
        >
          <Icono />
          {label}
        </Link>
      ))}
    </nav>
  );
}
