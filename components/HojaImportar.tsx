'use client';

import { useState } from 'react';
import * as store from '@/lib/local-store';
import { plural } from '@/lib/ui';
import { Hoja } from './Hoja';

export function HojaImportar({
  alCerrar,
  alImportar,
}: {
  alCerrar: () => void;
  alImportar: (resumen: string) => void;
}) {
  const [texto, setTexto] = useState('');
  const [modo, setModo] = useState<'merge' | 'replace'>('merge');
  const [error, setError] = useState<string | null>(null);

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!texto.trim()) {
      setError('Pega primero el JSON que exportaste.');
      return;
    }
    try {
      const { palabras, avances } = store.importAll(texto.trim(), modo);
      alImportar(`${plural(palabras, 'palabra')} y ${plural(avances, 'avance')}`);
    } catch (e) {
      setError(`No se pudo leer el JSON: ${(e as Error).message}`);
    }
  }

  return (
    <Hoja titulo="Importar progreso" alCerrar={alCerrar}>
      <form className="form" onSubmit={enviar} noValidate>
        {error && <p className="formerr">{error}</p>}
        <p className="muted sm">Pega aquí el JSON que exportaste antes, desde este u otro teléfono.</p>

        <label className="field">
          <span>JSON</span>
          <textarea
            name="json"
            rows={7}
            spellCheck={false}
            placeholder='{ "version": 2, "words": [ … ], "progress": { … } }'
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
          />
        </label>

        <fieldset className="field">
          <legend>Qué hacer con lo que ya tienes</legend>
          <label className="radio">
            <input
              type="radio"
              name="modo"
              value="merge"
              checked={modo === 'merge'}
              onChange={() => setModo('merge')}
            />
            <span>
              <b>Fusionar</b> — conserva lo tuyo y gana la caja más alta
            </span>
          </label>
          <label className="radio">
            <input
              type="radio"
              name="modo"
              value="replace"
              checked={modo === 'replace'}
              onChange={() => setModo('replace')}
            />
            <span>
              <b>Reemplazar</b> — borra tu progreso actual y deja solo lo importado
            </span>
          </label>
        </fieldset>

        <div className="row2">
          <button type="button" className="btn" onClick={alCerrar}>
            Cancelar
          </button>
          <button type="submit" className="btn solid">
            Importar
          </button>
        </div>
      </form>
    </Hoja>
  );
}
