'use client';

import { BloqueTemas } from '@/components/BloqueTemas';
import { BotonAjustes } from '@/components/BotonAjustes';
import { useEstado } from '../../estado';

/** La lista de temas (#76). Hoy hay uno; los siguientes se abrirán por orden, al terminar el anterior. */
export default function Temas() {
  const { listo } = useEstado();
  if (!listo) return <section className="view" aria-busy="true" />;

  return (
    <section className="view">
      <div className="topbar">
        <span className="h2">Temas</span>
        <span className="lado">
          <BotonAjustes />
        </span>
      </div>
      <p className="muted">Cada tema se aprende por niveles, de básico a avanzado. Los temas se abren por orden.</p>
      <BloqueTemas />
    </section>
  );
}
