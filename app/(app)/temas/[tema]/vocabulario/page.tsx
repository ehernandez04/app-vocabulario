'use client';

import Link from 'next/link';
import { notFound, useParams } from 'next/navigation';
import { useState } from 'react';
import { IconParar, IconPlay } from '@/components/icons';
import * as audio from '@/lib/audio';
import { progresoTema } from '@/lib/local-store';
import { temaPorId } from '@/lib/temas';
import { useEstado } from '../../../../estado';

/**
 * Vocabulary (#77): las palabras propias del nivel en que vas. No llevan caja
 * ni racha —no son el mazo global de Palabras—, solo se escuchan y se leen
 * antes de practicar Ideas, Speaking o Listening.
 */
export default function Vocabulario() {
  const { listo } = useEstado();
  const { tema: id } = useParams<{ tema: string }>();
  const tema = temaPorId(id);
  if (!tema) notFound();

  const [sonando, setSonando] = useState<string | null>(null);

  if (!listo) return <section className="view" aria-busy="true" />;

  const { nivel } = progresoTema(tema.id);
  const actual = tema.niveles[nivel - 1];

  const oir = (palabra: string) => {
    audio.stop();
    if (sonando === palabra) {
      setSonando(null);
      return;
    }
    setSonando(palabra);
    void audio.say(palabra, 'en').then(() => setSonando((s) => (s === palabra ? null : s)));
  };

  return (
    <section className="view">
      <Link href={`/temas/${tema.id}`} className="back">
        ← {tema.nombre}
      </Link>

      <div className="vocab-hero">
        <span className="n-tag">
          Vocabulary · Nivel {nivel}
        </span>
        <span className="vocab-niv">{actual.nombre}</span>
      </div>

      {actual.palabras.length === 0 ? (
        <p className="muted">Este nivel todavía no tiene palabras propias.</p>
      ) : (
        <ul className="vocab-lista">
          {actual.palabras.map((p) => (
            <li key={p.en} className="vocab-item">
              <div className="vocab-txt">
                <span className="vocab-en" lang="en">
                  {p.en}
                </span>
                <span className="vocab-ipa">{p.ipa}</span>
                <span className="vocab-es">{p.es}</span>
              </div>
              <button
                className={`vocab-play${sonando === p.en ? ' on' : ''}`}
                onClick={() => oir(p.en)}
                aria-label={sonando === p.en ? 'Detener' : `Escuchar «${p.en}»`}
              >
                {sonando === p.en ? <IconParar /> : <IconPlay />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
