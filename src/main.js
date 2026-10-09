import './styles.css';
import BASE from './data/deck.json';
import * as store from './lib/store.js';
import * as audio from './lib/audio.js';
import { session, grade, shuffle, nextStreak, today } from './lib/srs.js';
import { $, toast, plural } from './lib/ui.js';
import { inicio } from './views/inicio.js';
import { tarjetas } from './views/tarjetas.js';
import { adivinar } from './views/adivinar.js';
import { camino } from './views/camino.js';
import { sheet } from './views/sheet.js';

const VIEWS = { inicio, tarjetas, adivinar, camino };

const state = {
  view: 'inicio',
  queue: [], qi: 0, revealed: false,
  hits: 0, miss: 0,
  quiz: null,
  cam: { i: 0, phase: 'idle', on: false, left: 0, timer: null, tick: null },
  sheet: null, form: null, formError: null
};

// El mazo son las palabras de fábrica más las que agregue el usuario, así que
// se recalcula cada vez que ese conjunto cambia.
const ctx = { deck: BASE, state };
const refreshDeck = () => { ctx.deck = store.fullDeck(BASE); };
const DECK = () => ctx.deck;
const current = () => state.queue[state.qi];

/* ── sesión ─────────────────────────────────────────────────────────────── */

function buildQueue() {
  state.queue = session(DECK(), store.progressOf, 20);
  state.qi = 0;
  state.revealed = false;
  state.hits = 0;
  state.miss = 0;
}

function newQuiz() {
  const pool = session(DECK(), store.progressOf, 20);
  const word = pool[0] || DECK()[0];
  const others = shuffle(DECK().filter(x => x.en !== word.en)).slice(0, 3);
  state.quiz = {
    word,
    options: shuffle([word, ...others]).map(x => x.es),
    picked: null
  };
}

/** Registra el resultado, mueve la caja y mantiene la racha. */
function record(word, knew) {
  const before = store.progressOf(word.en);
  const after = grade(before, knew);
  store.saveProgress(word.en, after);

  const day = today();
  if (store.get('lastDay') !== day) {
    store.set('streak', nextStreak(store.get('streak'), store.get('lastDay'), day));
    store.set('lastDay', day);
  }
  if (knew) state.hits++; else state.miss++;
  return after;
}

/* ── pintar ─────────────────────────────────────────────────────────────── */

function applyTheme() {
  const root = document.documentElement;
  if (store.get('theme') === 'dark') root.setAttribute('data-skin', 'dark');
  else root.removeAttribute('data-skin');
}

function render() {
  $('#views').innerHTML = VIEWS[state.view](ctx);
  $('#sheet').innerHTML = sheet(ctx);
  document.querySelectorAll('.tab').forEach(t =>
    t.setAttribute('aria-selected', String(t.dataset.go === state.view)));
  if (state.view === 'tarjetas' && state.revealed) armSwipe();
  if (state.sheet) $('#sheet input, #sheet textarea')?.focus({ preventScroll: true });
}

function openSheet(which) {
  state.sheet = which;
  state.formError = null;
  if (which === 'nueva') state.form = { emoji: '📝' };
  render();
}

function closeSheet() {
  state.sheet = null;
  state.form = null;
  state.formError = null;
  render();
}

/** Guarda lo escrito antes de repintar, para no perderlo al elegir un emoji. */
function captureForm() {
  const f = $('#form-nueva');
  if (!f) return;
  state.form = {
    ...state.form,
    en: f.en.value, es: f.es.value,
    ipa: f.ipa?.value || '', xe: f.xe?.value || '', xs: f.xs?.value || ''
  };
}

function saveWord() {
  captureForm();
  const { en = '', es = '' } = state.form || {};
  if (!en.trim() || !es.trim()) {
    state.formError = 'Hacen falta la palabra en inglés y su traducción.';
    return render();
  }
  if (store.hasWord(BASE, en.trim())) {
    state.formError = `“${en.trim()}” ya está en tu mazo.`;
    return render();
  }
  const w = store.addWord(state.form);
  store.saveProgress(w.en, { box: 1, due: today(), seen: 0, miss: 0 });
  refreshDeck();
  buildQueue();
  newQuiz();
  closeSheet();
  toast(`“${w.en}” entra en la caja 1`);
}

function doImport() {
  const f = $('#form-importar');
  const texto = f.json.value.trim();
  if (!texto) {
    state.formError = 'Pega primero el JSON que exportaste.';
    return render();
  }
  try {
    const modo = f.modo.value;
    const { palabras, avances } = store.importAll(texto, modo);
    refreshDeck();
    buildQueue();
    newQuiz();
    applyTheme();
    closeSheet();
    toast(`${plural(palabras, 'palabra')} y ${plural(avances, 'avance')}`);
  } catch (e) {
    state.formError = `No se pudo leer el JSON: ${e.message}`;
    render();
  }
}

function go(name) {
  if (name !== 'camino') caminoStop();
  if (name === 'tarjetas' && state.qi >= state.queue.length) buildQueue();
  if (name === 'adivinar' && !state.quiz) newQuiz();
  state.view = name;
  render();
  $('#views').scrollTop = 0;
}

