'use client';

import { useState } from 'react';
import { useEstado } from '@/app/estado';
import { limpiarNombre, MAX_NOMBRE, nombreRepetido } from '@/lib/listas';
import * as store from '@/lib/local-store';
import { plural } from '@/lib/ui';
import { Hoja } from './Hoja';

/**
 * Una lista por dentro: se marcan y desmarcan palabras del mazo entero, se
 * renombra y se borra. Borrar una lista no borra palabras.
 */
export function HojaLista({
  id,
  alCerrar,
  alPalabraNueva,
}: {
  id: string;
  alCerrar: () => void;
  alPalabraNueva: () => void;
}) {
  const { deck, listas, listaElegida, alCambiarListas, elegirLista } = useEstado();
  const lista = listas.find((l) => l.id === id);
  const [filtro, setFiltro] = useState('');
  const [renombrando, setRenombrando] = useState(false);
  const [nombre, setNombre] = useState(lista?.name ?? '');
  const [error, setError] = useState<string | null>(null);
  const [confirmarBorrar, setConfirmarBorrar] = useState(false);

  if (!lista) return null;

  const dentro = new Set(lista.words);
  const q = filtro.trim().toLowerCase();
  const visibles = q
    ? deck.filter((w) => w.en.toLowerCase().includes(q) || w.es.toLowerCase().includes(q))
    : deck;

  const marcar = (en: string, on: boolean) => {
    store.setWordInList(id, en, on);
    alCambiarListas();
  };

  function guardarNombre() {
    const n = limpiarNombre(nombre);
    if (!n) return setError('Ponle un nombre a la lista.');
    if (nombreRepetido(listas, n, id)) return setError(`Ya tienes una lista que se llama “${n}”.`);
    store.renameList(id, n);
    alCambiarListas();
    setRenombrando(false);
    setError(null);
  }

  function borrar() {
    store.deleteList(id);
    // Si era la elegida, deleteList ya la soltó; hay que rearmar la sesión.
    if (listaElegida === id) elegirLista(null);
    else alCambiarListas();
    alCerrar();
  }

  return (
    <Hoja titulo={lista.name} alCerrar={alCerrar}>
      <div className="listaedit">
        <button className="btn" onClick={alPalabraNueva}>
          ＋ Palabra nueva
        </button>

        <input
          type="search"
          className="buscar"
          placeholder="Buscar palabra…"
          aria-label="Buscar palabra"
          autoComplete="off"
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
        />

        <ul className="checklist">
          {visibles.map((w) => {
            const on = dentro.has(w.en);
            return (
              <li key={w.en}>
                <label className={`chkrow${on ? ' on' : ''}`}>
                  <input type="checkbox" checked={on} onChange={(e) => marcar(w.en, e.target.checked)} />
                  <span className="chkbox" aria-hidden="true">
                    {on ? '✓' : ''}
                  </span>
                  <span className="chk-txt">
                    <b>{w.en}</b>
                    <span>{w.es}</span>
                  </span>
                </label>
              </li>
            );
          })}
          {!visibles.length && <li className="muted sm">Ninguna palabra coincide.</li>}
        </ul>

        <button className="btn solid wide" onClick={alCerrar}>
          Listo · {plural(lista.words.length, 'palabra')}
        </button>

        {renombrando ? (
          <div className="renombrar">
            {error && <p className="formerr">{error}</p>}
            <input
              type="text"
              maxLength={MAX_NOMBRE}
              value={nombre}
              aria-label="Nuevo nombre"
              onChange={(e) => setNombre(e.target.value)}
              autoFocus
            />
            <div className="row2">
              <button className="btn" onClick={() => setRenombrando(false)}>
                Cancelar
              </button>
              <button className="btn solid" onClick={guardarNombre}>
                Guardar nombre
              </button>
            </div>
          </div>
        ) : confirmarBorrar ? (
          <div className="renombrar">
            <p className="muted sm">Se borra la lista, no sus palabras.</p>
            <div className="row2">
              <button className="btn" onClick={() => setConfirmarBorrar(false)}>
                Mejor no
              </button>
              <button className="btn borrar" onClick={borrar}>
                Borrar lista
              </button>
            </div>
          </div>
        ) : (
          <p className="hint">
            <button className="mf-link" onClick={() => setRenombrando(true)}>
              Renombrar
            </button>
            {' · '}
            <button className="mf-link peligro" onClick={() => setConfirmarBorrar(true)}>
              Borrar lista
            </button>
          </p>
        )}
      </div>
    </Hoja>
  );
}
