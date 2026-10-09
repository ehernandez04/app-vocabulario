import { esc, I, noteColor, sticker } from '../lib/ui.js';
import * as store from '../lib/store.js';

const LABELS = {
  idle: 'Pulsa play para empezar',
  en: 'Escucha…',
  think: 'Piensa la respuesta',
  es: 'Respuesta',
  ex: 'En contexto'
};

const STEPS = [['en', '1', 'Inglés'], ['think', '2', 'Piensas'], ['es', '3', 'Español']];

export function camino({ deck, state }) {
  const c = state.cam;
  const w = deck[c.i];
  const pause = store.get('pause');
  const withEx = store.get('withEx');
  const showEs = c.phase === 'es' || c.phase === 'ex';

  return `<section class="view camino ${c.on ? 'playing' : ''}">
    <div class="topbar">
      <span class="h2">Modo camino</span>
      <span class="count">${c.i + 1} de ${deck.length}</span>
    </div>
    <p class="muted">Ponte los auriculares y guarda el teléfono: oyes la palabra en inglés,
      piensas, y luego llega la respuesta en español.</p>

    <div class="note roadcard" style="--note:${noteColor(deck, w)}">
      <div class="n-top">
        <span class="n-tag">${LABELS[c.phase] || LABELS.idle}</span>
        ${sticker(w, 'sm')}
      </div>
      <p class="en md">${esc(w.en)}</p>
      <p class="es ${showEs ? '' : 'veiled'}">${showEs ? esc(w.es) : '¿ … ?'}</p>
    </div>

    <div class="steps">
      ${STEPS.map(([k, n, l]) =>
        `<div class="step${c.phase === k ? ' on' : ''}"><b>${n}</b><span>${l}</span></div>`).join('')}
    </div>

    <div class="grow"></div>

    <div class="transport">
      <button class="tbtn" data-act="cam-replay" aria-label="Repetir palabra">${I.back}</button>
      <span class="bigwrap">
        <span class="halo"></span>
        <button class="big" data-act="cam-toggle" aria-label="${c.on ? 'Pausar' : 'Reproducir'}">
          ${c.phase === 'think' && c.left > 0
            ? `<span class="tick">${c.left}</span>`
            : (c.on ? I.pause : I.play)}
        </button>
      </span>
      <button class="tbtn" data-act="cam-skip" aria-label="Siguiente palabra">${I.fwd}</button>
    </div>

    <div class="block">
      <p class="eyebrow">Tiempo para pensar</p>
      <div class="pauses">
        ${[3, 5, 8].map(s =>
          `<button class="pill${pause === s ? ' on' : ''}" data-act="cam-pause" data-s="${s}">${s} s</button>`).join('')}
      </div>
      <button class="toggle onroad" aria-pressed="${withEx}" data-act="cam-ex">
        <span>Oír también la frase de ejemplo</span>
        <span class="knob"><i></i></span>
      </button>
    </div>
  </section>`;
}
