'use client';

import { useEffect, useRef } from 'react';

/**
 * La hoja que se desliza desde abajo. El armazón sirve para cualquier
 * formulario que venga después (la revisión por lote de la etapa 4 vive acá).
 */
export function Hoja({
  titulo,
  alCerrar,
  children,
}: {
  titulo: string;
  alCerrar: () => void;
  children: React.ReactNode;
}) {
  const cuerpo = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Al abrir, el foco va al primer campo; y Escape cierra, que en escritorio
    // es lo que uno intenta sin pensarlo.
    cuerpo.current?.querySelector<HTMLElement>('input, textarea')?.focus({ preventScroll: true });
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === 'Escape') alCerrar();
    };
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  }, [alCerrar]);

  return (
    <>
      <button className="scrim" onClick={alCerrar} aria-label="Cerrar" />
      <div className="sheet" role="dialog" aria-modal="true" aria-label={titulo}>
        <div className="grabber" />
        <div className="sheet-head">
          <h2 className="h2">{titulo}</h2>
          <button className="xbtn" onClick={alCerrar} aria-label="Cerrar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        <div className="sheet-body" ref={cuerpo}>
          {children}
        </div>
      </div>
    </>
  );
}
