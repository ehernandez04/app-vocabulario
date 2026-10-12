'use client';

import { useState } from 'react';
import BASE from '@/data/deck.json';
import * as store from '@/lib/local-store';
import { useEstado } from '@/app/estado';
import { armarClaves, partirEn, textoEn, yaLaTienes, type Sentido } from '@/lib/palabra';
import { today, type Word } from '@/lib/srs';
import { svgAImagen } from '@/lib/svg';
import { plural } from '@/lib/ui';
import { Hoja } from './Hoja';

/** Emojis que cubren la mayoría de lo que uno apunta en la calle. */
const EMOJIS = ['📝','🛣️','🏆','💡','⏰','💰','🤝','🔔','🚆','🧩','🌊','😬','⚡','🎯',
                '🛡️','⏳','🧗','🙋','☔','⏱️','🔀','🍽️','🏠','💬','❤️','🔧','📈','🧠'];

const MODELOS = [
  { id: 'haiku', nombre: 'Haiku', nota: 'El más rápido y barato. Mejor para cosas concretas.' },
  { id: 'sonnet', nombre: 'Sonnet', nota: 'Punto medio: buen dibujo, rápido.' },
  { id: 'opus', nombre: 'Opus', nota: 'El que mejor entiende ideas abstractas. Tarda más.' },
] as const;

