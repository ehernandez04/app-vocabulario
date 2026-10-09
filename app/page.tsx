'use client';

import Link from 'next/link';
import { Sticker } from '@/components/Sticker';
import {
  IconAdivinar,
  IconAltavoz,
  IconAuriculares,
  IconFlecha,
  IconLuna,
  IconSol,
  IconTarjetas,
} from '@/components/icons';
import * as audio from '@/lib/audio';
import * as store from '@/lib/local-store';
import { isDue } from '@/lib/srs';
import { noteColor, peekColor, saludo } from '@/lib/ui';
import { useEstado } from './estado';

const COLORES_CAJA = ['#FFE066', '#FFB4A2', '#B8E1FF', '#C8F0A8', '#FFE066'];

/**
 * Ninguna heurística acierta en todos los dispositivos, así que la última
 * palabra sobre qué voz usar es del usuario.
 */
function FilaDeVoz({ lang, etiqueta }: { lang: audio.Idioma; etiqueta: string }) {
  const lista = audio.voices[lang];
  const actual = audio.currentVoice(lang);
  return (
    <label className="vrow">
      <span>{etiqueta}</span>
      <select
        className="sel"
        value={actual?.name ?? ''}
        onChange={(e) => audio.chooseVoice(lang, e.target.value)}
        disabled={!lista.length}
      >
        {lista.length ? (
          lista.map((v) => (
            <option key={v.name} value={v.name}>
              {v.name} · {v.lang}
            </option>
          ))
        ) : (
          <option value="">Sin voces disponibles</option>
        )}
      </select>
    </label>
  );
}

