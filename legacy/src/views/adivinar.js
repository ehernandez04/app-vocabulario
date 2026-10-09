import { esc, I, noteColor, sticker } from '../lib/ui.js';
import * as store from '../lib/store.js';

export function adivinar({ deck, state }) {
  const q = state.quiz;
  const w = q.word;
  const answered = q.picked !== null;
  const right = answered && q.picked === w.es;
  const audioOnly = store.get('audioOnly');
  const hideWord = audioOnly && !answered;

  return `<section class="view">
    <div class="topbar">
      <span class="h2">Adivinar</span>
      <span class="count">Aciertos ${state.hits}/${state.hits + state.miss}</span>
    </div>

    <button class="toggle" aria-pressed="${audioOnly}" data-act="audio-only">
      <span>Solo audio<span class="muted sm block">para ir caminando</span></span>
      <span class="knob"><i></i></span>
    </button>

    <div class="note quizcard" style="--note:${noteColor(deck, w)}">
      <div class="n-top">
        <div class="qleft">
          <span class="n-tag">¿Qué significa?</span>
          ${hideWord
            ? `<p class="es listen-cue">Escucha y adivina…</p>`
            : `<p class="en md">${esc(w.en)}</p><p class="ipa">${esc(w.ipa)}</p>`}
        </div>
        ${answered ? sticker(w) : ''}
        <button class="spk lg" data-act="say-en" aria-label="Escuchar la palabra">${I.spk}</button>
      </div>
    </div>

    <div class="opts">
      ${q.options.map((o, k) => {
        let cls = '', mark = '';
        if (answered) {
          if (o === w.es) { cls = ' good'; mark = `<span class="mk">${I.tick}</span>`; }
          else if (o === q.picked) { cls = ' bad'; mark = `<span class="mk">${I.cross}</span>`; }
          else cls = ' off';
        }
        return `<button class="opt${cls}" data-act="pick" data-o="${esc(o)}"${answered ? ' disabled' : ''}>
          <span class="key">${'ABCD'[k]}</span><span class="lb">${esc(o)}</span>${mark}</button>`;
      }).join('')}
    </div>

    <div class="grow"></div>

    ${answered
      ? `<div class="fb">
          <div>
            <p class="ttl ${right ? 'good' : 'bad'}">${right ? '¡Correcto!' : 'Casi…'}</p>
            <p class="sub">${right
              ? `${esc(w.en)} = ${esc(w.es)}`
              : `La respuesta era «${esc(w.es)}»`}</p>
          </div>
          <button class="btn solid wide" data-act="next-q">Siguiente palabra</button>
         </div>`
      : `<p class="hint">Toca una opción · o usa las teclas A B C D</p>`}
  </section>`;
}
