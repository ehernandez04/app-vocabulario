'use client';

import { useEffect, useState } from 'react';
import { useEstado } from '@/app/estado';
import { descargar, guardados } from '@/lib/ejercicios-local';
import { plural } from '@/lib/ui';
import { temaPorId } from '@/lib/temas';

/** Lo que cuesta una tanda, en puntos del tope diario (ver `COSTE_EJERCICIOS`). */
const COSTE = 1;

/** Cuántos ejercicios hay de un nivel: los escritos a mano más los guardados. */
export async function contarEjercicios(idTema: string, nivel: number): Promise<number> {
  const tema = temaPorId(idTema);
  const aMano = tema?.niveles[nivel - 1]?.ejercicios.length ?? 0;
  const extra = await guardados(idTema).catch(() => []);
  return aMano + extra.filter((g) => g.nivel === nivel).length;
}

type Props = {
  tema: string;
  nivel: number;
  /** `principal` es el botón grande de la pantalla de un nivel sin ejercicios. */
  principal?: boolean;
  /** Se llama cuando ya se guardaron los nuevos, para que la vista recargue. */
  alTerminar?: (nuevos: number) => void;
};

/**
 * El botón «Más ejercicios» (#71): pide a la IA otra tanda del nivel en que estás.
 * Cuesta un punto del tope diario y necesita conexión, y dice cuándo no se puede.
 */
export function MasEjercicios({ tema, nivel, principal, alTerminar }: Props) {
  const { avisar } = useEstado();
  const [tienes, setTienes] = useState<number | null>(null);
  const [restantes, setRestantes] = useState<number | null>(null);
  const [generando, setGenerando] = useState(false);
  const [enLinea, setEnLinea] = useState(true);

  useEffect(() => {
    let vivo = true;
    contarEjercicios(tema, nivel).then((n) => vivo && setTienes(n));
    // Los puntos y la conexión se leen una vez montado: el servidor no sabe ninguno.
    const poner = () => setEnLinea(navigator.onLine);
    poner();
    window.addEventListener('online', poner);
    window.addEventListener('offline', poner);
    fetch('/api/temas/generar')
      .then((r) => (r.ok ? (r.json() as Promise<{ restantes: number }>) : null))
      .then((d) => d && vivo && setRestantes(d.restantes))
      .catch(() => {}); // sin señal: el botón ya avisa de que hace falta
    return () => {
      vivo = false;
      window.removeEventListener('online', poner);
      window.removeEventListener('offline', poner);
    };
  }, [tema, nivel]);

  const sinPuntos = restantes !== null && restantes < COSTE;
  const motivo = !enLinea ? 'Necesita conexión' : sinPuntos ? 'Hoy usaste tus 30 puntos de IA. Mañana vuelves a tener.' : null;

  const generar = async () => {
    setGenerando(true);
    try {
      const r = await fetch('/api/temas/generar', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ tema, nivel }),
      });
      const datos = (await r.json()) as { generados?: number; restantes?: number; error?: string };
      if (typeof datos.restantes === 'number') setRestantes(datos.restantes);
      if (!r.ok) {
        avisar(datos.error ?? 'No se pudieron generar ejercicios. Inténtalo de nuevo.');
        return;
      }
      await descargar(tema).catch(() => 0);
      setTienes(await contarEjercicios(tema, nivel));
      avisar(`Se ${datos.generados === 1 ? 'añadió' : 'añadieron'} ${plural(datos.generados ?? 0, 'ejercicio')} al nivel ${nivel}`);
      alTerminar?.(datos.generados ?? 0);
    } catch {
      avisar('No se pudo conectar. Comprueba tu señal e inténtalo de nuevo.');
    } finally {
      setGenerando(false);
    }
  };

  const puntos = restantes === null ? null : `Hoy te quedan ${restantes} de 30 puntos de IA`;

  return (
    <div className="mas">
      <button
        className={`btn${principal ? ' solid' : ''}`}
        onClick={generar}
        disabled={generando || !!motivo}
      >
        {generando ? (
          <>
            <span className="spin" aria-hidden="true" /> Generando…
          </>
        ) : principal ? (
          'Generar ejercicios'
        ) : (
          '＋ Más ejercicios de este nivel'
        )}
      </button>
      {generando && (
        <>
          <div className="mas-bar" aria-hidden="true">
            <i />
          </div>
          <p className="mas-sub" role="status">
            Tarda unos 40 segundos.{principal ? '' : ' Puedes seguir practicando.'}
          </p>
        </>
      )}
      {!generando && motivo && <p className="mas-sub no">{motivo}</p>}
      {!generando && !motivo && (
        <p className="mas-sub">
          {!principal && tienes !== null ? `Tienes ${tienes} · ` : ''}
          {puntos ?? ''}
        </p>
      )}
    </div>
  );
}
