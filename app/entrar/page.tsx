import { redirect } from 'next/navigation';
import { auth, signIn } from '@/auth';
import { Sticker } from '@/components/Sticker';
import BASE from '@/data/deck.json';
import type { Word } from '@/lib/srs';

/**
 * La puerta de entrada. Lo primero que se ve es el mazo, para que quien llegue
 * entienda de qué va antes de que le pidan nada.
 */
export default async function Entrar() {
  if (await auth()) redirect('/');
  const muestra = (BASE as Word[])[0];

  return (
    <section className="view entrada">
      <div className="block">
        <p className="eyebrow">Paso a Paso</p>
        <h1 className="h1">
          Inglés
          <br />
          en el camino
        </h1>
        <p className="muted">
          Tarjetas con audio, modo adivinar y manos libres. Entra con tu cuenta y tu avance te
          sigue a cualquier teléfono.
        </p>
      </div>

      <div className="entrada-mazo" aria-hidden="true">
        <div className="lay b2">
          <div className="flat" style={{ background: '#C9B5FF' }} />
        </div>
        <div className="lay b1">
          <div className="flat" style={{ background: '#FF8FC5' }} />
        </div>
        <div className="lay top">
          <div className="note" style={{ '--note': '#B6FF5C' } as React.CSSProperties}>
            <div className="n-top">
              <span className="n-tag">Inglés · caja 1</span>
              <Sticker word={muestra} size="sm" />
            </div>
            <span className="en sm">{muestra.en}</span>
            <span className="hand">{muestra.es}</span>
          </div>
        </div>
      </div>

      <form
        action={async () => {
          'use server';
          await signIn('google', { redirectTo: '/' });
        }}
      >
        <button type="submit" className="btn google wide">
          <svg viewBox="0 0 48 48" width="20" height="20" aria-hidden="true">
            <path
              fill="#4285F4"
              d="M45.1 24.5c0-1.6-.1-3.2-.4-4.7H24v8.9h11.8c-.5 2.8-2 5.1-4.4 6.7v5.6h7.1c4.2-3.8 6.6-9.5 6.6-16.5z"
            />
            <path
              fill="#34A853"
              d="M24 46c6 0 11-2 14.6-5.4l-7.1-5.6c-2 1.3-4.5 2.1-7.5 2.1-5.8 0-10.6-3.9-12.4-9.1H4.3v5.8C7.9 41.1 15.4 46 24 46z"
            />
            <path
              fill="#FBBC05"
              d="M11.6 28c-.5-1.3-.7-2.7-.7-4s.3-2.7.7-4v-5.8H4.3C2.8 17.1 2 20.4 2 24s.8 6.9 2.3 9.8l7.3-5.8z"
            />
            <path
              fill="#EA4335"
              d="M24 10.6c3.3 0 6.2 1.1 8.5 3.3l6.3-6.3C35 4.1 30 2 24 2 15.4 2 7.9 6.9 4.3 14.2l7.3 5.8c1.8-5.2 6.6-9.4 12.4-9.4z"
            />
          </svg>
          Entrar con Google
        </button>
      </form>

      <p className="muted sm center">
        Solo entran los correos autorizados. Si el tuyo no está, pídele a Erick que lo agregue.
      </p>
    </section>
  );
}
