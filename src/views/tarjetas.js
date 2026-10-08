import { esc, I, noteColor, peekColor, sticker } from '../lib/ui.js';
import * as store from '../lib/store.js';

export function tarjetas({ deck, state }) {
  const { queue, qi, revealed } = state;

  if (qi >= queue.length) {
    return `<section class="view">
      <div class="topbar"><span class="h2">Tarjetas</span>
        <span class="count">${queue.length}/${queue.length}</span></div>
      <div class="done-card">
        <span class="big-n">${state.hits}</span>
        <p class="h2">¡Sesión terminada!</p>
        <p class="muted">Acertaste ${state.hits} de ${queue.length}.
          ${state.miss ? `${state.miss} vuelven mañana.` : 'Ni una falla.'}</p>
        <button class="btn solid" data-act="restart">Otra ronda</button>
      </div>
    </section>`;
  }

  const w = queue[qi];
  const p = store.progressOf(w.en);
  const pct = Math.round(qi / queue.length * 100);

  return `<section class="view">
    <div class="topbar">
      <span class="h2">Tarjetas</span>
      <span class="count">${qi + 1} / ${queue.length}</span>
    </div>
    <div class="bar"><i style="width:${pct}%"></i></div>

    <div class="deckarea">
      <div class="peek p2" style="background:${peekColor(deck, w, 2)}"></div>
      <div class="peek p1" style="background:${peekColor(deck, w, 1)}"></div>
      <div id="live" class="dealt">
        <div class="note" style="--note:${noteColor(deck, w)}">
          <span class="swipetag l">Otra vez</span>
          <span class="swipetag r">¡Lo sabía!</span>

          <div class="n-top">
            <span class="n-tag">Inglés · caja ${p.box}</span>
            <button class="spk" data-act="say-en" aria-label="Escuchar en inglés">${I.spk}</button>
          </div>

          <p class="en">${esc(w.en)}</p>
          <p class="ipa">${esc(w.ipa)}</p>

          <div class="exrow">
            ${sticker(w)}
            <button class="example" data-act="say-ex">
              ${I.quote}<span>${esc(w.xe)}</span>
            </button>
          </div>

          ${revealed ? `
            <hr class="rip">
            <div class="reveal revealed">
              <div class="n-top">
                <span class="n-tag">Español</span>
                <button class="spk sm" data-act="say-es" aria-label="Escuchar en español">${I.spk}</button>
              </div>
              <p class="es">${esc(w.es)}</p>
              <p class="xs">${esc(w.xs)}</p>
            </div>`
          : `<div class="spacer">
              <button class="btn onnote wide" data-act="reveal">Ver traducción</button>
             </div>`}
        </div>
      </div>
    </div>

    ${revealed
      ? `<div class="row2">
          <button class="btn" data-act="grade" data-k="0">Otra vez</button>
          <button class="btn solid" data-act="grade" data-k="1">Lo sabía</button>
         </div>
         <p class="hint">O arrastra la tarjeta: ← otra vez · lo sabía →</p>`
      : `<button class="btn wide" data-act="slow">${I.slow} Despacio</button>
         <p class="hint">Piénsalo en español antes de descubrirla</p>`}
  </section>`;
}
