'use client';

import { useCallback, useEffect, useState } from 'react';
import { Sticker } from '@/components/Sticker';
import { IconAltavoz, IconCruz, IconTick } from '@/components/icons';
import * as audio from '@/lib/audio';
import * as store from '@/lib/local-store';
import { session, shuffle, type Word } from '@/lib/srs';
import { noteColor } from '@/lib/ui';
import { useEstado } from '../estado';

type Pregunta = { word: Word; opciones: string[] };

function armarPregunta(deck: Word[]): Pregunta | null {
  if (!deck.length) return null;
  const pool = session(deck, store.progressOf, 20);
  const word = pool[0] || deck[0];
  const otras = shuffle(deck.filter((x) => x.en !== word.en)).slice(0, 3);
  return { word, opciones: shuffle([word, ...otras]).map((x) => x.es) };
}

export default function Adivinar() {
  const { listo, deck, aciertos, fallos, calificar, ajuste, guardarAjuste } = useEstado();
  const [pregunta, setPregunta] = useState<Pregunta | null>(null);
  const [elegida, setElegida] = useState<string | null>(null);
  const [mazoUsado, setMazoUsado] = useState<Word[] | null>(null);

  const siguientePregunta = useCallback(() => {
    setPregunta(armarPregunta(deck));
    setElegida(null);
  }, [deck]);

  // La primera pregunta no puede armarse hasta que el mazo esté cargado, y
  // hacerlo en un efecto encadena un render de más. Ajustar el estado durante
  // el render es el patrón que React recomienda para esto.
  if (listo && deck !== mazoUsado) {
    setMazoUsado(deck);
    setPregunta(armarPregunta(deck));
    setElegida(null);
  }

  const soloAudio = ajuste('audioOnly');

  const elegir = useCallback(
    (opcion: string) => {
      if (!pregunta || elegida !== null) return;
      const acerto = opcion === pregunta.word.es;
      setElegida(opcion);
      calificar(pregunta.word, acerto);
      // Al acertar se oye la traducción; al fallar, la palabra despacio, que es
      // cuando hace falta volver a escucharla bien.
      if (acerto) {
        audio.say(pregunta.word.es, 'es', { word: pregunta.word.en, part: 'es' });
      } else {
        audio.say(pregunta.word.en, 'en', { rate: 0.6, word: pregunta.word.en, part: 'en' });
      }
    },
    [pregunta, elegida, calificar]
  );

  // Atajos A B C D, como en la versión anterior.
  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      if (!pregunta || elegida !== null) return;
      const i = 'abcd'.indexOf(e.key.toLowerCase());
      if (i >= 0 && pregunta.opciones[i]) elegir(pregunta.opciones[i]);
    };
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  }, [pregunta, elegida, elegir]);

  if (!listo || !pregunta) return <section className="view" aria-busy="true" />;

  const w = pregunta.word;
  const respondida = elegida !== null;
  const acerto = respondida && elegida === w.es;
  // La ilustración aparece después de responder: antes regalaría la respuesta.
  const ocultarPalabra = soloAudio && !respondida;

  return (
    <section className="view">
      <div className="topbar">
        <span className="h2">Adivinar</span>
        <span className="count">
          Aciertos {aciertos}/{aciertos + fallos}
        </span>
      </div>

      <button
        className="toggle"
        aria-pressed={soloAudio}
        onClick={() => guardarAjuste('audioOnly', !soloAudio)}
      >
        <span>
          Solo audio
          <span className="muted sm block">para ir caminando</span>
        </span>
        <span className="knob">
          <i />
        </span>
      </button>

      <div className="note quizcard" style={{ '--note': noteColor(deck, w) } as React.CSSProperties}>
        <div className="n-top">
          <div className="qleft">
            <span className="n-tag">¿Qué significa?</span>
            {ocultarPalabra ? (
              <p className="es listen-cue">Escucha y adivina…</p>
            ) : (
              <>
                <p className="en md">{w.en}</p>
                <p className="ipa">{w.ipa}</p>
              </>
            )}
          </div>
          {respondida && <Sticker word={w} />}
          <button
            className="spk lg"
            onClick={() => audio.say(w.en, 'en', { word: w.en, part: 'en' })}
            aria-label="Escuchar la palabra"
          >
            <IconAltavoz />
          </button>
        </div>
      </div>

      <div className="opts">
        {pregunta.opciones.map((o, k) => {
          let clase = '';
          let marca = null;
          if (respondida) {
            if (o === w.es) {
              clase = ' good';
              marca = (
                <span className="mk">
                  <IconTick />
                </span>
              );
            } else if (o === elegida) {
              clase = ' bad';
              marca = (
                <span className="mk">
                  <IconCruz />
                </span>
              );
            } else {
              clase = ' off';
            }
          }
          return (
            <button
              key={o}
              className={`opt${clase}`}
              onClick={() => elegir(o)}
              disabled={respondida}
            >
              <span className="key">{'ABCD'[k]}</span>
              <span className="lb">{o}</span>
              {marca}
            </button>
          );
        })}
      </div>

      <div className="grow" />

      {respondida ? (
        <div className="fb">
          <div>
            <p className={`ttl ${acerto ? 'good' : 'bad'}`}>{acerto ? '¡Correcto!' : 'Casi…'}</p>
            <p className="sub">
              {acerto ? `${w.en} = ${w.es}` : `La respuesta era «${w.es}»`}
            </p>
          </div>
          <button className="btn solid wide" onClick={siguientePregunta}>
            Siguiente palabra
          </button>
        </div>
      ) : (
        <p className="hint">Toca una opción · o usa las teclas A B C D</p>
      )}
    </section>
  );
}
