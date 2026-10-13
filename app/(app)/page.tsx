'use client';

import Link from 'next/link';
import { BotonAjustes } from '@/components/BotonAjustes';
import { IconLuna, IconSol } from '@/components/icons';
import { progresoTema } from '@/lib/local-store';
import { TEMAS } from '@/lib/temas';
import { isDue } from '@/lib/srs';
import { plural, saludo } from '@/lib/ui';
import { useEstado } from '../estado';

/** Las partes de un nivel. Hoy solo Ideas existe; las otras se muestran para que se vea el camino. */
const PARTES = [
  { nombre: 'Vocabulary', detalle: 'Las palabras del tema', color: 'var(--note-4)', icono: 'Aa' },
  { nombre: 'Ideas', detalle: 'Armar frases', color: 'var(--note-1)', icono: '☰', activa: true },
  { nombre: 'Speaking', detalle: 'Dilo tú', color: 'var(--note-2)', icono: '🎤' },
  { nombre: 'Listening', detalle: 'Escribe lo que oyes', color: 'var(--note-3)', icono: '🎧' },
];

/**
 * Inicio (#76): qué sigue en tu ruta. El tema y el nivel en que vas, con un solo
 * botón para continuar; el repaso de palabras queda abajo, más pequeño. El mazo y
 * sus tres modos de repaso viven ahora en «Palabras».
 */
export default function Inicio() {
  const { listo, deck, progresoDe, ajuste, alternarTema, usuario } = useEstado();

  // Hasta que IndexedDB conteste no sabemos el progreso real: esperar se ve mejor que corregir números.
  if (!listo) return <section className="view" aria-busy="true" />;

  // Con un solo tema la ruta es ese; los siguientes se abrirán por orden cuando existan.
  const tema = TEMAS[0];
  const { nivel, racha } = progresoTema(tema.id);
  const nuevo = nivel === 1 && racha === 0;
  const actual = tema.niveles[nivel - 1];
  const porRepasar = deck.filter((w) => isDue(progresoDe(w.en))).length;
  const oscuro = ajuste('theme') === 'dark';
  const primerNombre = usuario.nombre?.trim().split(/\s+/)[0] ?? null;

  return (
    <section className="view">
      <div className="hello">
        <div>
          <p className="eyebrow">
            {saludo()}
            {primerNombre ? `, ${primerNombre}` : ''}
          </p>
          <h1 className="h1">
            {nuevo ? (
              <>
                Aprende inglés
                <br />
                paso a paso
              </>
            ) : (
              <>
                Sigue donde
                <br />
                lo dejaste
              </>
            )}
          </h1>
        </div>
        <div className="hello-side">
          <span className="streak">
            <span className="flame">🔥</span> {ajuste('streak')}
          </span>
          <button className="themebtn" onClick={alternarTema} aria-label="Cambiar entre tema claro y oscuro">
            {oscuro ? <IconSol /> : <IconLuna />}
          </button>
          <BotonAjustes />
        </div>
      </div>

      <div className="block">
        <div className="note" style={{ '--note': nuevo ? '#FFE066' : '#B8E1FF' } as React.CSSProperties}>
          <span className="n-tag">
            {nuevo ? 'Empieza aquí · tu primer tema' : `Tu tema · nivel ${nivel} de ${tema.niveles.length}`}
          </span>
          <span className="tema-w">{tema.nombre}</span>
          <span className="es">{nuevo ? tema.resumen : actual.nombre}</span>
          <span className="tema-dots" aria-hidden="true">
            {tema.niveles.map((_, i) => (
              <i key={i} className={i < nivel ? 'on' : undefined} />
            ))}
          </span>
        </div>
        <Link href={`/temas/${tema.id}/practicar`} className="btn solid wide">
          {nuevo ? `Empezar con «${tema.nombre}»` : 'Continuar'}
        </Link>
      </div>

      <div className="block">
        <p className="eyebrow">Este nivel, por partes</p>
        <div className="partes">
          {PARTES.map((p) => {
            const contenido = (
              <>
                <i style={{ background: p.color }}>{p.icono}</i>
                <span>
                  {p.nombre}
                  <small>{p.activa ? p.detalle : 'Pronto'}</small>
                </span>
              </>
            );
            return p.activa ? (
              <Link key={p.nombre} href={`/temas/${tema.id}/practicar`} className="parte">
                {contenido}
              </Link>
            ) : (
              <span key={p.nombre} className="parte off" aria-disabled="true">
                {contenido}
              </span>
            );
          })}
          <span className="parte off ancha" aria-disabled="true">
            <i style={{ background: 'var(--note-1)' }}>💬</i>
            <span>
              Conversar con la IA
              <small>Practica hablando · próximamente</small>
            </span>
          </span>
        </div>
      </div>

      <Link href="/tarjetas" className="repaso">
        <span className="ic">{porRepasar}</span>
        <span className="lab">
          <b>Repaso de palabras</b>
          <span>{porRepasar ? `${plural(porRepasar, 'palabra')} por repasar hoy` : 'Todo al día'}</span>
        </span>
      </Link>
    </section>
  );
}