export default function Inicio() {
  const { listo, deck, cola, indice, progresoDe, ajuste, alternarTema } = useEstado();

  // Hasta que IndexedDB conteste no sabemos el progreso real. Pintar números
  // provisionales y corregirlos medio segundo después se ve peor que esperar.
  if (!listo) return <section className="view" aria-busy="true" />;

  const vencidas = deck.filter((w) => isDue(progresoDe(w.en))).length;
  const total = deck.length;
  const alDia = total - vencidas;
  const pct = total ? Math.round((alDia / total) * 100) : 0;
  const C = 2 * Math.PI * 19;

  const siguiente = cola[indice] || deck[0];
  const cuentas = store.boxCounts(deck);
  const max = Math.max(...cuentas, 1);
  const oscuro = ajuste('theme') === 'dark';

  return (
    <section className="view">
      <div className="hello">
        <div>
          <p className="eyebrow">{saludo()}</p>
          {/* Concordancia a mano: el helper plural() no sirve con verbo. */}
          <h1 className="h1">
            {!vencidas ? (
              <>
                Todo
                <br />
                al día
              </>
            ) : vencidas === 1 ? (
              <>
                1 palabra
                <br />
                te espera
              </>
            ) : (
              <>
                {vencidas} palabras
                <br />
                te esperan
              </>
            )}
          </h1>
        </div>
        <div className="hello-side">
          <span className="streak">
            <span className="flame">🔥</span> {ajuste('streak')}
          </span>
          <button
            className="themebtn"
            onClick={alternarTema}
            aria-label="Cambiar entre tema claro y oscuro"
          >
            {oscuro ? <IconSol /> : <IconLuna />}
          </button>
        </div>
      </div>

      <div className="today">
        <div className="ring">
          <svg width="62" height="62" viewBox="0 0 44 44" aria-hidden="true">
            <circle cx="22" cy="22" r="19" fill="none" stroke="var(--rule)" strokeWidth="4" />
            <circle
              cx="22"
              cy="22"
              r="19"
              fill="none"
              stroke="var(--ink)"
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={C.toFixed(1)}
              strokeDashoffset={(C * (1 - pct / 100)).toFixed(1)}
            />
          </svg>
          <span className="val">{pct}%</span>
        </div>
        <div className="txt">
          <b>
            {alDia} de {total} al día
          </b>
          <span className="muted">
            {!vencidas
              ? 'Vuelve mañana por las siguientes'
              : vencidas === 1
                ? 'Te falta 1 por repasar'
                : `Te faltan ${vencidas} por repasar`}
          </span>
        </div>
      </div>

      <Link
        href="/tarjetas"
        className="stack"
        aria-label={`Practicar la siguiente palabra: ${siguiente.en}`}
      >
        <div className="lay b2">
          <div className="flat" style={{ background: peekColor(deck, siguiente, 2) }} />
        </div>
        <div className="lay b1">
          <div className="flat" style={{ background: peekColor(deck, siguiente, 1) }} />
        </div>
        <div className="lay top">
          <div
            className="note"
            style={{ '--note': noteColor(deck, siguiente) } as React.CSSProperties}
          >
            <div className="n-top">
              <span className="n-tag">Siguiente palabra</span>
              <Sticker word={siguiente} size="sm" />
            </div>
            <span className="en sm">{siguiente.en}</span>
            <span className="hand">toca para practicar →</span>
          </div>
        </div>
      </Link>

      <div className="block">
        <p className="eyebrow">Cómo quieres repasar</p>
        <div className="modes">
          <Link href="/tarjetas" className="mode">
            <span className="ic" style={{ background: '#FFE066' }}>
              <IconTarjetas />
            </span>
            <span className="lab">
              <b>Tarjetas</b>
              <span>Ver, escuchar y dar la vuelta</span>
            </span>
            <span className="arr">
              <IconFlecha />
            </span>
          </Link>
          <Link href="/adivinar" className="mode">
            <span className="ic" style={{ background: '#FFB4A2' }}>
              <IconAdivinar />
            </span>
            <span className="lab">
              <b>Adivinar</b>
              <span>Elige la traducción correcta</span>
            </span>
            <span className="arr">
              <IconFlecha />
            </span>
          </Link>
          <Link href="/camino" className="mode dark">
            <span className="ic" style={{ background: '#FFE066' }}>
              <IconAuriculares />
            </span>
            <span className="lab">
              <b>Modo camino</b>
              <span>Manos libres, solo audio</span>
            </span>
            <span className="arr">
              <IconFlecha />
            </span>
          </Link>
        </div>
      </div>

      <div className="block">
        <p className="eyebrow">Tus cinco cajas de repaso</p>
        <div className="boxes">
          {cuentas.map((n, i) => (
            <div className="bx" key={i}>
              <div className="col">
                <i
                  style={{
                    height: n ? `${Math.max(14, (n / max) * 100)}%` : 0,
                    background: COLORES_CAJA[i],
                  }}
                />
              </div>
              <span className="n">{n}</span>
              <span className="l">caja {i + 1}</span>
            </div>
          ))}
        </div>
        <p className="muted sm">Cada acierto sube la palabra una caja: 1, 2, 4, 8 y 16 días.</p>
      </div>

      <div className="block">
        <p className="eyebrow">Voz</p>
        <div className="voicebox">
          <FilaDeVoz lang="en" etiqueta="Inglés" />
          <FilaDeVoz lang="es" etiqueta="Español" />
          <button
            className="btn"
            onClick={() =>
              audio.say('The way to achieve it is practice. Listen carefully.', 'en')
            }
          >
            <IconAltavoz /> Probar esta voz
          </button>
          <p className="muted sm">
            Las mejores suelen llamarse <b>Google</b>, <b>Siri</b>, <b>Enhanced</b> o{' '}
            <b>Premium</b>. Si tu lista se ve pobre, en iPhone y Mac se descargan voces de mucha
            mejor calidad en <b>Ajustes → Accesibilidad → Contenido hablado → Voces</b>.
          </p>
        </div>
      </div>

      <div className="block">
        <p className="eyebrow">Mi mazo · {total} palabras</p>
        <p className="muted sm">
          Agregar palabras, exportar e importar vuelven en el issue #34, que es lo último que
          falta para poder retirar la versión anterior.
        </p>
      </div>
    </section>
  );
}
