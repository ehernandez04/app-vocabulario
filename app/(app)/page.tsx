'use client';

import Link from 'next/link';
import { BotonAjustes } from '@/components/BotonAjustes';
import { IconLuna, IconSol } from '@/components/icons';
import { progresoTema } from '@/lib/local-store';
import { TEMAS } from '@/lib/temas';
import { isDue } from '@/lib/srs';
import { plural, saludo } from '@/lib/ui';
import { useEstado } from '../estado';

/** Las partes de un nivel (#77 y #78). */
const PARTES = [
  { nombre: 'Vocabulary', detalle: 'Las palabras del tema', color: 'var(--note-4)', icono: 'Aa', ruta: 'vocabulario' },
  { nombre: 'Ideas', detalle: 'Armar frases', color: 'var(--acento)', icono: '☰', ruta: 'practicar' },
  { nombre: 'Speaking', detalle: 'Dilo tú', color: 'var(--note-2)', icono: '🎤', ruta: 'practicar?parte=speaking' },
  { nombre: 'Listening', detalle: 'Escribe lo que oyes', color: 'var(--note-3)', icono: '🎧', ruta: 'practicar?parte=listening' },
];

/**
 * Inicio con Aurora (#101): la tarjeta del tema pasa de post-it a una tarjeta
 * con degradado y progreso por segmentos, y la barra de pestañas flota sobre
 * el contenido (ver `.tabbar` en app.css). El mazo y sus tres modos de repaso
 * viven en «Palabras».
 */
export default function Inicio() {
  const { listo, deck, progresoDe, ajuste, alternarTema, usuario } = useEstado();

  // Hasta que IndexedDB conteste no sabemos el progreso real: esperar se ve mejor que corregir números.
  if (!listo) return <section className="view inicio" aria-busy="true" />;

  // Con un solo tema la ruta es ese; los siguientes se abrirán por orden cuando existan.
  const tema = TEMAS[0];
  const { nivel, racha } = progresoTema(tema.id);
  const nuevo = nivel === 1 && racha === 0;
  const actual = tema.niveles[nivel - 1];
  const porRepasar = deck.filter((w) => isDue(progresoDe(w.en))).length;
  const oscuro = ajuste('theme') === 'dark';
  const primerNombre = usuario.nombre?.trim().split(/\s+/)[0] ?? null;

  return (
    <section className="view inicio">
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

      <div className="hero">
        <span className="hero-tag">
          {nuevo ? 'Empieza aquí · tu primer tema' : `Tu tema · nivel ${nivel} de ${tema.niveles.length}`}
        </span>
        <span className="hero-tema">{tema.nombre}</span>
        <span className={nuevo ? 'hero-niv resumen' : 'hero-niv'}>{nuevo ? tema.resumen : actual.nombre}</span>
        <span className="hero-seg" aria-hidden="true">
          {tema.niveles.map((_, i) => (
            <i key={i} className={i < nivel - 1 ? 'on' : i === nivel - 1 ? 'now' : undefined} />
          ))}
        </span>
        <Link href={`/temas/${tema.id}/practicar`} className="hero-cta">
          {nuevo ? `Empezar con «${tema.nombre}»` : 'Continuar'}
        </Link>
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
      </div>

      <Link href="/tarjetas" className="repaso">
        <span className="ic">{porRepasar}</span>
        <span className="lab">
          <b>Repaso de palabras</b>
          <span>{porRepasar ? `${plural(porRepasar, 'palabra')} por repasar hoy` : 'Todo al día'}</span>
        </span>
        <span className="chev" aria-hidden="true">
          ›
        </span>
      </Link>
    </section>
  );
}
