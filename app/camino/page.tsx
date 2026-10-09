'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Sticker } from '@/components/Sticker';
import { IconAdelante, IconAtras, IconPausa, IconPlay } from '@/components/icons';
import * as audio from '@/lib/audio';
import * as store from '@/lib/local-store';
import { noteColor } from '@/lib/ui';
import { useEstado } from '../estado';

type Fase = 'idle' | 'en' | 'think' | 'es' | 'ex';

const ETIQUETAS: Record<Fase, string> = {
  idle: 'Pulsa play para empezar',
  en: 'Escucha…',
  think: 'Piensa la respuesta',
  es: 'Respuesta',
  ex: 'En contexto',
};

const PASOS: [Fase, string, string][] = [
  ['en', '1', 'Inglés'],
  ['think', '2', 'Piensas'],
  ['es', '3', 'Español'],
];

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function Camino() {
  const { listo, deck, ajuste, guardarAjuste } = useEstado();

  const [indice, setIndice] = useState(0);
  const [fase, setFase] = useState<Fase>('idle');
  const [restante, setRestante] = useState(0);
  const [sonando, setSonando] = useState(false);

  // El bucle es imperativo y vive más que un render, así que su control va en
  // refs. El token invalida la corrida anterior: sin eso, pulsar play dos
  // veces deja dos bucles hablando encima.
  const control = useRef({ on: false, token: 0, i: 0 });
  const tick = useRef<number | undefined>(undefined);
  // Los mandos de la pantalla de bloqueo reinician el bucle, o sea que
  // `arrancar` se llama a sí mismo. Se pasa por una ref para no referenciar
  // el callback antes de declararlo y para que siempre use la versión última.
  const arrancarRef = useRef<(desde: number) => void>(() => {});

  const parar = useCallback(() => {
    control.current.on = false;
    control.current.token++;
    clearInterval(tick.current);
    audio.stop();
    audio.setPlaybackState('paused');
    setSonando(false);
    setFase('idle');
    setRestante(0);
  }, []);

  const cuentaAtras = useCallback((segundos: number, vivo: () => boolean) => {
    return new Promise<void>((resolve) => {
      clearInterval(tick.current);
      let quedan = segundos;
      setRestante(quedan);
      tick.current = window.setInterval(() => {
        if (!vivo()) {
          clearInterval(tick.current);
          return resolve();
        }
        quedan--;
        setRestante(quedan);
        if (quedan <= 0) {
          clearInterval(tick.current);
          resolve();
        }
      }, 1000);
    });
  }, []);

  const arrancar = useCallback(
    (desde: number) => {
      parar();
      control.current.on = true;
      const token = ++control.current.token;
      const vivo = () => control.current.on && token === control.current.token;
      setSonando(true);

      (async () => {
        let i = desde;
        while (vivo()) {
          const w = deck[i];
          if (!w) return;
          control.current.i = i;
          setIndice(i);
          setFase('en');
          setRestante(0);

          audio.setNowPlaying(w, {
            play: () => arrancarRef.current(control.current.i),
            pause: () => parar(),
            nexttrack: () => arrancarRef.current((control.current.i + 1) % deck.length),
            previoustrack: () =>
              arrancarRef.current((control.current.i - 1 + deck.length) % deck.length),
          });
          audio.setPlaybackState('playing');

          await audio.say(w.en, 'en', { rate: 0.9, word: w.en, part: 'en' });
          if (!vivo()) return;

          setFase('think');
          await cuentaAtras(store.get('pause'), vivo);
          if (!vivo()) return;

          setFase('es');
          setRestante(0);
          await audio.say(w.es, 'es', { rate: 0.95, word: w.en, part: 'es' });
          if (!vivo()) return;

          if (store.get('withEx')) {
            setFase('ex');
            await audio.say(w.xe ?? '', 'en', { rate: 0.9, word: w.en, part: 'xe' });
            if (!vivo()) return;
          }

          await esperar(1200);
          if (!vivo()) return;
          i = (i + 1) % deck.length;
        }
      })();
    },
    [deck, parar, cuentaAtras]
  );

  useEffect(() => {
    arrancarRef.current = arrancar;
  }, [arrancar]);

  // Al salir de la vista se corta el audio. Si no, la voz sigue hablando
  // desde una pantalla que ya no está.
  useEffect(() => parar, [parar]);

  if (!listo || !deck.length) return <section className="view camino" aria-busy="true" />;

  const w = deck[indice] ?? deck[0];
  const pausa = ajuste('pause');
  const conEjemplo = ajuste('withEx');
  const mostrarEs = fase === 'es' || fase === 'ex';

  return (
    <section className={`view camino ${sonando ? 'playing' : ''}`}>
      <div className="topbar">
        <span className="h2">Modo camino</span>
        <span className="count">
          {indice + 1} de {deck.length}
        </span>
      </div>
      <p className="muted">
        Ponte los auriculares y guarda el teléfono: oyes la palabra en inglés, piensas, y luego
        llega la respuesta en español.
      </p>

      <div className="note roadcard" style={{ '--note': noteColor(deck, w) } as React.CSSProperties}>
        <div className="n-top">
          <span className="n-tag">{ETIQUETAS[fase]}</span>
          <Sticker word={w} size="sm" />
        </div>
        <p className="en md">{w.en}</p>
        <p className={`es ${mostrarEs ? '' : 'veiled'}`}>{mostrarEs ? w.es : '¿ … ?'}</p>
      </div>

      <div className="steps">
        {PASOS.map(([k, n, l]) => (
          <div className={`step${fase === k ? ' on' : ''}`} key={k}>
            <b>{n}</b>
            <span>{l}</span>
          </div>
        ))}
      </div>

      <div className="grow" />

      <div className="transport">
        <button
          className="tbtn"
          onClick={() => arrancar(indice)}
          aria-label="Repetir palabra"
        >
          <IconAtras />
        </button>
        <span className="bigwrap">
          <span className="halo" />
          <button
            className="big"
            onClick={() => (sonando ? parar() : arrancar(indice))}
            aria-label={sonando ? 'Pausar' : 'Reproducir'}
          >
            {fase === 'think' && restante > 0 ? (
              <span className="tick">{restante}</span>
            ) : sonando ? (
              <IconPausa />
            ) : (
              <IconPlay />
            )}
          </button>
        </span>
        <button
          className="tbtn"
          onClick={() => arrancar((indice + 1) % deck.length)}
          aria-label="Siguiente palabra"
        >
          <IconAdelante />
        </button>
      </div>

      <div className="block">
        <p className="eyebrow">Tiempo para pensar</p>
        <div className="pauses">
          {[3, 5, 8].map((s) => (
            <button
              key={s}
              className={`pill${pausa === s ? ' on' : ''}`}
              onClick={() => guardarAjuste('pause', s)}
            >
              {s} s
            </button>
          ))}
        </div>
        <button
          className="toggle onroad"
          aria-pressed={conEjemplo}
          onClick={() => guardarAjuste('withEx', !conEjemplo)}
        >
          <span>Oír también la frase de ejemplo</span>
          <span className="knob">
            <i />
          </span>
        </button>
      </div>
    </section>
  );
}
