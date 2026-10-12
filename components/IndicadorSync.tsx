'use client';

import { useEffect, useState } from 'react';
import { useEstado, type FaseSync } from '@/app/estado';
import { plural } from '@/lib/ui';

/**
 * El estado de la sincronización, en dos tamaños: la insignia pegada al avatar
 * y la fila de Ajustes con el detalle en palabras.
 *
 * Solo informa. Sin conexión es el modo normal en el metro, así que se ve
 * neutro —gris, sin rojo ni aviso— y lo que hagas queda guardado.
 */

function Icono({ fase }: { fase: FaseSync }) {
  const trazo = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className={fase === 'subiendo' ? 'girando' : undefined}>
      {fase === 'dia' && (
        <>
          <circle cx="8" cy="8" r="7" fill="currentColor" />
          <path d="M4.8 8.2l2.2 2.2 4.2-4.6" {...trazo} stroke="var(--ins-fondo)" />
        </>
      )}
      {fase === 'subiendo' && (
        <>
          <path d="M13 8a5 5 0 1 1-1.6-3.7" {...trazo} strokeWidth={2} />
          <path d="M13.2 2.4v3h-3" {...trazo} strokeWidth={2} />
        </>
      )}
      {fase === 'sin-conexion' && (
        <>
          <circle cx="8" cy="8" r="7" fill="currentColor" />
          <path d="M5 8h6" {...trazo} stroke="var(--ins-fondo)" />
        </>
      )}
      {(fase === 'pendiente' || fase === 'fallo') && (
        <>
          <circle cx="8" cy="8" r="7" fill="currentColor" />
          <circle cx="8" cy="8" r="2.4" fill="var(--ins-fondo)" />
        </>
      )}
    </svg>
  );
}

const ROTULO: Record<FaseSync, string> = {
  dia: 'Sincronizado',
  pendiente: 'Cambios guardados, pendientes de subir',
  subiendo: 'Sincronizando',
  'sin-conexion': 'Sin conexión: lo que hagas se guarda',
  fallo: 'No se pudo sincronizar',
};

export function InsigniaSync() {
  const { sync } = useEstado();
  return (
    <span className={`ins ${sync.fase}`} role="status" aria-label={ROTULO[sync.fase]}>
      <Icono fase={sync.fase} />
    </span>
  );
}

function hace(ms: number): string {
  const min = Math.floor(ms / 60000);
  if (min < 1) return 'hace un momento';
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  return h < 24 ? `hace ${h} h` : 'hace más de un día';
}

export function FilaSync() {
  const { sync, sincronizarAhora } = useEstado();
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setAhora(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  const { fase, pendientes, ultima } = sync;
  const guardados = pendientes
    ? plural(pendientes, 'cambio guardado', 'cambios guardados')
    : null;
  const subira = pendientes === 1 ? 'subirá' : 'subirán';

  const [titulo, detalle] =
    fase === 'dia'
      ? ['Al día', ultima ? `Última vez ${hace(ahora - ultima)}` : 'Tu mazo y tu avance están en tu cuenta']
      : fase === 'subiendo'
        ? ['Sincronizando…', guardados ?? 'Un momento']
        : fase === 'sin-conexion'
          ? ['Sin conexión', guardados ? `${guardados}; ${subira} solo${pendientes === 1 ? '' : 's'}` : 'Lo que hagas se guardará y subirá solo']
          : fase === 'fallo'
            ? ['No se pudo sincronizar', `Se reintentará solo${guardados ? ` · ${guardados}` : ''}`]
            : ['Por subir', `${guardados} · ${subira} en unos segundos`];

  return (
    <div className={`filasync ${fase}`}>
      <span className="filasync-ico">
        <Icono fase={fase} />
      </span>
      <span className="filasync-txt">
        <b>{titulo}</b>
        <span>{detalle}</span>
      </span>
      {fase !== 'sin-conexion' && fase !== 'subiendo' && (
        <button className="pill" onClick={() => void sincronizarAhora()}>
          {fase === 'fallo' ? 'Reintentar' : 'Ahora'}
        </button>
      )}
    </div>
  );
}