/* ── modo camino ────────────────────────────────────────────────────────── */

function caminoStop() {
  const c = state.cam;
  c.on = false;
  c.phase = 'idle';
  c.left = 0;
  clearTimeout(c.timer);
  clearInterval(c.tick);
  audio.stop();
  audio.setPlaybackState('paused');
}

const repaint = () => { if (state.view === 'camino') render(); };

async function caminoRun(i) {
  const c = state.cam;
  const token = ++caminoRun.token;
  const alive = () => c.on && token === caminoRun.token;

  while (alive()) {
    const w = DECK()[i];
    c.i = i;
    c.phase = 'en';
    c.left = 0;
    audio.setNowPlaying(w, {
      play: () => caminoStart(c.i),
      pause: () => { caminoStop(); repaint(); },
      nexttrack: () => caminoStart((c.i + 1) % DECK().length),
      previoustrack: () => caminoStart((c.i - 1 + DECK().length) % DECK().length)
    });
    audio.setPlaybackState('playing');
    repaint();

    await audio.say(w.en, 'en', { rate: 0.9, word: w.en, part: 'en' });
    if (!alive()) return;

    c.phase = 'think';
    c.left = store.get('pause');
    repaint();
    await countdown(c, alive);
    if (!alive()) return;

    c.phase = 'es';
    c.left = 0;
    repaint();
    await audio.say(w.es, 'es', { rate: 0.95, word: w.en, part: 'es' });
    if (!alive()) return;

    if (store.get('withEx')) {
      c.phase = 'ex';
      repaint();
      await audio.say(w.xe, 'en', { rate: 0.9, word: w.en, part: 'xe' });
      if (!alive()) return;
    }

    await wait(1200);
    if (!alive()) return;
    i = (i + 1) % DECK().length;
  }
}
caminoRun.token = 0;

const wait = ms => new Promise(r => setTimeout(r, ms));

function countdown(c, alive) {
  return new Promise(resolve => {
    clearInterval(c.tick);
    c.tick = setInterval(() => {
      if (!alive()) { clearInterval(c.tick); return resolve(); }
      c.left--;
      repaint();
      if (c.left <= 0) { clearInterval(c.tick); resolve(); }
    }, 1000);
  });
}

function caminoStart(i) {
  caminoStop();
  state.cam.on = true;
  caminoRun(i);
}

/* ── arrastrar la tarjeta ───────────────────────────────────────────────── */

function armSwipe() {
  const live = $('#live');
  if (!live) return;
  const L = live.querySelector('.swipetag.l');
  const R = live.querySelector('.swipetag.r');
  let x0 = null, dx = 0;

  live.addEventListener('pointerdown', e => {
    if (e.target.closest('button')) return;
    x0 = e.clientX; dx = 0;
    live.style.transition = 'none';
    try { live.setPointerCapture(e.pointerId); } catch { /* vacío */ }
  });

  live.addEventListener('pointermove', e => {
    if (x0 === null) return;
    dx = e.clientX - x0;
    live.style.transform = `translateX(${dx}px) rotate(${dx / 22}deg)`;
    L.style.opacity = dx < -24 ? Math.min(1, -dx / 90) : 0;
    R.style.opacity = dx > 24 ? Math.min(1, dx / 90) : 0;
  });

  const end = () => {
    if (x0 === null) return;
    const d = dx;
    x0 = null;
    live.style.transition = 'transform .28s cubic-bezier(.3,1.2,.5,1)';
    if (Math.abs(d) > 92) {
      live.classList.add(d < 0 ? 'fly-left' : 'fly-right');
      setTimeout(() => gradeCard(d > 0), 220);
    } else {
      live.style.transform = '';
      L.style.opacity = R.style.opacity = 0;
    }
  };
  live.addEventListener('pointerup', end);
  live.addEventListener('pointercancel', end);
}

function gradeCard(knew) {
  const w = current();
  if (!w) return;
  const after = record(w, knew);
  toast(knew ? `“${w.en}” sube a la caja ${after.box}` : `“${w.en}” vuelve a la caja 1`);
  state.qi++;
  state.revealed = false;
  render();
}

/* ── eventos ────────────────────────────────────────────────────────────── */

