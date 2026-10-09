'use client';

import { useState } from 'react';
import BASE from '@/data/deck.json';
import * as store from '@/lib/local-store';
import { today, type Word } from '@/lib/srs';
import { Hoja } from './Hoja';

/** Emojis que cubren la mayoría de lo que uno apunta en la calle. */
const EMOJIS = ['📝','🛣️','🏆','💡','⏰','💰','🤝','🔔','🚆','🧩','🌊','😬','⚡','🎯',
                '🛡️','⏳','🧗','🙋','☔','⏱️','🔀','🍽️','🏠','💬','❤️','🔧','📈','🧠'];

export function HojaNuevaPalabra({
  alCerrar,
  alGuardar,
}: {
  alCerrar: () => void;
  alGuardar: (w: Word) => void;
}) {
  const [campos, setCampos] = useState({ en: '', es: '', ipa: '', xe: '', xs: '' });
  const [emoji, setEmoji] = useState('📝');
  const [error, setError] = useState<string | null>(null);

  const cambiar = (k: keyof typeof campos) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setCampos((c) => ({ ...c, [k]: e.target.value }));

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
    alGuardar(w);
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
