'use client';

import * as audio from '@/lib/audio';
import { MAX_SEGUNDOS, type useGrabadora } from '@/lib/grabadora';
import { textoEn } from '@/lib/palabra';
import type { Word } from '@/lib/srs';
import { IconAltavoz, IconMicro, IconParar } from './icons';

type Grabadora = ReturnType<typeof useGrabadora>;

const mmss = (s: number) => `0:${String(s).padStart(2, '0')}`;

/** Escuchar, Grabarme y Despacio: tres botones redondos, al alcance del pulgar. */
export function FilaVoz({ w, g }: { w: Word; g: Grabadora }) {
  const grabando = g.estado === 'grabando';
  return (
    <div className="ctl">
      <button
        className="cb"
        disabled={grabando}
        onClick={() => {
          g.descartar();
          audio.say(textoEn(w.en), 'en', { rate: 0.95, word: w.en, part: 'en' });
        }}
      >
        <span className="c">
          <IconAltavoz />
        </span>
        Escuchar
      </button>
      <button className={`cb grande${grabando ? ' rec' : ''}`} onClick={g.grabar}>
        <span className="c">{grabando ? <IconParar /> : <IconMicro />}</span>
        {grabando ? 'Parar' : 'Grabarme'}
      </button>
      <button
        className="cb"
        disabled={grabando}
        onClick={() => {
          g.descartar();
          audio.say(textoEn(w.en), 'en', { rate: 0.55, word: w.en, part: 'en' });
        }}
      >
        <span className="c">0.5×</span>
        Despacio
      </button>
    </div>
  );
}

/** La tira pegada en la nota: la onda al grabar y la comparación después. */
export function TiraVoz({ w, g }: { w: Word; g: Grabadora }) {
  if (g.error) {
    return (
      <div className="tira" role="alert">
        <span className="sub">{g.error}</span>
      </div>
    );
  }
  if (g.estado === 'grabando') {
    return (
      <div className="tira">
        <span className="t">
          Te escucho… {mmss(g.segundos)} / {mmss(MAX_SEGUNDOS)}
        </span>
        <div className="onda" aria-hidden="true">
          {g.niveles.map((n, i) => (
            <i key={i} style={{ height: `${Math.round(n * 100)}%` }} />
          ))}
        </div>
        <span className="sub">Di «{textoEn(w.en)}» y toca el cuadrado.</span>
      </div>
    );
  }
  if (!g.hayToma) return null;
  return (
    <div className="tira">
      <span className="t">Compara</span>
      <div className={`paso${g.paso === 'modelo' ? ' on' : g.paso ? ' off' : ''}`}>
        <span className="dot" />
        Modelo
      </div>
      <div className={`paso${g.paso === 'tu' ? ' on' : g.paso ? ' off' : ''}`}>
        <span className="dot" />
        Tú · {mmss(g.duracion)}
      </div>
      <div className="fila">
        <button className="mini solid" onClick={g.comparar}>
          Comparar otra vez
        </button>
        <button className="mini" onClick={g.soloTu}>
          Solo tú
        </button>
      </div>
      <span className="sub">Pasar de tarjeta borra la grabación.</span>
    </div>
  );
}
