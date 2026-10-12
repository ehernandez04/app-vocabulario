'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Sticker } from '@/components/Sticker';
import {
  IconAdivinar,
  IconAuriculares,
  IconFlecha,
  IconLuna,
  IconSol,
  IconTarjetas,
} from '@/components/icons';
import * as store from '@/lib/local-store';
import { isDue } from '@/lib/srs';
import { noteColor, peekColor, saludo } from '@/lib/ui';
import { BotonAjustes } from '@/components/BotonAjustes';
import { MasFalladas } from '@/components/MasFalladas';
import { FilaListas } from '@/components/FilaListas';
import { HojaNuevaPalabra } from '@/components/HojaNuevaPalabra';
import { useEstado } from '../estado';

const COLORES_CAJA = ['#FFE066', '#FFB4A2', '#B8E1FF', '#C8F0A8', '#FFE066'];

export default function Inicio() {
  const { listo, deck, mazo, cola, indice, progresoDe, ajuste, alternarTema, recargarMazo, rearmarCola, avisar, usuario } =
    useEstado();
  const [hoja, setHoja] = useState<'nueva' | null>(null);

  const trasCambiarElMazo = (mensaje: string) => {
    recargarMazo();
    rearmarCola();
    setHoja(null);
    avisar(mensaje);
  };


  // Hasta que IndexedDB conteste no sabemos el progreso real. Pintar números
  // provisionales y corregirlos medio segundo después se ve peor que esperar.
  if (!listo) return <section className="view" aria-busy="true" />;

  const vencidas = deck.filter((w) => isDue(progresoDe(w.en))).length;
  // El titular habla de lo que vas a repasar (la lista elegida); el anillo y las cajas, de todo el mazo.
  const porRepasar = mazo.filter((w) => isDue(progresoDe(w.en))).length;
  const total = deck.length;
  const alDia = total - vencidas;
  const pct = total ? Math.round((alDia / total) * 100) : 0;
  const C = 2 * Math.PI * 19;

  const siguiente = cola[indice] || mazo[0];
  const cuentas = store.boxCounts(deck);
  const max = Math.max(...cuentas, 1);
  const oscuro = ajuste('theme') === 'dark';
  const primerNombre = usuario.nombre?.trim().split(/\s+/)[0] ?? null;

  return (
    <section className="view">
      <div className="hello">
        <div>
          <p className="eyebrow">{saludo()}{primerNombre ? `, ${primerNombre}` : ''}</p>
          {/* Concordancia a mano: el helper plural() no sirve con verbo. */}
          <h1 className="h1">
            {!porRepasar ? (
              <>
                Todo
                <br />
                al día
              </>
            ) : porRepasar === 1 ? (
              <>
                1 palabra
                <br />
                te espera
              </>
            ) : (
              <>
                {porRepasar} palabras
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
          <BotonAjustes />
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

      <FilaListas />

      {siguiente && (
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
      )}

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

      <MasFalladas />

      <div className="block">
        <button className="btn solid wide" onClick={() => setHoja('nueva')}>
          ＋ Agregar una palabra
        </button>
      </div>

      {hoja === 'nueva' && (
        <HojaNuevaPalabra
          alCerrar={() => setHoja(null)}
          alGuardar={(w) => trasCambiarElMazo(`“${w.en}” entra en la caja 1`)}
        />
      )}
    </section>
  );
}
