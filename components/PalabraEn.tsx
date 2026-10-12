import { partirEn } from '@/lib/palabra';

/**
 * La palabra en inglés tal como se ve: el texto, y su etiqueta (verbo,
 * sustantivo…) como una nota pequeña al lado, solo cuando la tiene. La clave
 * guardada lleva la etiqueta dentro («run (sustantivo)»), pero se lee «run».
 */
export function PalabraEn({ en }: { en: string }) {
  const { texto, etiqueta } = partirEn(en);
  return (
    <>
      {texto}
      {etiqueta && <small className="etq">{etiqueta}</small>}
    </>
  );
}
