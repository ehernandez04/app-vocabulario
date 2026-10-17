'use client';

import { notFound, useParams, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { IconAltavoz, IconMicro, IconParar } from '@/components/icons';
import { useGrabadora } from '@/lib/grabadora';
import { progresoTema } from '@/lib/local-store';
import { temaPorId } from '@/lib/temas';
import { tomaAWav } from '@/lib/wav';
import { useEstado } from '../../../../estado';

const MAX_SEGUNDOS = 20;

type Burbuja = { quien: 'ia' | 'tu'; texto: string; audio?: string | null };

type Fase = 'inicio' | 'empezando' | 'conversando' | 'procesando' | 'sin-puntos' | 'error';

/**
 * Conversar con la IA (#78): un turno es grabar tu respuesta, transcribirla,
 * pedirle a la IA que siga el papel y oír su voz si el tope mensual de
 * ElevenLabs lo permite. No se guarda nada: al salir se pierde la charla.
 *
 * El audio nunca arranca solo: la primera línea de la IA espera a que toques
 * «Empezar a hablar», y cada respuesta sigue a que toques el micrófono.
 */
export default function HablarConLaIA() {
  const { avisar } = useEstado();
  const router = useRouter();
  const { tema: id } = useParams<{ tema: string }>();
  const tema = temaPorId(id);
  if (!tema) notFound();

  const nivel = progresoTema(tema.id).nivel;
  const actual = tema.niveles[nivel - 1];

  const [fase, setFase] = useState<Fase>('inicio');
  const [turnos, setTurnos] = useState<Burbuja[]>([]);
  const [situacion, setSituacion] = useState('');
  const [restantes, setRestantes] = useState<number | null>(null);
  const [mensaje, setMensaje] = useState('');

  const reproductor = useRef<HTMLAudioElement | null>(null);
  const turnosRef = useRef<Burbuja[]>([]);
  useEffect(() => {
    turnosRef.current = turnos;
  }, [turnos]);

  const reproducir = (base64: string | null | undefined) => {
    reproductor.current?.pause();
    if (!base64) return;
    const a = new Audio(`data:audio/mpeg;base64,${base64}`);
    reproductor.current = a;
    void a.play().catch(() => {});
  };

  const grab = useGrabadora(
    `${tema.id}-${turnos.length}`,
    { texto: '', word: '' },
    { max: MAX_SEGUNDOS, oirAlTerminar: false, alTerminar: () => void responder() }
  );

  useEffect(() => () => reproductor.current?.pause(), []);

  /** Se llama desde el botón «Empezar a hablar»: ese toque es el gesto que permite que suene el audio. */
  const empezar = async () => {
    setFase('empezando');
    try {
      const r = await fetch('/api/hablar/empezar', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ tema: tema.id, nivel }),
      });
      const d = (await r.json()) as {
        situacion?: string;
        apertura?: string;
        audio?: string | null;
        restantes?: number;
        error?: string;
      };
      if (!r.ok || !d.apertura) {
        setMensaje(d.error ?? 'No se pudo empezar la conversación.');
        setFase(r.status === 429 ? 'sin-puntos' : 'error');
        return;
      }
      setSituacion(d.situacion ?? '');
      setTurnos([{ quien: 'ia', texto: d.apertura, audio: d.audio }]);
      setRestantes(d.restantes ?? null);
      reproducir(d.audio);
      setFase('conversando');
    } catch {
      setMensaje('No se pudo conectar. Comprueba tu señal e inténtalo de nuevo.');
      setFase('error');
    }
  };

  const responder = async () => {
    const toma = grab.toma();
    if (!toma) return;
    setFase('procesando');
    try {
      let wav: Blob;
      try {
        wav = await tomaAWav(toma);
      } catch {
        avisar('No se pudo leer la grabación. Inténtalo de nuevo.');
        grab.descartar();
        setFase('conversando');
        return;
      }
      const datos = new FormData();
      datos.set('tema', tema.id);
      datos.set('nivel', String(nivel));
      datos.set('historia', JSON.stringify(turnosRef.current.map(({ quien, texto }) => ({ quien, texto }))));
      datos.set('audio', wav, 'toma.wav');
      const r = await fetch('/api/hablar/responder', { method: 'POST', body: datos });
      const d = (await r.json()) as {
        transcripcion?: string;
        respuesta?: string;
        audio?: string | null;
        restantes?: number;
        sinVoz?: boolean;
        error?: string;
      };
      grab.descartar();
      if (d.sinVoz) {
        avisar('No te oí bien. Acércate al micrófono e inténtalo de nuevo.');
        setFase('conversando');
        return;
      }
      if (!r.ok || !d.respuesta) {
        avisar(d.error ?? 'No se pudo generar la respuesta. Inténtalo de nuevo.');
        if (r.status === 429) {
          setMensaje(d.error ?? 'Hoy ya usaste tus puntos.');
          setFase('sin-puntos');
        } else {
          setFase('conversando');
        }
        return;
      }
      setTurnos((t) => [
        ...t,
        { quien: 'tu', texto: d.transcripcion ?? '' },
        { quien: 'ia', texto: d.respuesta ?? '', audio: d.audio },
      ]);
      setRestantes(d.restantes ?? null);
      reproducir(d.audio);
      setFase('conversando');
    } catch {
      avisar('No se pudo conectar. Comprueba tu señal e inténtalo de nuevo.');
      grab.descartar();
      setFase('conversando');
    }
  };

  const salir = () => {
    reproductor.current?.pause();
    router.push(`/temas/${tema.id}`);
  };

  const grabando = grab.estado === 'grabando';
  const sinVozEsteMes = turnos.some((t) => t.quien === 'ia' && !t.audio);

  return (
    <section className="view">
      <div className="topbar">
        <button className="back" onClick={salir} aria-label="Salir de la conversación">
          ✕
        </button>
        <div className="titulo grow">
          <div className="tema-h">{tema.nombre}</div>
          <div className="nivel-h">
            Nivel {nivel} · {actual.nombre}
          </div>
        </div>
      </div>

      {fase === 'inicio' || fase === 'empezando' ? (
        <div className="block">
          <p className="eyebrow">Conversar con la IA</p>
          <p className="muted">
            La IA te propone una situación de todos los días, ligada a este nivel, y hablas con ella en inglés por
            turnos.
          </p>
          <button className="btn solid wide" onClick={empezar} disabled={fase === 'empezando'}>
            {fase === 'empezando' ? 'Empezando…' : 'Empezar a hablar'}
          </button>
        </div>
      ) : fase === 'sin-puntos' || fase === 'error' ? (
        <div className="block">
          <p className="eyebrow">{fase === 'sin-puntos' ? 'Sin puntos de IA hoy' : 'Algo salió mal'}</p>
          <p className="muted">{mensaje}</p>
          <button className="btn solid wide" onClick={salir}>
            Volver al tema
          </button>
        </div>
      ) : (
        <>
          <div className="charla">
            {situacion && (
              <div className="situacion">
                <span className="tag">Situación</span>
                <span className="texto">{situacion}</span>
              </div>
            )}
            {turnos.map((t, i) => (
              <div key={i} className={`burbuja ${t.quien}`}>
                {t.texto}
                {t.quien === 'ia' &&
                  (t.audio ? (
                    <button className="pie-audio reproducir" onClick={() => reproducir(t.audio)}>
                      <IconAltavoz /> Oír
                    </button>
                  ) : (
                    <span className="pie-audio">Sin voz: se acabó el audio del mes</span>
                  ))}
              </div>
            ))}
            {fase === 'procesando' && (
              <div className="burbuja ia escribiendo">
                <span className="punto" />
                <span className="punto" />
                <span className="punto" />
              </div>
            )}
          </div>

          {sinVozEsteMes && (
            <p className="hint">Se acabó la voz de la IA por este mes. La conversación sigue en texto.</p>
          )}

          <div className="grow" />

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
              onClick={() => {
                reproductor.current?.pause();
                void grab.grabar();
              }}
              disabled={fase === 'procesando'}
              aria-label={grabando ? 'Terminar la grabación' : 'Grabar tu respuesta'}
            >
              {grabando ? <IconParar /> : <IconMicro />}
            </button>
            <p className="ttl mic-t">
              {fase === 'procesando' ? 'Pensando la respuesta…' : grabando ? `Te escucho… ${grab.segundos} s` : 'Toca y responde en inglés'}
            </p>
            {grab.error && <p className="hint">{grab.error}</p>}
            {fase === 'conversando' && !grabando && (
              <p className="hint">
                Necesita conexión.
                {restantes !== null && ` ${restantes === 1 ? 'Te queda 1 turno' : `Te quedan ${restantes} turnos`} hoy.`}
              </p>
            )}
            <button className="saltar" onClick={salir}>
              Terminar conversación
            </button>
          </div>
        </>
      )}
    </section>
  );
}
