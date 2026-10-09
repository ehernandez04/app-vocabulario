import { esc, I, peekColor, noteColor, sticker } from '../lib/ui.js';
import { isDue } from '../lib/srs.js';
import * as store from '../lib/store.js';
import { voices, currentVoice } from '../lib/audio.js';
import { misPalabras } from './sheet.js';

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
}

export function inicio({ deck, state }) {
  const due = deck.filter(w => isDue(store.progressOf(w.en))).length;
  const total = deck.length;
  const al_dia = total - due;
  const pct = Math.round(al_dia / total * 100);
  const C = 2 * Math.PI * 19;

  const next = state.queue[state.qi] || deck[0];
  const counts = store.boxCounts(deck);
  const max = Math.max(...counts, 1);
  const dark = store.get('theme') === 'dark';

  const voiceRow = (lang, list, label) => {
    const cur = currentVoice(lang);
    return `<label class="vrow">
      <span>${label}</span>
      <select class="sel" data-voice="${lang}">
        ${list.length
          ? list.map(v => `<option value="${esc(v.name)}"${cur && v.name === cur.name ? ' selected' : ''}>${esc(v.name)} · ${esc(v.lang)}</option>`).join('')
          : `<option>Sin voces disponibles</option>`}
      </select>
    </label>`;
  };

  return `<section class="view">
    <div class="hello">
      <div>
        <p class="eyebrow">${greeting()}</p>
        <h1 class="h1">${!due ? 'Todo<br>al día'
          : due === 1 ? '1 palabra<br>te espera'
          : `${due} palabras<br>te esperan`}</h1>
      </div>
      <div class="hello-side">
        <span class="streak"><span class="flame">🔥</span> ${store.get('streak')}</span>
        <button class="themebtn" data-act="theme" aria-label="Cambiar entre tema claro y oscuro">
          ${dark ? I.sun : I.moon}
        </button>
      </div>
    </div>

    <div class="today">
      <div class="ring">
        <svg width="62" height="62" viewBox="0 0 44 44" aria-hidden="true">
          <circle cx="22" cy="22" r="19" fill="none" stroke="var(--rule)" stroke-width="4"/>
          <circle cx="22" cy="22" r="19" fill="none" stroke="var(--ink)" stroke-width="4"
            stroke-linecap="round" stroke-dasharray="${C.toFixed(1)}"
            stroke-dashoffset="${(C * (1 - pct / 100)).toFixed(1)}"/>
        </svg>
        <span class="val">${pct}%</span>
      </div>
      <div class="txt">
        <b>${al_dia} de ${total} al día</b>
        <span class="muted">${!due ? 'Vuelve mañana por las siguientes'
          : due === 1 ? 'Te falta 1 por repasar'
          : `Te faltan ${due} por repasar`}</span>
      </div>
    </div>

    <button class="stack" data-go="tarjetas" aria-label="Practicar la siguiente palabra: ${esc(next.en)}">
      <div class="lay b2"><div class="flat" style="background:${peekColor(deck, next, 2)}"></div></div>
      <div class="lay b1"><div class="flat" style="background:${peekColor(deck, next, 1)}"></div></div>
      <div class="lay top">
        <div class="note" style="--note:${noteColor(deck, next)}">
          <div class="n-top">
            <span class="n-tag">Siguiente palabra</span>
            ${sticker(next, 'sm')}
          </div>
          <span class="en sm">${esc(next.en)}</span>
          <span class="hand">toca para practicar →</span>
        </div>
      </div>
    </button>

    <div class="block">
      <p class="eyebrow">Cómo quieres repasar</p>
      <div class="modes">
        <button class="mode" data-go="tarjetas">
          <span class="ic" style="background:#FFE066">${I.cards}</span>
          <span class="lab"><b>Tarjetas</b><span>Ver, escuchar y dar la vuelta</span></span>
          <span class="arr">${I.arr}</span>
        </button>
        <button class="mode" data-go="adivinar">
          <span class="ic" style="background:#FFB4A2">${I.quiz}</span>
          <span class="lab"><b>Adivinar</b><span>Elige la traducción correcta</span></span>
          <span class="arr">${I.arr}</span>
        </button>
        <button class="mode dark" data-go="camino">
          <span class="ic" style="background:#FFE066">${I.head}</span>
          <span class="lab"><b>Modo camino</b><span>Manos libres, solo audio</span></span>
          <span class="arr">${I.arr}</span>
        </button>
      </div>
    </div>

    <div class="block">
      <p class="eyebrow">Tus cinco cajas de repaso</p>
      <div class="boxes">
        ${counts.map((n, i) => `<div class="bx">
          <div class="col"><i style="height:${n ? Math.max(14, n / max * 100) : 0}%;background:${['#FFE066','#FFB4A2','#B8E1FF','#C8F0A8','#FFE066'][i]}"></i></div>
          <span class="n">${n}</span><span class="l">caja ${i + 1}</span>
        </div>`).join('')}
      </div>
      <p class="muted sm">Cada acierto sube la palabra una caja: 1, 2, 4, 8 y 16 días.</p>
    </div>

    <div class="block">
      <p class="eyebrow">Voz</p>
      <div class="voicebox">
        ${voiceRow('en', voices.en, 'Inglés')}
        ${voiceRow('es', voices.es, 'Español')}
        <button class="btn" data-act="test-voice">${I.spk} Probar esta voz</button>
        <p class="muted sm">Las mejores suelen llamarse <b>Google</b>, <b>Siri</b>, <b>Enhanced</b>
          o <b>Premium</b>. Si tu lista se ve pobre, en iPhone y Mac se descargan voces de mucha
          mejor calidad en <b>Ajustes → Accesibilidad → Contenido hablado → Voces</b>.</p>
      </div>
    </div>

    <div class="block">
      <p class="eyebrow">Mi mazo · ${total} palabras</p>
      <button class="btn solid wide" data-act="sheet-nueva">＋ Agregar una palabra</button>
      <div class="chips">
        <button class="pill" data-act="export">Exportar</button>
        <button class="pill" data-act="sheet-importar">Importar</button>
      </div>
    </div>

    ${misPalabras()}
  </section>`;
}
