'use client';

import { useEstado } from '@/app/estado';

/** El aviso emergente. Vive en el armazón para que sobreviva al cambio de vista. */
export function Toast() {
  const { aviso } = useEstado();
  return (
    <div className={`toast${aviso ? ' show' : ''}`} role="status" aria-live="polite">
      <span>{aviso?.texto}</span>
      {aviso?.accion && (
        <button className="toast-accion" onClick={aviso.accion.alPulsar}>
          {aviso.accion.etiqueta}
        </button>
      )}
    </div>
  );
}
