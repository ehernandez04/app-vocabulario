'use client';

import { useRef, useState } from 'react';
import { Sticker } from '@/components/Sticker';
import { IconAltavoz, IconComillas, IconDespacio } from '@/components/icons';
import * as audio from '@/lib/audio';
import { noteColor, peekColor } from '@/lib/ui';
import { useEstado } from '../estado';

export default function Tarjetas() {
  const {
    listo,
    deck,
    cola,
    indice,
    aciertos,
    fallos,
    progresoDe,
    calificar,
    siguiente,
    rearmarCola,
    avisar,
  } = useEstado();
  const [revelada, setRevelada] = useState(false);

  if (!listo) return <section className="view" aria-busy="true" />;

  if (indice >= cola.length) {
    return (
      <section className="view">
        <div className="topbar">
          <span className="h2">Tarjetas</span>
          <span className="count">
            {cola.length}/{cola.length}
          </span>
        </div>
        <div className="done-card">
          <span className="big-n">{aciertos}</span>
          <p className="h2">¡Sesión terminada!</p>
          <p className="muted">
            Acertaste {aciertos} de {cola.length}.{' '}
            {/* Concordancia a mano: lleva verbo. */}
            {!fallos ? 'Ni una falla.' : fallos === 1 ? '1 vuelve mañana.' : `${fallos} vuelven mañana.`}
          </p>
          <button
            className="btn solid"
            onClick={() => {
              rearmarCola();
              setRevelada(false);
            }}
          >
            Otra ronda
          </button>
        </div>
      </section>
    );
  }

  const w = cola[indice];
  const p = progresoDe(w.en);
  const pct = Math.round((indice / cola.length) * 100);

  const calificarTarjeta = (acerto: boolean) => {
    const despues = calificar(w, acerto);
    avisar(
      acerto ? `“${w.en}” sube a la caja ${despues.box}` : `“${w.en}” vuelve a la caja 1`
    );
    setRevelada(false);
    siguiente();
  };

  return (
    <section className="view">
      <div className="topbar">
        <span className="h2">Tarjetas</span>
        <span className="count">
          {indice + 1} / {cola.length}
        </span>
      </div>
      <div className="bar">
        <i style={{ width: `${pct}%` }} />
      </div>

      {/* La tarjeta manda la altura: #live va en flujo normal y .deckarea crece
          con ella. Con position:absolute e inset:0, al revelar se recorta. */}
      <div className="deckarea">
        <div className="peek p2" style={{ background: peekColor(deck, w, 2) }} />
        <div className="peek p1" style={{ background: peekColor(deck, w, 1) }} />
        <Arrastrable alSoltar={calificarTarjeta} habilitado={revelada} clave={w.en}>
          <div className="note" style={{ '--note': noteColor(deck, w) } as React.CSSProperties}>
            <span className="swipetag l">Otra vez</span>
            <span className="swipetag r">¡Lo sabía!</span>

            <div className="n-top">
              <span className="n-tag">Inglés · caja {p.box}</span>
              <button
                className="spk"
                onClick={() => audio.say(w.en, 'en', { rate: 0.95, word: w.en, part: 'en' })}
                aria-label="Escuchar en inglés"
              >
                <IconAltavoz />
              </button>
            </div>

            <p className="en">{w.en}</p>
            <p className="ipa">{w.ipa}</p>

            <div className="exrow">
              <Sticker word={w} />
              <button
                className="example"
                onClick={() => audio.say(w.xe ?? '', 'en', { rate: 0.9, word: w.en, part: 'xe' })}
              >
                <IconComillas />
                <span>{w.xe}</span>
              </button>
            </div>

            {revelada ? (
              <>
                <hr className="rip" />
                <div className="reveal revealed">
                  <div className="n-top">
                    <span className="n-tag">Español</span>
                    <button
                      className="spk sm"
                      onClick={() => audio.say(w.es, 'es', { rate: 0.95, word: w.en, part: 'es' })}
                      aria-label="Escuchar en español"
                    >
                      <IconAltavoz />
                    </button>
                  </div>
                  <p className="es">{w.es}</p>
                  <p className="xs">{w.xs}</p>
                </div>
              </>
            ) : (
              <div className="spacer">
                <button
                  className="btn onnote wide"
                  onClick={() => {
                    setRevelada(true);
                    audio.say(w.es, 'es', { rate: 0.95, word: w.en, part: 'es' });
                  }}
                >
                  Ver traducción
                </button>
              </div>
            )}
          </div>
        </Arrastrable>
      </div>

      {revelada ? (
        <>
          <div className="row2">
            <button className="btn" onClick={() => calificarTarjeta(false)}>
              Otra vez
            </button>
            <button className="btn solid" onClick={() => calificarTarjeta(true)}>
              Lo sabía
            </button>
          </div>
          <p className="hint">O arrastra la tarjeta: ← otra vez · lo sabía →</p>
        </>
      ) : (
        <>
          <button
            className="btn wide"
            onClick={() => audio.say(w.en, 'en', { rate: 0.55, word: w.en, part: 'en' })}
          >
            <IconDespacio /> Despacio
          </button>
          <p className="hint">Piénsalo en español antes de descubrirla</p>
        </>
      )}
    </section>
  );
}

