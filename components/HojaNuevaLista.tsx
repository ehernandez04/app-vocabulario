'use client';

import { useState } from 'react';
import { useEstado } from '@/app/estado';
import { limpiarNombre, MAX_NOMBRE, nombreRepetido } from '@/lib/listas';
import * as store from '@/lib/local-store';
import { Hoja } from './Hoja';

/** Pide solo el nombre; al crear, quien la abre decide qué hacer (llenarla). */
export function HojaNuevaLista({
  alCerrar,
  alCrear,
}: {
  alCerrar: () => void;
  alCrear: (id: string) => void;
}) {
  const { listas, alCambiarListas } = useEstado();
  const [nombre, setNombre] = useState('');
  const [error, setError] = useState<string | null>(null);

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    const n = limpiarNombre(nombre);
    if (!n) return setError('Ponle un nombre a la lista.');
    if (nombreRepetido(listas, n)) return setError(`Ya tienes una lista que se llama “${n}”.`);
    const l = store.createList(n);
    alCambiarListas();
    alCrear(l.id);
  }

  return (
    <Hoja titulo="Nueva lista" alCerrar={alCerrar}>
      <form className="form" onSubmit={enviar} noValidate>
        {error && <p className="formerr">{error}</p>}
        <label className="field">
          <span>Nombre</span>
          <input
            type="text"
            autoComplete="off"
            maxLength={MAX_NOMBRE}
            placeholder="Entrevistas"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
          />
        </label>
        <p className="muted sm">Después eliges qué palabras entran.</p>
        <div className="row2">
          <button type="button" className="btn" onClick={alCerrar}>
            Cancelar
          </button>
          <button type="submit" className="btn solid">
            Crear
          </button>
        </div>
      </form>
    </Hoja>
  );
}