document.addEventListener('click', async e => {
  const b = e.target.closest('[data-act], [data-go]');
  if (!b) return;

  if (b.dataset.go) return go(b.dataset.go);

  const w = current();
  const q = state.quiz;

  switch (b.dataset.act) {
    case 'theme':
      store.set('theme', store.get('theme') === 'dark' ? 'light' : 'dark');
      applyTheme();
      render();
      break;

    case 'say-en': {
      const word = state.view === 'adivinar' ? q.word : w;
      audio.say(word.en, 'en', { rate: 0.95, word: word.en, part: 'en' });
      break;
    }
    case 'say-es': audio.say(w.es, 'es', { rate: 0.95, word: w.en, part: 'es' }); break;
    case 'say-ex': audio.say(w.xe, 'en', { rate: 0.9, word: w.en, part: 'xe' }); break;
    case 'slow':   audio.say(w.en, 'en', { rate: 0.55, word: w.en, part: 'en' }); break;

    case 'reveal':
      state.revealed = true;
      render();
      audio.say(w.es, 'es', { rate: 0.95, word: w.en, part: 'es' });
      break;

    case 'grade':   gradeCard(b.dataset.k === '1'); break;
    case 'restart': buildQueue(); render(); break;

    case 'audio-only':
      store.set('audioOnly', !store.get('audioOnly'));
      render();
      if (store.get('audioOnly')) audio.say(q.word.en, 'en', { word: q.word.en, part: 'en' });
      break;

    case 'pick': {
      if (q.picked !== null) break;
      q.picked = b.dataset.o;
      const ok = q.picked === q.word.es;
      record(q.word, ok);
      render();
      if (ok) audio.say(q.word.es, 'es', { word: q.word.en, part: 'es' });
      else audio.say(q.word.en, 'en', { rate: 0.6, word: q.word.en, part: 'en' });
      break;
    }
    case 'next-q':
      newQuiz();
      render();
      audio.say(state.quiz.word.en, 'en', { word: state.quiz.word.en, part: 'en' });
      break;

    case 'cam-toggle':
      if (state.cam.on) { caminoStop(); render(); } else caminoStart(state.cam.i);
      break;
    case 'cam-skip': {
      const n = (state.cam.i + 1) % DECK().length;
      if (state.cam.on) caminoStart(n);
      else { state.cam.i = n; state.cam.phase = 'idle'; render(); }
      break;
    }
    case 'cam-replay':
      if (state.cam.on) caminoStart(state.cam.i);
      else audio.say(DECK()[state.cam.i].en, 'en', { word: DECK()[state.cam.i].en, part: 'en' });
      break;
    case 'cam-pause': store.set('pause', +b.dataset.s); render(); break;
    case 'cam-ex':    store.set('withEx', !store.get('withEx')); render(); break;

    case 'test-voice':
      await audio.say('The way to achieve it is practice. Listen carefully.', 'en');
      audio.say('El camino para lograrlo es practicar.', 'es');
      break;

    case 'export': {
      await navigator.clipboard.writeText(store.exportAll()).then(
        () => toast('Progreso copiado al portapapeles'),
        () => toast('No se pudo copiar aquí')
      );
      break;
    }

    case 'sheet-nueva':    openSheet('nueva'); break;
    case 'sheet-importar': openSheet('importar'); break;
    case 'sheet-close':    closeSheet(); break;
    case 'pick-emoji':
      captureForm();
      state.form = { ...state.form, emoji: b.dataset.e };
      render();
      break;
    case 'del-word': {
      const en = b.dataset.en;
      store.deleteWord(en);
      refreshDeck();
      buildQueue();
      newQuiz();
      render();
      toast(`“${en}” fuera del mazo`);
      break;
    }
  }
});

document.addEventListener('submit', e => {
  if (e.target.id === 'form-nueva')    { e.preventDefault(); saveWord(); }
  if (e.target.id === 'form-importar') { e.preventDefault(); doImport(); }
});

document.addEventListener('change', e => {
  const sel = e.target.closest('[data-voice]');
  if (!sel) return;
  const lang = sel.dataset.voice;
  audio.chooseVoice(lang, sel.value);
  audio.say(lang === 'es' ? 'Así suena esta voz en español.'
                          : 'This is how I sound. The way to achieve it is practice.', lang);
});

document.addEventListener('keydown', e => {
  if (state.sheet) {
    if (e.key === 'Escape') closeSheet();
    return;   // con la hoja abierta, los atajos de las vistas estorban
  }
  if (state.view === 'adivinar' && state.quiz && state.quiz.picked === null) {
    const k = 'ABCD'.indexOf(e.key.toUpperCase());
    if (k > -1) document.querySelectorAll('.opt')[k]?.click();
  }
  if (state.view === 'tarjetas' && e.key === ' ' && e.target === document.body) {
    e.preventDefault();
    ($('[data-act="reveal"]') || $('[data-act="say-en"]'))?.click();
  }
});

/* ── arranque ───────────────────────────────────────────────────────────── */

async function boot() {
  await store.init();
  refreshDeck();
  applyTheme();
  buildQueue();
  newQuiz();
  render();

  audio.onVoicesChanged(() => { if (state.view === 'inicio') render(); });
  audio.refreshVoices();
  if ('speechSynthesis' in window) {
    speechSynthesis.addEventListener('voiceschanged', audio.refreshVoices);
  }
  await audio.loadAudioManifest();

  const support = audio.voiceSupport();
  if (support !== 'ok') {
    const warn = $('#warn');
    warn.textContent = support === 'none'
      ? 'Este navegador no puede sintetizar voz. El resto de la app funciona igual.'
      : 'Este navegador no tiene voces en inglés instaladas. En el celular casi siempre vienen de fábrica.';
    warn.hidden = false;
  }
}

boot();
