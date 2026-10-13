'use client';

import Link from 'next/link';
import { TEMAS, cargarProgreso } from '@/lib/temas';

/** El bloque de Inicio para entrar a los temas de gramática (#39). */
export function BloqueTemas() {
  return (
    <div className="block">
      {TEMAS.map((t) => {
        const { nivel } = cargarProgreso(t.id);
        const total = t.niveles.length;
        return (
          <Link
            key={t.id}
            href={`/temas/${t.id}`}
            className="tema-card"
            aria-label={`Seguir con ${t.nombre}, nivel ${nivel} de ${total}`}
          >
            <span className="tema-txt">
              <span className="tema-w">{t.nombre}</span>
              <small>
                Nivel {nivel} de {total} · {t.niveles[nivel - 1].nombre}
              </small>
              <span className="tema-dots" aria-hidden="true">
                {t.niveles.map((_, i) => (
                  <i key={i} className={i < nivel ? 'on' : undefined} />
                ))}
              </span>
            </span>
            <span className="tema-go">Seguir →</span>
          </Link>
        );
      })}
    </div>
  );
}

