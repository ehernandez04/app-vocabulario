'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useEstado } from '@/app/estado';
import { Avatar } from './Avatar';
import { HojaAjustes } from './HojaAjustes';
import { HojaImportar } from './HojaImportar';

/**
 * El avatar que abre Ajustes, con sus hojas.
 *
 * Vive en la fila del título de cada vista y no solo en Inicio: cambiar de voz
 * a mitad de una sesión no puede costar volver a Inicio y perder la tarjeta en
 * la que estabas. Lleva dentro el estado de las hojas para que cada vista solo
 * tenga que poner el botón.
 *
 * Las hojas se montan en el armazón y no dentro de la vista: en Camino la vista
 * es oscura y la hoja heredaría su tinta clara y sus reglas, sobre papel claro.
 */
export function BotonAjustes() {
  const { usuario, recargarMazo, rearmarCola, avisar } = useEstado();
  const [hoja, setHoja] = useState<'ajustes' | 'importar' | null>(null);

  return (
    <>
      <button className="avatarbtn" onClick={() => setHoja('ajustes')} aria-label="Tu cuenta y ajustes">
        <Avatar foto={usuario.foto} nombre={usuario.nombre} correo={usuario.correo} size={36} />
      </button>
      {hoja &&
        createPortal(
          hoja === 'ajustes' ? (
            <HojaAjustes alCerrar={() => setHoja(null)} alAbrirImportar={() => setHoja('importar')} />
          ) : (
            <HojaImportar
              alCerrar={() => setHoja(null)}
              alImportar={(resumen) => {
                recargarMazo();
                rearmarCola();
                setHoja(null);
                avisar(resumen);
              }}
            />
          ),
          // Solo se llega acá tras un toque, o sea ya en el cliente.
          document.querySelector('.app') ?? document.body
        )}
    </>
  );
}
