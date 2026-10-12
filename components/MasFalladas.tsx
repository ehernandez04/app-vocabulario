'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useEstado } from '@/app/estado';
import * as store from '@/lib/local-store';
import { masFalladas, type Word } from '@/lib/srs';
import { plural } from '@/lib/ui';
import { Hoja } from './Hoja';

/** Cuántas se muestran en Inicio; el resto, en la hoja. */
const EN_INICIO = 3;

function Fila({ w, completa }: { w: Word; completa?: boolean }) {
  const p = store.progressOf(w.en);
  const tramos = Math.min(Math.max(p.seen, p.miss), 8);
  const rojos = Math.round((p.miss / Math.max(p.seen, p.miss, 1)) * tramos);
  return (
    <li className="mf">
      <span className="mf-txt">
        <b>{w.en}</b>
        <span>{w.es}</span>
        {!completa && (
          <span className="mf-meter" aria-hidden="true">
            {Array.from({ length: tramos }, (_, i) => (
              <i key={i} className={i < rojos ? 'f' : undefined} />
            ))}
          </span>
        )}
      </span>
      <span className="mf-num">
        <b>{completa ? `${p.miss} de ${p.seen}` : plural(p.miss, 'fallo')}</b>
        <span>caja {p.box}</span>
      </span>
    </li>
  );
}

/** El bloque de Inicio con las palabras que más se te resisten, y su hoja. */
export function MasFalladas() {
  const { deck, repasarLista } = useEstado();
  const router = useRouter();
  const [abierta, setAbierta] = useState(false);

  const lista = masFalladas(deck, store.progressOf);
  if (!lista.length) return null;

  const repasar = () => {
    repasarLista(lista);
    router.push('/tarjetas');
  };

  return (
    <div className="block">
      <p className="eyebrow">Las que más se te resisten</p>
      <ul className="mflist">
        {lista.slice(0, EN_INICIO).map((w) => (
          <Fila key={w.en} w={w} />
        ))}
      </ul>
      <button className="mf-link" onClick={() => setAbierta(true)}>
        {lista.length > EN_INICIO ? `Ver las ${lista.length} →` : 'Repasar estas →'}
      </button>
      {abierta && (
        <Hoja titulo="Más falladas" alCerrar={() => setAbierta(false)}>
          <p className="muted sm">Ordenadas por fallos. «4 de 6» = fallaste 4 de las 6 veces que la viste.</p>
          <ul className="mflist">
            {lista.map((w) => (
              <Fila key={w.en} w={w} completa />
            ))}
          </ul>
          <button className="btn solid wide" onClick={repasar}>
            Repasar {lista.length === 1 ? 'esta' : `estas ${lista.length}`}
          </button>
        </Hoja>
      )}
    </div>
  );
}
