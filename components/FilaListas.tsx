'use client';

import { useState } from 'react';
import { useEstado } from '@/app/estado';
import { HojaLista } from './HojaLista';
import { HojaNuevaLista } from './HojaNuevaLista';
import { HojaNuevaPalabra } from './HojaNuevaPalabra';

type Hoja = { tipo: 'nueva-lista' } | { tipo: 'lista'; id: string } | { tipo: 'palabra'; id: string };

/**
 * La fila de listas de Inicio: elegir una filtra lo que repasas en las tres
 * formas (Tarjetas, Adivinar y Camino). «Todas» es lo normal. El anillo y las
 * cajas de Inicio siguen contando todo el mazo.
 */
export function FilaListas() {
  const { listas, listaElegida, elegirLista, mazo, avisar, recargarMazo, rearmarCola } = useEstado();
  const [hoja, setHoja] = useState<Hoja | null>(null);

  const elegida = listas.find((l) => l.id === listaElegida) ?? null;
  const vacia = elegida !== null && mazo.length === 0;

  return (
    <div className="block">
      <div className="listas" role="group" aria-label="Qué lista repasar">
        <button className={`pill${!elegida ? ' on' : ''}`} aria-pressed={!elegida} onClick={() => elegirLista(null)}>
          Todas
        </button>
        {listas.map((l) => (
          <button
            key={l.id}
            className={`pill${elegida?.id === l.id ? ' on' : ''}`}
            aria-pressed={elegida?.id === l.id}
            onClick={() => elegirLista(l.id)}
          >
            {l.name}
          </button>
        ))}
        <button className="pill add" onClick={() => setHoja({ tipo: 'nueva-lista' })} aria-label="Crear una lista">
          ＋
        </button>
      </div>

      {elegida && (
        <p className="muted sm">
          {vacia ? 'Todavía no tiene palabras' : `Repasando solo ${elegida.name}`} ·{' '}
          <button className="mf-link" onClick={() => setHoja({ tipo: 'lista', id: elegida.id })}>
            {vacia ? 'Agregar palabras' : 'Editar lista'}
          </button>
        </p>
      )}

      {hoja?.tipo === 'nueva-lista' && (
        <HojaNuevaLista
          alCerrar={() => setHoja(null)}
          alCrear={(id) => {
            elegirLista(id);
            setHoja({ tipo: 'lista', id });
          }}
        />
      )}
      {hoja?.tipo === 'lista' && (
        <HojaLista
          id={hoja.id}
          alCerrar={() => setHoja(null)}
          alPalabraNueva={() => setHoja({ tipo: 'palabra', id: hoja.id })}
        />
      )}
      {hoja?.tipo === 'palabra' && (
        <HojaNuevaPalabra
          listaInicial={hoja.id}
          alCerrar={() => setHoja({ tipo: 'lista', id: hoja.id })}
          alGuardar={(_w, mensaje) => {
            recargarMazo();
            rearmarCola();
            avisar(mensaje);
            setHoja({ tipo: 'lista', id: hoja.id });
          }}
        />
      )}
    </div>
  );
}
