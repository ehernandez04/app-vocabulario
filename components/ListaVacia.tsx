'use client';

import Link from 'next/link';
import { useEstado } from '@/app/estado';

/** Lo que se ve en vez de una sesión cuando la lista elegida no tiene palabras. */
export function ListaVacia({ titulo }: { titulo: string }) {
  const { listas, listaElegida, elegirLista } = useEstado();
  const nombre = listas.find((l) => l.id === listaElegida)?.name ?? 'La lista';
  return (
    <section className="view">
      <div className="topbar">
        <span className="h2">{titulo}</span>
      </div>
      <div className="done-card">
        <p className="h2">«{nombre}» está vacía</p>
        <p className="muted">No hay palabras que repasar. Agrégale algunas desde Inicio.</p>
        <Link href="/" className="btn solid">
          Ir a Inicio
        </Link>
        <button className="btn" onClick={() => elegirLista(null)}>
          Repasar todas
        </button>
      </div>
    </section>
  );
}