export function HojaNuevaPalabra({
  alCerrar,
  alGuardar,
  listaInicial = null,
}: {
  alCerrar: () => void;
  /** `mensaje`: lo que conviene decir al guardar (agregar varias se cuenta distinto que una). */
  alGuardar: (w: Word, mensaje: string) => void;
  /** Lista que viene marcada de entrada (la elegida en Inicio, o la que se está editando). */
  listaInicial?: string | null;
}) {
  const { listas, alCambiarListas } = useEstado();
  const [enListas, setEnListas] = useState<string[]>(
    listaInicial && listas.some((l) => l.id === listaInicial) ? [listaInicial] : []
  );
  const [campos, setCampos] = useState({ en: '', es: '', ipa: '', xe: '', xs: '' });
  const [emoji, setEmoji] = useState('📝');
  const [error, setError] = useState<string | null>(null);

  // Asistente de IA (#50): propone los significados de la palabra escrita.
  const [buscando, setBuscando] = useState(false);
  const [sentidos, setSentidos] = useState<Sentido[] | null>(null);
  const [elegidos, setElegidos] = useState<number[]>([]);
  const [restantes, setRestantes] = useState<number | null>(null);
  // Dibujo con IA (#53): opcional por significado; solo se guarda lo que se acepta.
  const [dibujos, setDibujos] = useState<Record<number, string>>({});
  const [dibujando, setDibujando] = useState<number | null>(null);
  const [modelo, setModelo] = useState(store.get('modeloDibujo'));
  const [menu, setMenu] = useState<number | null>(null);
  const deckClaves = store.fullDeck(BASE as Word[]).map((w) => w.en);

  const cambiar = (k: keyof typeof campos) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setCampos((c) => ({ ...c, [k]: e.target.value }));

  async function buscar() {
    const texto = campos.en.trim();
    if (!texto) return setError('Escribe primero la palabra en inglés.');
    if (!navigator.onLine) return setError('Sin conexión: no se puede buscar con IA. Puedes rellenarlo tú.');
    setError(null);
    setBuscando(true);
    try {
      const r = await fetch('/api/palabra/buscar', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ texto }),
      });
      const datos = (await r.json().catch(() => ({}))) as {
        sentidos?: Sentido[];
        restantes?: number;
        error?: string;
      };
      if (!r.ok) return setError(datos.error ?? 'No se pudo consultar al asistente. Puedes agregarla a mano.');
      if (!datos.sentidos?.length) return setError('No reconozco esa palabra en inglés. Revisa cómo está escrita o agrégala a mano.');
      setSentidos(datos.sentidos);
      setRestantes(datos.restantes ?? null);
      // Marcados de entrada: los que aún no tienes.
      setElegidos(datos.sentidos.flatMap((x, i) => (yaLaTienes(x, deckClaves) ? [] : [i])));
    } catch {
      setError('No se pudo consultar al asistente. Puedes agregarla a mano.');
    } finally {
      setBuscando(false);
    }
  }

  async function dibujar(i: number) {
    if (!sentidos || dibujando !== null) return;
    if (!navigator.onLine) return setError('Sin conexión: no se puede dibujar con IA.');
    setError(null);
    setMenu(null);
    setDibujando(i);
    try {
      const r = await fetch('/api/palabra/dibujo', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ en: sentidos[i].en, es: sentidos[i].es, modelo }),
      });
      const datos = (await r.json().catch(() => ({}))) as { svg?: string; restantes?: number; error?: string };
      if (typeof datos.restantes === 'number') setRestantes(datos.restantes);
      if (!r.ok || !datos.svg) return setError(datos.error ?? 'No salió el dibujo. Quédate con el emoji.');
      setDibujos((d) => ({ ...d, [i]: datos.svg as string }));
    } catch {
      setError('No salió el dibujo. Quédate con el emoji.');
    } finally {
      setDibujando(null);
    }
  }

  function elegirModelo(m: 'haiku' | 'sonnet' | 'opus') {
    setModelo(m);
    store.set('modeloDibujo', m);
    setMenu(null);
  }

  function agregarSentidos() {
    if (!sentidos || !elegidos.length) return;
    const claves = armarClaves(sentidos, deckClaves);
    let ultima: Word | null = null;
    for (const i of elegidos) {
      const x = sentidos[i];
      const svg = dibujos[i];
      ultima = store.addWord({
        en: claves[i],
        es: x.es,
        ipa: x.ipa,
        xe: x.xe,
        xs: x.xs,
        emoji: x.emoji,
        ...(svg ? { svg, img: svgAImagen(svg) } : {}),
      });
      store.saveProgress(ultima.en, { box: 1, due: today(), seen: 0, miss: 0 });
      for (const id of enListas) store.setWordInList(id, ultima.en, true);
    }
    if (enListas.length) alCambiarListas();
    if (ultima) {
      alGuardar(
        ultima,
        elegidos.length === 1
          ? `“${textoEn(ultima.en)}” entra en la caja 1`
          : `${plural(elegidos.length, 'tarjeta')} de “${textoEn(campos.en)}” entran en la caja 1`
      );
    }
  }

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    const en = campos.en.trim();
    const es = campos.es.trim();
    if (!en || !es) {
      setError('Hacen falta la palabra en inglés y su traducción.');
      return;
    }
    if (store.hasWord(BASE as Word[], en)) {
      setError(`“${en}” ya está en tu mazo.`);
      return;
    }
    const w = store.addWord({ ...campos, en, es, emoji });
    store.saveProgress(w.en, { box: 1, due: today(), seen: 0, miss: 0 });
    for (const id of enListas) store.setWordInList(id, w.en, true);
    if (enListas.length) alCambiarListas();
    alGuardar(w, `“${w.en}” entra en la caja 1`);
  }

  const listasFila = listas.length > 0 && (
    <fieldset className="field">
      <legend>
        Listas <b className="opt-tag">opcional</b>
      </legend>
      <div className="chips">
        {listas.map((l) => {
          const on = enListas.includes(l.id);
          return (
            <button
              type="button"
              key={l.id}
              className={`pill${on ? ' on' : ''}`}
              aria-pressed={on}
              onClick={() => setEnListas((xs) => (on ? xs.filter((x) => x !== l.id) : [...xs, l.id]))}
            >
              {l.name}
            </button>
          );
        })}
      </div>
    </fieldset>
  );

  if (sentidos) {
    const claves = armarClaves(sentidos, deckClaves);
    return (
      <Hoja titulo={textoEn(campos.en.trim())} alCerrar={alCerrar}>
        <div className="form">
          {error && <p className="formerr">{error}</p>}
          <p className="eyebrow">Elige cuáles agregar</p>
          <ul className="sentidos">
            {sentidos.map((x, i) => {
              const repetida = yaLaTienes(x, deckClaves);
              const on = elegidos.includes(i);
              return (
                <li key={i}>
                  <label className={`sentido${on ? ' on' : ''}${repetida ? ' repetida' : ''}`}>
                    <input
                      type="checkbox"
                      checked={on}
                      disabled={!!repetida}
                      onChange={() => setElegidos((xs) => (on ? xs.filter((n) => n !== i) : [...xs, i]))}
                    />
                    <span className="chkbox" aria-hidden="true">
                      {on ? '✓' : ''}
                    </span>
                    <span className="sentido-txt">
                      <span className="sentido-cab">
                        <b>{x.en}</b>
                        <span className="tag">{partirEn(claves[i]).etiqueta ?? x.pos}</span>
                        {dibujos[i] ? (
                          // eslint-disable-next-line @next/next/no-img-element -- SVG ya saneado, como imagen de datos
                          <img className="dibujo-img" src={svgAImagen(dibujos[i])} alt="" />
                        ) : (
                          <span className="glyph">{x.emoji}</span>
                        )}
                      </span>
                      <span className="sentido-es">{x.es}</span>
                      {x.ipa && <span className="sentido-ipa">{x.ipa}</span>}
                      {x.xe && <span className="sentido-ej">{x.xe}</span>}
                      {repetida && <span className="sentido-ya">Ya tienes «{repetida}»</span>}
                    </span>
                  </label>
                  {!repetida && (
                    <div className="dibujo">
                      <div className="dibujo-btns">
                        <button
                          type="button"
                          className="btn sm"
                          disabled={dibujando !== null}
                          onClick={() => void dibujar(i)}
                        >
                          {dibujando === i ? 'Dibujando…' : dibujos[i] ? 'Otro dibujo' : '✦ Dibujar con IA'}
                        </button>
                        <button
                          type="button"
                          className="btn sm flecha"
                          aria-label="Elegir con qué modelo dibujar"
                          aria-expanded={menu === i}
                          onClick={() => setMenu(menu === i ? null : i)}
                        >
                          ▾
                        </button>
                        {dibujos[i] && (
                          <button
                            type="button"
                            className="btn sm"
                            onClick={() =>
                              setDibujos((d) => Object.fromEntries(Object.entries(d).filter(([k]) => Number(k) !== i)))
                            }
                          >
                            Usar el emoji
                          </button>
                        )}
                      </div>
                      {menu === i && (
                        <div className="modelos" role="radiogroup" aria-label="Modelo para dibujar">
                          {MODELOS.map((m) => (
                            <button
                              type="button"
                              key={m.id}
                              role="radio"
                              aria-checked={modelo === m.id}
                              className={`modelo${modelo === m.id ? ' on' : ''}`}
                              onClick={() => elegirModelo(m.id)}
                            >
                              <span className="rd" aria-hidden="true" />
                              <span>
                                <b>{m.nombre}</b>
                                <small>{m.nota}</small>
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          {listasFila}
          <p className="muted sm">
            Lo propone una IA: revisa la traducción antes de agregarla.
            {restantes !== null && ` Te quedan ${restantes} de 30 puntos de IA hoy (buscar vale 1; dibujar, 2).`}
          </p>
          <div className="row2">
            <button type="button" className="btn" onClick={() => setSentidos(null)}>
              Escribirlo yo
            </button>
            <button type="button" className="btn solid" disabled={!elegidos.length} onClick={agregarSentidos}>
              {elegidos.length ? `Agregar ${elegidos.length}` : 'Elige alguna'}
            </button>
          </div>
        </div>
      </Hoja>
    );
  }

  return (
    <Hoja titulo="Nueva palabra" alCerrar={alCerrar}>
      <form className="form" onSubmit={enviar} noValidate>
        {error && <p className="formerr">{error}</p>}

        <label className="field">
          <span>
            Inglés <b className="req">obligatorio</b>
          </span>
          <input
            name="en"
            type="text"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="to look forward to"
            value={campos.en}
            onChange={cambiar('en')}
            required
          />
        </label>

        <button type="button" className="btn ia" onClick={buscar} disabled={buscando || !campos.en.trim()}>
          {buscando ? 'Buscando…' : '✦ Buscar con IA'}
        </button>
        <p className="muted sm">Te propone la traducción, la pronunciación y una frase. O rellénalo tú abajo.</p>

        <label className="field">
          <span>
            Español <b className="req">obligatorio</b>
          </span>
          <input
            name="es"
            type="text"
            autoComplete="off"
            placeholder="tener ganas de"
            value={campos.es}
            onChange={cambiar('es')}
            required
          />
        </label>

        <fieldset className="field emojis">
          <legend>Ilustración</legend>
          <div className="emojigrid">
            {EMOJIS.map((e) => (
              <button
                type="button"
                key={e}
                className={`emojibtn${emoji === e ? ' on' : ''}`}
                onClick={() => setEmoji(e)}
                aria-pressed={emoji === e}
              >
                {e}
              </button>
            ))}
          </div>
        </fieldset>

        <details className="more">
          <summary>
            Añadir fonética y un ejemplo <span className="opt-tag">opcional</span>
          </summary>

          <label className="field">
            <span>Fonética</span>
            <input
              name="ipa"
              type="text"
              autoComplete="off"
              spellCheck={false}
              placeholder="/lʊk ˈfɔːrwərd/"
              value={campos.ipa}
              onChange={cambiar('ipa')}
            />
          </label>

          <label className="field">
            <span>Frase en inglés</span>
            <input
              name="xe"
              type="text"
              autoComplete="off"
              placeholder="I look forward to the weekend."
              value={campos.xe}
              onChange={cambiar('xe')}
            />
          </label>

          <label className="field">
            <span>Su traducción</span>
            <input
              name="xs"
              type="text"
              autoComplete="off"
              placeholder="Tengo ganas de que llegue el fin de semana."
              value={campos.xs}
              onChange={cambiar('xs')}
            />
          </label>
        </details>

        {listasFila}

        <p className="muted sm">
          Entra en la caja 1, así que la verás hoy mismo. El audio de las palabras que agregues
          usa la voz del dispositivo.
        </p>

        <div className="row2">
          <button type="button" className="btn" onClick={alCerrar}>
            Cancelar
          </button>
          <button type="submit" className="btn solid">
            Guardar
          </button>
        </div>
      </form>
    </Hoja>
  );
}
