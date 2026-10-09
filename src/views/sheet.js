import { esc } from '../lib/ui.js';
import * as store from '../lib/store.js';

/** Emojis que cubren la mayoría de lo que uno apunta en la calle. */
export const EMOJIS = ['📝','🛣️','🏆','💡','⏰','💰','🤝','🔔','🚆','🧩','🌊','😬','⚡','🎯',
                       '🛡️','⏳','🧗','🙋','☔','⏱️','🔀','🍽️','🏠','💬','❤️','🔧','📈','🧠'];

/**
 * La hoja que se desliza desde abajo. Hoy solo sirve para agregar palabras,
 * pero el armazón vale para cualquier formulario que venga después.
 */
export function sheet({ state }) {
  if (!state.sheet) return '';
  if (state.sheet === 'nueva') return nueva(state);
  if (state.sheet === 'importar') return importar(state);
  return '';
}

function nueva(state) {
  const f = state.form || {};
  const err = state.formError;
  return wrap('Nueva palabra', `
    <form class="form" id="form-nueva" novalidate>
      ${err ? `<p class="formerr">${esc(err)}</p>` : ''}

      <label class="field">
        <span>Inglés <b class="req">obligatorio</b></span>
        <input id="f-en" name="en" type="text" autocomplete="off" autocapitalize="none"
          spellcheck="false" placeholder="to look forward to" value="${esc(f.en || '')}" required>
      </label>

      <label class="field">
        <span>Español <b class="req">obligatorio</b></span>
        <input id="f-es" name="es" type="text" autocomplete="off"
          placeholder="tener ganas de" value="${esc(f.es || '')}" required>
      </label>

      <fieldset class="field emojis">
        <legend>Ilustración</legend>
        <div class="emojigrid">
          ${EMOJIS.map(e => `<button type="button" class="emojibtn${(f.emoji || '📝') === e ? ' on' : ''}"
            data-act="pick-emoji" data-e="${e}" aria-pressed="${(f.emoji || '📝') === e}">${e}</button>`).join('')}
        </div>
      </fieldset>

      <details class="more"${f.ipa || f.xe || f.xs ? ' open' : ''}>
        <summary>Añadir fonética y un ejemplo <span class="opt-tag">opcional</span></summary>

        <label class="field">
          <span>Fonética</span>
          <input id="f-ipa" name="ipa" type="text" autocomplete="off" spellcheck="false"
            placeholder="/lʊk ˈfɔːrwərd/" value="${esc(f.ipa || '')}">
        </label>

        <label class="field">
          <span>Frase en inglés</span>
          <input id="f-xe" name="xe" type="text" autocomplete="off"
            placeholder="I look forward to the weekend." value="${esc(f.xe || '')}">
        </label>

        <label class="field">
          <span>Su traducción</span>
          <input id="f-xs" name="xs" type="text" autocomplete="off"
            placeholder="Tengo ganas de que llegue el fin de semana." value="${esc(f.xs || '')}">
        </label>
      </details>

      <p class="muted sm">Entra en la caja 1, así que la verás hoy mismo. El audio de las
        palabras que agregues usa la voz del dispositivo.</p>

      <div class="row2">
        <button type="button" class="btn" data-act="sheet-close">Cancelar</button>
        <button type="submit" class="btn solid">Guardar</button>
      </div>
    </form>
  `);
}

function importar(state) {
  const err = state.formError;
  return wrap('Importar progreso', `
    <form class="form" id="form-importar" novalidate>
      ${err ? `<p class="formerr">${esc(err)}</p>` : ''}
      <p class="muted sm">Pega aquí el JSON que exportaste antes, desde este u otro teléfono.</p>

      <label class="field">
        <span>JSON</span>
        <textarea id="f-json" name="json" rows="7" spellcheck="false"
          placeholder='{ "version": 2, "words": [ … ], "progress": { … } }'></textarea>
      </label>

      <fieldset class="field">
        <legend>Qué hacer con lo que ya tienes</legend>
        <label class="radio">
          <input type="radio" name="modo" value="merge" checked>
          <span><b>Fusionar</b> — conserva lo tuyo y gana la caja más alta</span>
        </label>
        <label class="radio">
          <input type="radio" name="modo" value="replace">
          <span><b>Reemplazar</b> — borra tu progreso actual y deja solo lo importado</span>
        </label>
      </fieldset>

      <div class="row2">
        <button type="button" class="btn" data-act="sheet-close">Cancelar</button>
        <button type="submit" class="btn solid">Importar</button>
      </div>
    </form>
  `);
}

function wrap(titulo, inner) {
  return `<div class="scrim" data-act="sheet-close"></div>
    <div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(titulo)}">
      <div class="grabber"></div>
      <div class="sheet-head">
        <h2 class="h2">${esc(titulo)}</h2>
        <button class="xbtn" data-act="sheet-close" aria-label="Cerrar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"
            stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
        </button>
      </div>
      <div class="sheet-body">${inner}</div>
    </div>`;
}

/** La lista de tus palabras en la pantalla de Inicio. */
export function misPalabras() {
  const mias = store.userWords();
  if (!mias.length) return '';
  return `<div class="block">
    <p class="eyebrow">Tus palabras · ${mias.length}</p>
    <ul class="mywords">
      ${mias.map(w => `<li>
        <span class="mw-emoji">${w.emoji || '📝'}</span>
        <span class="mw-txt"><b>${esc(w.en)}</b><span>${esc(w.es)}</span></span>
        <span class="mw-box">caja ${store.progressOf(w.en).box}</span>
        <button class="xbtn sm" data-act="del-word" data-en="${esc(w.en)}"
          aria-label="Quitar ${esc(w.en)} del mazo">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"
            stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
        </button>
      </li>`).join('')}
    </ul>
  </div>`;
}
