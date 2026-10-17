'use client';

import Link from 'next/link';
import { notFound, useParams } from 'next/navigation';
import { MasEjercicios } from '@/components/MasEjercicios';
import { progresoTema } from '@/lib/local-store';
import { ACIERTOS_PARA_SUBIR, temaPorId } from '@/lib/temas';
import { useEstado } from '../../../estado';

/** Las partes de un nivel (#77 y #78). */
const PARTES = [
  { nombre: 'Vocabulary', detalle: 'Las palabras del tema', color: 'var(--note-4)', icono: 'Aa', ruta: 'vocabulario' },
  { nombre: 'Ideas', detalle: 'Armar frases', color: 'var(--acento)', icono: '☰', ruta: 'practicar' },
  { nombre: 'Speaking', detalle: 'Dilo tú', color: 'var(--note-2)', icono: '🎤', ruta: 'practicar?parte=speaking' },
  { nombre: 'Listening', detalle: 'Escribe lo que oyes', color: 'var(--note-3)', icono: '🎧', ruta: 'practicar?parte=listening' },
];

/** La vista de un tema: dónde vas, la escalera de niveles y las partes del nivel (cuatro activas y Conversar como placeholder). */
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
        <p className="eyebrow">Este nivel, por partes</p>
        <div className="partes">
          {PARTES.map((p) => (
            <Link key={p.nombre} href={`/temas/${tema.id}/${p.ruta}`} className="parte on">
              <i style={{ background: p.color }}>{p.icono}</i>
              <span>
                {p.nombre}
                <small>{p.detalle}</small>
              </span>
            </Link>
          ))}
          <Link href={`/temas/${tema.id}/hablar`} className="parte on ancha">
            <i style={{ background: 'var(--acento)' }}>💬</i>
            <span>
              Conversar con la IA
              <small>Habla sobre este nivel</small>
            </span>
          </Link>
        </div>
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
