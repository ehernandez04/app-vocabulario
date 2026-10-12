'use client';

import { useState } from 'react';

/**
 * La foto de perfil, con la inicial como respaldo.
 *
 * Dos cosas que hacen falta y no son obvias:
 *
 * `referrerPolicy="no-referrer"`. Google sirve las fotos desde
 * `lh3.googleusercontent.com` y **rechaza la petición según el referer** que
 * manda el navegador, devolviendo un error en vez de la imagen. Sin esto se ve
 * el icono de imagen rota, que es justo lo que pasaba.
 *
 * Y el respaldo: si la imagen falla por cualquier otro motivo —la cuenta no
 * tiene foto, Google cambia la URL, no hay señal— se muestra la inicial. Una
 * imagen rota en la cabecera de la app se ve peor que no tener foto.
 */
export function Avatar({
  foto,
  nombre,
  correo,
  size,
  className,
}: {
  foto: string | null;
  nombre: string | null;
  correo: string | null;
  size: number;
  className?: string;
}) {
  const [fallo, setFallo] = useState(false);
  const inicial = (nombre ?? correo ?? '?').trim().charAt(0).toUpperCase() || '?';

  if (!foto || fallo) return <span className={className}>{inicial}</span>;

  return (
    <span className={className}>
      {/* eslint-disable-next-line @next/next/no-img-element -- la sirve Google desde su dominio; next/image no aporta acá */}
      <img
        src={foto}
        alt=""
        width={size}
        height={size}
        referrerPolicy="no-referrer"
        onError={() => setFallo(true)}
      />
    </span>
  );
}