/**
 * Arrastrar la tarjeta: a la izquierda "otra vez", a la derecha "lo sabía".
 *
 * Solo se arma cuando la traducción está a la vista; antes no tendría sentido
 * calificarse. Los botones de dentro siguen funcionando porque el gesto los
 * ignora explícitamente.
 */
function Arrastrable({
  children,
  alSoltar,
  habilitado,
  clave,
}: {
  children: React.ReactNode;
  alSoltar: (acerto: boolean) => void;
  habilitado: boolean;
  clave: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inicio = useRef<number | null>(null);
  const dx = useRef(0);

  const etiquetas = () => {
    const n = ref.current;
    return {
      izq: n?.querySelector<HTMLElement>('.swipetag.l'),
      der: n?.querySelector<HTMLElement>('.swipetag.r'),
    };
  };

  const alBajar = (e: React.PointerEvent) => {
    if (!habilitado) return;
    if ((e.target as HTMLElement).closest('button')) return;
    inicio.current = e.clientX;
    dx.current = 0;
    if (ref.current) ref.current.style.transition = 'none';
    try {
      ref.current?.setPointerCapture(e.pointerId);
    } catch {
      /* vacío */
    }
  };

  const alMover = (e: React.PointerEvent) => {
    if (inicio.current === null || !ref.current) return;
    dx.current = e.clientX - inicio.current;
    ref.current.style.transform = `translateX(${dx.current}px) rotate(${dx.current / 22}deg)`;
    const { izq, der } = etiquetas();
    if (izq) izq.style.opacity = dx.current < -24 ? String(Math.min(1, -dx.current / 90)) : '0';
    if (der) der.style.opacity = dx.current > 24 ? String(Math.min(1, dx.current / 90)) : '0';
  };

  const alLevantar = () => {
    if (inicio.current === null || !ref.current) return;
    const d = dx.current;
    inicio.current = null;
    ref.current.style.transition = 'transform .28s cubic-bezier(.3,1.2,.5,1)';
    if (Math.abs(d) > 92) {
      ref.current.classList.add(d < 0 ? 'fly-left' : 'fly-right');
      setTimeout(() => alSoltar(d > 0), 220);
      return;
    }
    ref.current.style.transform = '';
    const { izq, der } = etiquetas();
    if (izq) izq.style.opacity = '0';
    if (der) der.style.opacity = '0';
  };

  return (
    <div
      // Con key por palabra, React monta un nodo limpio en cada tarjeta y no
      // arrastra el transform ni la clase de vuelo de la anterior.
      key={clave}
      id="live"
      ref={ref}
      className="dealt"
      onPointerDown={alBajar}
      onPointerMove={alMover}
      onPointerUp={alLevantar}
      onPointerCancel={alLevantar}
    >
      {children}
    </div>
  );
}
