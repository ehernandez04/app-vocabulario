'use client';

import Link from 'next/link';
import { notFound, useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { IconAltavoz, IconBombilla, IconCruz, IconDespacio, IconPapelera, IconPlay, IconTick } from '@/components/icons';
import { MasEjercicios } from '@/components/MasEjercicios';
import * as audio from '@/lib/audio';
import { descargar, devolver, guardados, quitar } from '@/lib/ejercicios-local';
import { guardarProgresoTema, progresoTema } from '@/lib/local-store';
import { shuffle } from '@/lib/srs';
import {
  calificarDictado,
  calificarEscrito,
  conDictados,
  explicar,
  fraseDictado,
  opcionesDe,
  registrar,
  temaPorId,
  ACIERTOS_PARA_SUBIR,
  type Practica,
  type Progreso,
  type Veredicto,
} from '@/lib/temas';
import { useEstado } from '../../../../estado';

/** Cuántos ejercicios trae una tanda. */
const POR_TANDA = 10;

/** Cuánto se espera a la descarga antes de practicar con lo que ya hay. */
const ESPERA_DESCARGA_MS = 3000;

/** `nivel` es el de los ejercicios de la tanda: el progreso puede subir mientras se practica. */
type Sesion = { tema: string; nivel: number; progreso: Progreso; ejercicios: Practica[]; disponibles: number };

/** Cómo se llama cada tipo en la nota amarilla. */
const CONSIGNA = {
  elegir: 'Elige la forma correcta',
  escribir: 'Escribe la palabra que falta',
  traducir: 'Tradúcelo al inglés',
  escuchar: 'Escucha y escribe',
} as const;

/** Una tanda con los ejercicios del nivel en que vas, en orden mezclado. */
export default function Practicar() {
  const { listo, avisar } = useEstado();
  const router = useRouter();
  const { tema: id } = useParams<{ tema: string }>();
  const tema = temaPorId(id);
  if (!tema) notFound();

  const [sesion, setSesion] = useState<Sesion | null>(null);
  const [indice, setIndice] = useState(0);
  const [opciones, setOpciones] = useState<string[]>([]);
  const [elegida, setElegida] = useState<string | null>(null);
  const [aciertos, setAciertos] = useState(0);
  // Escribir y traducir: lo que se escribe, y qué se concluyó. `duda` espera a que
  // quien practica decida si la IA lo revisa; no cuenta hasta entonces.
  const [texto, setTexto] = useState('');
  const [veredicto, setVeredicto] = useState<Veredicto | null>(null);
  const [revisando, setRevisando] = useState(false);
  // Al fallar, la explicación espera a que quien practica la pida (#85).
  const [verExplicacion, setVerExplicacion] = useState(false);
  const [enLinea, setEnLinea] = useState(true);
  // Sube cuando se generan ejercicios nuevos, para armar la tanda otra vez.
  const [version, setVersion] = useState(0);

  // Hasta que la app esté lista no se toca localStorage: el servidor no lo tiene
  // y se desfasaría la hidratación. Los ejercicios son los escritos a mano más los
  // generados que hay en el teléfono; con señal se baja primero lo nuevo, pero sin
  // esperar más de unos segundos: practicar sin conexión tiene que funcionar.
  useEffect(() => {
    const poner = () => setEnLinea(navigator.onLine);
    poner();
    window.addEventListener('online', poner);
    window.addEventListener('offline', poner);
    return () => {
      window.removeEventListener('online', poner);
      window.removeEventListener('offline', poner);
    };
  }, []);

  // Que no siga sonando una frase al salir de la práctica.
  useEffect(() => () => audio.stop(), []);

  const idTema = tema.id;
  useEffect(() => {
    if (!listo) return;
    let vivo = true;
    (async () => {
      if (navigator.onLine) {
        await Promise.race([
          descargar(idTema).catch(() => 0),
          new Promise((ok) => setTimeout(ok, ESPERA_DESCARGA_MS)),
        ]);
      }
      const extra = await guardados(idTema).catch(() => []);
      if (!vivo) return;
      const t = temaPorId(idTema)!;
      const progreso = progresoTema(idTema);
      const delNivel = (n: number): Practica[] => [
        ...t.niveles[n - 1].ejercicios.map((e) => ({ ...e, tipo: 'elegir' as const })),
        // Los guardados llevan su tipo; los datos ya vienen saneados de la cuenta.
        ...extra.filter((g) => g.nivel === n).map((g) => ({ ...g.datos, tipo: g.tipo, id: g.id }) as Practica),
      ];
      // Se puede subir solo a un nivel que tenga ejercicios.
      const disponibles = t.niveles.reduce((hasta, _, i) => (delNivel(i + 1).length ? i + 1 : hasta), 0);
      const ejercicios = conDictados(shuffle(delNivel(progreso.nivel)).slice(0, POR_TANDA));
      setSesion({ tema: idTema, nivel: progreso.nivel, progreso, ejercicios, disponibles });
      setOpciones(ejercicios[0]?.tipo === 'elegir' ? opcionesDe(ejercicios[0]) : []);
    })();
    return () => {
      vivo = false;
    };
  }, [listo, idTema, version]);

  if (!listo || !sesion) return <section className="view" aria-busy="true" />;

  const { ejercicios, progreso } = sesion;
  if (!ejercicios.length) {
    return (
      <section className="view">
        <div className="block">
          <p className="eyebrow">Sin ejercicios</p>
          <h1 className="h1">Aún no hay ejercicios en este nivel</h1>
          <p className="muted">Se generan con la IA y necesitan conexión. Es una vez; después practicas sin señal.</p>
        </div>
        <div className="grow" />
        <MasEjercicios
          tema={tema.id}
          nivel={progreso.nivel}
          principal
          alTerminar={() => {
            setSesion(null);
            setVersion((v) => v + 1);
          }}
        />
        <Link href={`/temas/${tema.id}`} className="btn wide">
          Volver al tema
        </Link>
      </section>
    );
  }

  const e = ejercicios[indice];
  const terminada = indice >= ejercicios.length;

  if (terminada) {
    return (
      <section className="view">
        <div className="block">
          <p className="eyebrow">Tanda terminada</p>
          <h1 className="h1">
            {aciertos} de {ejercicios.length}
          </h1>
          <p className="muted">
            Aciertos seguidos: {progreso.racha} de {ACIERTOS_PARA_SUBIR} para subir.
          </p>
        </div>
        <div className="grow" />
        <Link href={`/temas/${tema.id}`} className="btn solid wide">
          Volver al tema
        </Link>
      </section>
    );
  }

  const eligiendo = e.tipo === 'elegir';
  // Elegir se resuelve al tocar una opción; escribir, cuando hay un veredicto de acierto o fallo.
  const respondida = eligiendo ? elegida !== null : veredicto !== null && veredicto.estado !== 'duda';
  const enDuda = !eligiendo && veredicto?.estado === 'duda';
  const resultado: { acierto: boolean; mensaje: string; alternativa?: string } | null =
    eligiendo && elegida !== null
      ? explicar(e, elegida)
      : veredicto && veredicto.estado !== 'duda'
        ? {
            acierto: veredicto.estado === 'acierto',
            mensaje: veredicto.mensaje,
            alternativa: veredicto.estado === 'acierto' ? veredicto.alternativa : undefined,
          }
        : null;

  /** Una respuesta con veredicto cuenta: suma a la racha o la reinicia, y puede subir de nivel. */
  const contar = (acierto: boolean) => {
    if (acierto) setAciertos((n) => n + 1);
    const { progreso: nuevo, subio } = registrar(progreso, acierto, sesion.disponibles);
    guardarProgresoTema(tema.id, nuevo);
    setSesion({ ...sesion, progreso: nuevo });
    if (subio) avisar(`Subiste al nivel ${nuevo.nivel}: ${tema.niveles[nuevo.nivel - 1].nombre}`);
  };

  /** Deja la pantalla lista para el ejercicio que ocupa `de`. */
  const preparar = (de: Practica | undefined) => {
    setElegida(null);
    setTexto('');
    setVeredicto(null);
    setRevisando(false);
    setVerExplicacion(false);
    setOpciones(de?.tipo === 'elegir' ? opcionesDe(de) : []);
  };

  const elegir = (opcion: string) => {
    if (e.tipo !== 'elegir' || respondida) return;
    setElegida(opcion);
    contar(explicar(e, opcion).acierto);
  };

  const comprobar = () => {
    if (e.tipo === 'elegir' || respondida || !texto.trim()) return;
    const v = e.tipo === 'escuchar' ? calificarDictado(e, texto) : calificarEscrito(e, texto);
    setVeredicto(v);
    if (v.estado !== 'duda') contar(v.estado === 'acierto');
  };

  // Solo si quien practica lo pide: cuesta un punto del tope diario y exige conexión.
  const revisarConIA = async () => {
    if (e.tipo === 'elegir') return;
    setRevisando(true);
    try {
      const r = await fetch('/api/temas/revisar', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          tema: tema.id,
          nivel: sesion.nivel,
          es: e.es,
          respuesta: texto,
          ...(e.tipo === 'escribir' ? { antes: e.antes, despues: e.despues } : {}),
        }),
      });
      const d = (await r.json()) as { acierto?: boolean; mensaje?: string; error?: string };
      if (!r.ok || typeof d.acierto !== 'boolean') {
        avisar(d.error ?? 'No se pudo revisar tu respuesta. Inténtalo de nuevo.');
        return;
      }
      setVeredicto(d.acierto ? { estado: 'acierto', mensaje: d.mensaje ?? '' } : { estado: 'fallo', mensaje: d.mensaje ?? '' });
      contar(d.acierto);
    } catch {
      avisar('No se pudo conectar. Comprueba tu señal e inténtalo de nuevo.');
    } finally {
      setRevisando(false);
    }
  };

  // Solo los generados tienen id: los escritos a mano no están en la cuenta.
  const quitarEste = async () => {
    const id = e.id;
    if (!id) return;
    const quitado = await quitar(id).catch(() => null);
    if (!quitado) return;
    // Sale de la tanda y pasa al siguiente. El indice no cambia: el siguiente ocupa su sitio.
    const restantes = ejercicios.filter((x) => x.id !== id);
    setSesion({ ...sesion, ejercicios: restantes });
    preparar(restantes[indice]);
    avisar('Ejercicio quitado', {
      etiqueta: 'Deshacer',
      alPulsar: async () => {
        await devolver(quitado).catch(() => {});
        setSesion((s) => (s ? { ...s, ejercicios: [...s.ejercicios.slice(0, indice), e, ...s.ejercicios.slice(indice)] } : s));
        preparar(e);
      },
    });
  };

  /** Dice la frase del dictado; «despacio» la baja de velocidad. */
  const oir = (despacio: boolean) => {
    if (e.tipo !== 'escuchar') return;
    audio.stop();
    void audio.say(fraseDictado(e), 'en', { rate: despacio ? 0.6 : 0.95 });
  };

  const siguiente = () => {
    audio.stop();
    setIndice(indice + 1);
    preparar(ejercicios[indice + 1]);
  };

  const claseHueco = resultado ? (resultado.acierto ? ' ok' : ' no') : '';

  return (
    <section className="view">
      <div className="topbar">
        <button className="back" onClick={() => router.push(`/temas/${tema.id}`)} aria-label="Salir de la práctica">
          ✕
        </button>
        <div className="tema-prog grow" aria-hidden="true">
          <i style={{ width: `${(indice / ejercicios.length) * 100}%`, background: 'var(--ink)' }} />
        </div>
        <span className="count">
          {indice + 1} / {ejercicios.length}
        </span>
      </div>

      <div className="note" style={{ '--note': '#FFE066' } as React.CSSProperties}>
        <span className="n-tag">{CONSIGNA[e.tipo]}</span>
        {e.tipo === 'escuchar' ? (
          <>
            {respondida && (
              <>
                <span className="en-dictado">{fraseDictado(e)}</span>
                <span className="es">{e.es}</span>
              </>
            )}
            <div className="oir">
              {!respondida && (
                <button className="play" onClick={() => oir(false)} aria-label="Escuchar la frase">
                  <IconPlay />
                </button>
              )}
              <button className="btn onnote sm" onClick={() => oir(respondida ? false : true)}>
                {respondida ? <IconAltavoz /> : <IconDespacio />}
                {respondida ? 'Otra vez' : 'Despacio'}
              </button>
            </div>
          </>
        ) : (
          <span className="es">{e.es}</span>
        )}
      </div>

      {e.tipo === 'traducir' || e.tipo === 'escuchar' ? (
        <div>
          <label className="tus" htmlFor="respuesta">
            {e.tipo === 'escuchar' ? 'Lo que oyes' : 'Tu respuesta'}
          </label>
          <textarea
            key={indice}
            id="respuesta"
            className={`area${claseHueco}${enDuda || revisando ? ' neutro' : ''}`}
            value={texto}
            onChange={(ev) => setTexto(ev.target.value)}
            readOnly={veredicto !== null}
            rows={3}
            placeholder={e.tipo === 'escuchar' ? 'Escribe la frase en inglés' : undefined}
            lang="en"
            autoCapitalize="sentences"
            autoCorrect="off"
            spellCheck={false}
            autoFocus
          />
        </div>
      ) : (
        <p className="tema-frase">
          {e.antes && `${e.antes} `}
          {e.tipo === 'escribir' ? (
            <input
              key={indice}
              className={`campo${claseHueco}${enDuda || revisando ? ' neutro' : ''}`}
              aria-label="La palabra que falta"
              value={texto}
              onChange={(ev) => setTexto(ev.target.value)}
              onKeyDown={(ev) => ev.key === 'Enter' && comprobar()}
              readOnly={veredicto !== null}
              lang="en"
              autoCapitalize="none"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              autoFocus
            />
          ) : (
            <span className={`hueco${claseHueco}`}>{respondida ? e.correcta : '   '}</span>
          )}{' '}
          {e.despues}
        </p>
      )}

      {eligiendo && (
        <div className="opts">
          {opciones.map((o) => {
            let clase = '';
            let marca = null;
            if (respondida) {
              if (o === e.correcta) {
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
              } else clase = ' off';
            }
            return (
              <button key={o} className={`opt${clase}`} onClick={() => elegir(o)} disabled={respondida}>
                <span className="lb">{o}</span>
                {marca}
              </button>
            );
          })}
        </div>
      )}

      <div className="grow" />

      {resultado ? (
        <div className="fb">
          {resultado.acierto ? (
            <div>
              <p className="ttl good">¡Bien!</p>
              <p className="sub">{resultado.mensaje}</p>
              {resultado.alternativa && <p className="sub">También vale: «{resultado.alternativa}».</p>}
            </div>
          ) : verExplicacion ? (
            <div className="expl">
              {/* En elegir la correcta ya está marcada en verde; escribiendo no se ve, así que va aquí. */}
              {e.tipo !== 'elegir' && (
                <>
                  <p className="lb">Una forma correcta</p>
                  <p className="corr">
                    {e.tipo === 'escribir' ? `${e.antes ? `${e.antes} ` : ''}${e.aceptadas[0]} ${e.despues ?? ''}`.trim() : e.aceptadas[0]}
                  </p>
                </>
              )}
              <p className="lb">Por qué</p>
              <p>{resultado.mensaje}</p>
            </div>
          ) : (
            <>
              <p className="ttl bad">Casi…</p>
              <button className="btn wide ver" onClick={() => setVerExplicacion(true)}>
                <IconBombilla />
                Ver explicación
              </button>
            </>
          )}
          <button className="btn solid wide" onClick={siguiente}>
            {indice + 1 < ejercicios.length ? 'Siguiente' : 'Ver resultado'}
          </button>
          {e.id && (
            <button className="quitar" onClick={quitarEste}>
              <IconPapelera />
              Quitar este ejercicio
            </button>
          )}
        </div>
      ) : revisando ? (
        <div className="fb" role="status">
          <p className="ttl">
            <span className="spin" aria-hidden="true" /> Revisando tu respuesta…
          </p>
          <p className="hint">Cuesta 1 punto de IA de tus 30 de hoy.</p>
        </div>
      ) : enDuda ? (
        <div className="fb">
          <div>
            <p className="ttl">No la reconozco</p>
            <p className="sub">{enLinea ? '¿Quieres que la IA la revise?' : 'Para que la IA la revise necesito conexión.'}</p>
          </div>
          <div className="dos">
            <button className="btn wide" onClick={siguiente}>
              Seguir
            </button>
            <button className="btn solid wide" onClick={revisarConIA} disabled={!enLinea}>
              Revisar con IA
            </button>
          </div>
          <p className="hint">Cuesta 1 punto de IA de tus 30 de hoy.</p>
        </div>
      ) : eligiendo ? (
        <p className="hint">Este ejercicio funciona sin conexión.</p>
      ) : (
        <div className="fb">
          <button className="btn solid wide" onClick={comprobar} disabled={!texto.trim()}>
            Comprobar
          </button>
          {e.tipo === 'escuchar' && (
            <button className="saltar" onClick={siguiente}>
              No puedo escuchar ahora
            </button>
          )}
          <p className="hint">Este ejercicio se califica sin conexión.</p>
        </div>
      )}
    </section>
  );
}
