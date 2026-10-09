'use client';

import { useState } from 'react';

/**
 * Pantalla provisional de la etapa 0: no es la app, es la prueba de que el
 * stack nuevo arranca y de que la identidad visual sobrevivió al port.
 * Se reemplaza por la vista Inicio en la etapa 1 (#22).
 */
export default function Page() {
  const [oscuro, setOscuro] = useState(false);

  function cambiarTema() {
    const siguiente = !oscuro;
    setOscuro(siguiente);
    document.documentElement.dataset.skin = siguiente ? 'dark' : 'light';
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-[460px] flex-col gap-6 px-5 py-8">
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold tracking-[0.14em] text-ink-faint uppercase">Etapa 0</p>
          <h1 className="font-display text-3xl leading-tight tracking-[-0.03em]">
            Vocabulario en Ruta
          </h1>
          <p className="mt-1 text-sm text-ink-soft">
            Next 16 + Tailwind 4, con los tokens de siempre.
          </p>
        </div>
        <button
          onClick={cambiarTema}
          className="shrink-0 rounded-full border-2 border-edge bg-card px-3 py-2 text-sm font-medium shadow-lift transition-transform active:translate-y-[2px] active:shadow-none"
          aria-pressed={oscuro}
        >
          {oscuro ? 'Claro' : 'Oscuro'}
        </button>
      </header>

      {/* El post-it es un objeto físico: papel de color con tinta oscura, en los
          dos temas. Solo cambia el entorno. */}
      <article className="relative rounded-2xl border-2 border-edge bg-note-3 p-5 text-on-note shadow-drop">
        <p className="text-[11px] font-bold tracking-[0.14em] uppercase opacity-70">
          Inglés · caja 1
        </p>
        <h2 className="font-display mt-2 text-4xl leading-none tracking-[-0.04em]">the way</h2>
        <p className="mt-1 text-sm opacity-70">/ðə weɪ/</p>

        <div className="mt-4 flex items-center gap-4">
          <span className="grid size-[72px] shrink-0 -rotate-3 place-items-center rounded-2xl border-2 border-dashed border-on-note/30 bg-white/55 text-[42px]">
            🛣️
          </span>
          <p className="text-[0.95rem] italic">I listen to podcasts on the way to work.</p>
        </div>

        <hr className="my-4 border-0 border-t-2 border-dashed border-on-note/25" />

        <p className="text-[11px] font-bold tracking-[0.14em] uppercase opacity-70">Español</p>
        <p className="font-hand mt-1 text-4xl leading-none">el camino</p>
        <p className="mt-1 text-sm">Escucho pódcasts de camino al trabajo.</p>
      </article>

      <section className="flex flex-col gap-3">
        <p className="text-xs font-bold tracking-[0.14em] text-ink-faint uppercase">
          Los cuatro papeles
        </p>
        <div className="flex gap-3">
          {['bg-note-1', 'bg-note-2', 'bg-note-3', 'bg-note-4'].map((color) => (
            <span
              key={color}
              className={`h-12 flex-1 rounded-xl border-2 border-edge ${color} shadow-lift`}
            />
          ))}
        </div>
      </section>

      <p className="mt-auto text-sm text-ink-soft">
        La app que ya funciona sigue en <code className="font-mono">legacy/</code> y se corre con{' '}
        <code className="font-mono">npm run legacy:dev</code>. Se retira cuando esta alcance
        paridad (#26).
      </p>
    </main>
  );
}
