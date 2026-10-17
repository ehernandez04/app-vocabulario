'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { progresoTema } from '@/lib/local-store';
import { plural } from '@/lib/ui';
import { TEMAS } from '@/lib/temas';
import { useEstado } from '../../estado';

/**
 * La lista de temas para conversar con la IA (#78). Cada fila dice el tema y
 * el nivel donde vas, igual que `BloqueTemas`, para repasar justo lo que te toca.
 */
export default function Hablar() {
  const { listo } = useEstado();
  const [restantes, setRestantes] = useState<number | null>(null);

  useEffect(() => {
    let vivo = true;
    fetch('/api/hablar')
      .then((r) => (r.ok ? (r.json() as Promise<{ restantes: number }>) : null))
      .then((d) => d && vivo && setRestantes(d.restantes))
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, []);

  if (!listo) return <section className="view" aria-busy="true" />;

  return (
    <section className="view">
      <div className="topbar">
        <span className="h2">Hablar</span>
      </div>
      <p className="muted">
        Conversa con la IA sobre el tema y el nivel donde vas. No cuenta para tu racha ni te sube de nivel: es solo
        para soltarte hablando.
      </p>
      {restantes !== null && (
        <p className="hint">
          {restantes === 1 ? 'Hoy te queda 1 turno' : `Hoy te quedan ${plural(restantes, 'turno')}`} de conversación.
        </p>
      )}
      <div className="block">
        {TEMAS.map((t) => {
          const { nivel } = progresoTema(t.id);
          return (
            <Link
              key={t.id}
              href={`/temas/${t.id}/hablar`}
              className="tema-card"
              aria-label={`Conversar sobre ${t.nombre}, nivel ${nivel}: ${t.niveles[nivel - 1].nombre}`}
            >
              <span className="tema-txt">
                <span className="tema-w">{t.nombre}</span>
                <small>
                  Nivel {nivel} · {t.niveles[nivel - 1].nombre}
                </small>
              </span>
              <span className="tema-go">Hablar →</span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
