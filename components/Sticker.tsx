import type { Word } from '@/lib/srs';

/**
 * La ilustración de la palabra, tratada como una pegatina sobre el post-it:
 * recuadro con borde discontinuo, girado unos grados. El estilo vive en
 * app.css (.sticker).
 *
 * Es un emoji; si la palabra trae `img`, se usa esa imagen en su lugar, que es
 * lo que permitirá pasar a ilustraciones generadas o a fotos reales sin tocar
 * las vistas.
 */
export function Sticker({ word, size = 'md' }: { word: Word; size?: 'sm' | 'md' }) {
  return (
    <span className={`sticker ${size}`} aria-hidden="true">
      {word.img ? (
        // eslint-disable-next-line @next/next/no-img-element -- son SVG propios, servidos desde el mismo origen; next/image no aporta acá
        <img src={word.img} alt="" />
      ) : (
        <span className="glyph">{word.emoji || '📝'}</span>
      )}
    </span>
  );
}
