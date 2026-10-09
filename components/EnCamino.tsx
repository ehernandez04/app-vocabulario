import Link from 'next/link';

/**
 * Página puente para las vistas que todavía no se portaron.
 *
 * Existe para que la URL estable no dé 404 mientras dura la etapa 1. Dice la
 * verdad sobre qué falta en vez de fingir una pantalla vacía: una vista que
 * parece rota y una que avisa se ven igual de incompletas, pero solo una de
 * las dos se entiende.
 */
export function EnCamino({
  titulo,
  descripcion,
  issue,
}: {
  titulo: string;
  descripcion: string;
  issue: number;
}) {
  return (
    <section className="view">
      <div className="block">
        <p className="eyebrow">En camino</p>
        <h1 className="h1">{titulo}</h1>
      </div>

      <div className="note" style={{ '--note': '#FFE066' } as React.CSSProperties}>
        <p style={{ margin: 0, color: 'var(--on-note)' }}>{descripcion}</p>
        <p style={{ marginBottom: 0, color: 'var(--note-soft)', fontSize: '.9rem' }}>
          Se está portando a la versión nueva (issue #{issue}). Hasta entonces esta pantalla
          queda así, para que el resto de la app funcione.
        </p>
      </div>

      <Link href="/" className="btn solid wide" style={{ textAlign: 'center' }}>
        Volver a Inicio
      </Link>
    </section>
  );
}
