'use client';

import Link from 'next/link';
import { notFound, useParams } from 'next/navigation';
import { MasEjercicios } from '@/components/MasEjercicios';
import { progresoTema } from '@/lib/local-store';
import { ACIERTOS_PARA_SUBIR, temaPorId } from '@/lib/temas';
import { useEstado } from '../../../estado';

/** La vista de un tema: dónde vas, la escalera de niveles y el botón para practicar. */
export default function VistaTema() {
  const { listo } = useEstado();
  const { tema: id } = useParams<{ tema: string }>();
  const tema = temaPorId(id);
  if (!tema) notFound();
  if (!listo) return <section className="view" aria-busy="true" />;

  const { nivel, racha } = progresoTema(tema.id);
  const actual = tema.niveles[nivel - 1];
  // La racha solo se queda llena cuando el siguiente nivel aún no tiene ejercicios.
  const completo = racha >= ACIERTOS_PARA_SUBIR;

  return (
    <section className="view">
      <Link href="/" className="back">
        ← Inicio
      </Link>
      <div className="block">
        <p className="eyebrow">Tema</p>
        <h1 className="h1">{tema.nombre}</h1>
        <p className="muted">{tema.resumen}</p>
      </div>

      <div className="note" style={{ '--note': '#6FD3FF' } as React.CSSProperties}>
        <span className="n-tag">
          Nivel {nivel} · {actual.nombre}
        </span>
        <span className="es">{actual.ejemplo}</span>
        <span className="tema-racha">
          {completo
            ? 'Nivel completo. El siguiente se abre cuando tenga ejercicios.'
            : `Aciertos seguidos: ${racha} de ${ACIERTOS_PARA_SUBIR} para subir`}
        </span>
        <div className="tema-prog" aria-hidden="true">
          <i style={{ width: `${(racha / ACIERTOS_PARA_SUBIR) * 100}%` }} />
        </div>
      </div>

      <div className="block">
        <Link href={`/temas/${tema.id}/practicar`} className="btn solid wide">
          Practicar este nivel
        </Link>
        <MasEjercicios tema={tema.id} nivel={nivel} />
      </div>

      <div className="block">
        <p className="eyebrow">Escalera</p>
        <ol className="tema-niveles">
          {tema.niveles.map((n, i) => {
            const bloqueado = i + 1 > nivel;
            return (
              <li key={n.nombre} className={`lv${bloqueado ? ' lock' : ''}`}>
                <span className={`lv-n${i + 1 === nivel ? ' cur' : ''}`}>{i + 1}</span>
                <span className="lv-txt">
                  <b>{n.nombre}</b>
                  <span>{n.ejemplo}</span>
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
