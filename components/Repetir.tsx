'use client';

import { useEffect, useState } from 'react';
import * as audio from '@/lib/audio';
import { useGrabadora } from '@/lib/grabadora';
import { describirSonido, TITULO_ESTADO, type ResultadoVoz } from '@/lib/pronunciacion';
import { fraseDictado, normalizar, type EjercicioEscrito } from '@/lib/temas';
import { tomaAWav } from '@/lib/wav';
import { IconAltavoz, IconMicro, IconParar } from './icons';

const MAX_SEGUNDOS = 8;
const VACIO = { word: '' };

type Fase = 'reposo' | 'evaluando' | 'resultado';

/** Lo que sigue a una evaluación; `restantes` es lo que queda del tope de hoy. */
type Respuesta = Partial<ResultadoVoz> & { sinVoz?: boolean; restantes?: number; error?: string };

/**
 * «Escucha y repite» (#68): suena la frase, la dices y Azure evalúa la pronunciación.
 * No cuenta para la racha ni para subir de nivel: practicar hablando no bloquea nada.
 */
export function Repetir({
  ejercicio,
  clave,
  alSiguiente,
  avisar,
}: {
  ejercicio: EjercicioEscrito;
  /** Cambia con cada ejercicio, para soltar la toma anterior. */
  clave: string;
  alSiguiente: () => void;
  avisar: (mensaje: string) => void;
}) {
  const frase = fraseDictado(ejercicio);
  // Al terminar de grabar (a mano o por el tope de segundos) se evalúa sola.
  const grab = useGrabadora(
    clave,
    { texto: frase, ...VACIO },
    { max: MAX_SEGUNDOS, oirAlTerminar: false, alTerminar: () => void evaluar() }
  );
  const [fase, setFase] = useState<Fase>('reposo');
  const [resultado, setResultado] = useState<ResultadoVoz | null>(null);
  const [restantes, setRestantes] = useState<number | null>(null);

  const decir = () => {
    audio.stop();
    void audio.say(frase, 'en', { rate: 0.95 });
  };

  // Suena sola al llegar: quien practica acaba de tocar «Siguiente».
  useEffect(() => {
    decir();
    return () => audio.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave]);

  const evaluar = async () => {
    const toma = grab.toma();
    if (!toma) return;
    setFase('evaluando');
    try {
      const datos = new FormData();
      datos.set('texto', frase);
      let wav: Blob;
      try {
        wav = await tomaAWav(toma);
      } catch {
        avisar('No se pudo leer la grabación. Inténtalo de nuevo.');
        grab.descartar();
        setFase('reposo');
        return;
      }
      datos.set('audio', wav, 'toma.wav');
      const r = await fetch('/api/temas/pronunciar', { method: 'POST', body: datos });
      const d = (await r.json()) as Respuesta;
      if (typeof d.restantes === 'number') setRestantes(d.restantes);
      if (!r.ok || d.error) {
        avisar(d.error ?? 'No se pudo evaluar tu pronunciación. Inténtalo de nuevo.');
        grab.descartar();
        setFase('reposo');
        return;
      }
      if (d.sinVoz || !d.estado) {
        avisar('No te oí bien. Acércate al micrófono e inténtalo de nuevo.');
        grab.descartar();
        setFase('reposo');
        return;
      }
      setResultado(d as ResultadoVoz);
      setFase('resultado');
    } catch {
      avisar('No se pudo conectar. Comprueba tu señal e inténtalo de nuevo.');
      grab.descartar();
      setFase('reposo');
    }
  };

  const repetir = () => {
    grab.descartar();
    setResultado(null);
    setFase('reposo');
    decir();
  };

  const grabando = grab.estado === 'grabando';
  const sonido = describirSonido(resultado?.sonido);
  const flojas = new Set((resultado?.flojas ?? []).map(normalizar));

  return (
    <>
      <div className="note rep" style={{ '--note': '#FFE066' } as React.CSSProperties}>
        {resultado && <span className={`sello ${resultado.estado}`}>{TITULO_ESTADO[resultado.estado]}</span>}
        <span className="n-tag">Escucha y repite</span>
        <span className="es">{ejercicio.es}</span>
        <span className="en-dictado">
          {frase.split(' ').map((p, i) => (
            <span key={i}>
              {i > 0 && ' '}
              {flojas.has(normalizar(p)) ? <b className="floja">{p}</b> : p}
            </span>
          ))}
        </span>
        {!resultado && !grabando && (
          <button className="btn onnote sm" onClick={decir}>
            <IconAltavoz />
            Otra vez
          </button>
        )}
      </div>

      {sonido && (
        <div className="expl">
          <p className="lb">Para mejorar</p>
          <p className="corr sonido">{sonido.titulo}</p>
          {sonido.consejo && <p>{sonido.consejo}</p>}
        </div>
      )}

      <div className="grow" />

      {fase === 'resultado' && resultado ? (
        <div className="fb">
          <button className="btn wide" onClick={() => void grab.comparar()} disabled={grab.estado === 'oyendo'}>
            <IconAltavoz />
            {grab.estado === 'oyendo' ? (grab.paso === 'modelo' ? 'Modelo…' : 'Tú…') : 'Oírme después del modelo'}
          </button>
          <div className="dos">
            <button className={`btn wide${resultado.estado === 'bien' ? '' : ' solid'}`} onClick={repetir}>
              Repetir
            </button>
            <button className={`btn wide${resultado.estado === 'bien' ? ' solid' : ''}`} onClick={alSiguiente}>
              Siguiente
            </button>
          </div>
          <p className="hint">Se evalúa que se te entienda, no que borres tu acento.</p>
        </div>
      ) : fase === 'evaluando' ? (
        <div className="fb" role="status">
          <p className="ttl">
            <span className="spin" aria-hidden="true" /> Evaluando tu pronunciación…
          </p>
        </div>
      ) : (
        <div className="fb">
          {grabando && (
            <div className="onda" aria-hidden="true">
              {grab.niveles.slice(-11).map((n, i) => (
                <i key={i} style={{ height: `${Math.round(6 + n * 28)}px` }} />
              ))}
            </div>
          )}
          <button
            className={`mic${grabando ? ' rec' : ''}`}
            onClick={() => void grab.grabar()}
            aria-label={grabando ? 'Terminar la grabación' : 'Grabarte diciendo la frase'}
          >
            {grabando ? <IconParar /> : <IconMicro />}
          </button>
          <p className="ttl mic-t">{grabando ? `Te escucho… ${grab.segundos} s` : 'Toca y di la frase'}</p>
          {grab.error && <p className="hint">{grab.error}</p>}
          <p className="hint">
            {grabando
              ? `Toca el cuadro para terminar. Máximo ${MAX_SEGUNDOS} s.`
              : `Necesita conexión.${restantes !== null ? ` Te quedan ${restantes} evaluaciones hoy.` : ''}`}
          </p>
          {!grabando && (
            <button className="saltar" onClick={alSiguiente}>
              Saltar este ejercicio
            </button>
          )}
        </div>
      )}
    </>
  );
}
