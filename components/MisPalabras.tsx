'use client';

import * as store from '@/lib/local-store';

/** La lista de tus palabras en la pantalla de Inicio. */
export function MisPalabras({ alBorrar }: { alBorrar: (en: string) => void }) {
  const mias = store.userWords();
  if (!mias.length) return null;

  return (
    <div className="block">
      <p className="eyebrow">Tus palabras · {mias.length}</p>
      <ul className="mywords">
        {mias.map((w) => (
          <li key={w.en}>
            <span className="mw-emoji">{w.emoji || '📝'}</span>
            <span className="mw-txt">
              <b>{w.en}</b>
              <span>{w.es}</span>
            </span>
            <span className="mw-box">caja {store.progressOf(w.en).box}</span>
            <button
              className="xbtn sm"
              onClick={() => alBorrar(w.en)}
              aria-label={`Quitar ${w.en} del mazo`}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
