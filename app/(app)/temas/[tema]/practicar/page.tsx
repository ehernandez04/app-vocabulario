'use client';

import Link from 'next/link';
import { notFound, useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { IconCruz, IconTick } from '@/components/icons';
import { shuffle } from '@/lib/srs';
import {
  cargarProgreso,
  explicar,
  guardarProgreso,
  nivelesDisponibles,
  opcionesDe,
  registrar,
  temaPorId,
  ACIERTOS_PARA_SUBIR,
  type Ejercicio,
  type Progreso,
} from '@/lib/temas';
import { useEstado } from '../../../../estado';

type Sesion = { tema: string; progreso: Progreso; ejercicios: Ejercicio[] };

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

  // Hasta que la app esté lista no se toca localStorage: el servidor no lo tiene
  // y se desfasaría la hidratación. Ajustar el estado durante el render es el
  // patrón que React recomienda para armar la primera tanda.
  if (listo && !sesion) {
    const progreso = cargarProgreso(tema.id);
    const ejercicios = shuffle(tema.niveles[progreso.nivel - 1].ejercicios);
    setSesion({ tema: tema.id, progreso, ejercicios });
    setOpciones(ejercicios[0] ? opcionesDe(ejercicios[0]) : []);
  }
  if (!listo || !sesion) return <section className="view" aria-busy="true" />;

  const { ejercicios, progreso } = sesion;
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

  const respondida = elegida !== null;
  const resultado = respondida ? explicar(e, elegida) : null;

  const elegir = (opcion: string) => {
    if (respondida) return;
    setElegida(opcion);
    const r = explicar(e, opcion);
    if (r.acierto) setAciertos((n) => n + 1);
    const { progreso: nuevo, subio } = registrar(progreso, r.acierto, nivelesDisponibles(tema));
    guardarProgreso(tema.id, nuevo);
    setSesion({ ...sesion, progreso: nuevo });
    if (subio) avisar(`Subiste al nivel ${nuevo.nivel}: ${tema.niveles[nuevo.nivel - 1].nombre}`);
  };

  const siguiente = () => {
    const nuevo = indice + 1;
    setIndice(nuevo);
    setElegida(null);
    if (ejercicios[nuevo]) setOpciones(opcionesDe(ejercicios[nuevo]));
  };

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
        <span className="n-tag">Elige la forma correcta</span>
        <span className="es">{e.es}</span>
      </div>

      <p className="tema-frase">
        {e.antes && `${e.antes} `}
        <span className={`hueco${resultado ? (resultado.acierto ? ' ok' : ' no') : ''}`}>
          {respondida ? e.correcta : '   '}
        </span>{' '}
        {e.despues}
      </p>

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

      <div className="grow" />

      {resultado ? (
        <div className="fb">
          <div>
            <p className={`ttl ${resultado.acierto ? 'good' : 'bad'}`}>{resultado.acierto ? '¡Bien!' : 'Casi…'}</p>
            <p className="sub">{resultado.mensaje}</p>
          </div>
          <button className="btn solid wide" onClick={siguiente}>
            {indice + 1 < ejercicios.length ? 'Siguiente' : 'Ver resultado'}
          </button>
        </div>
      ) : (
        <p className="hint">Este ejercicio funciona sin conexión.</p>
      )}
    </section>
  );
}
