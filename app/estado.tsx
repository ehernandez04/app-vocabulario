'use client';

/**
 * El estado de la app, mientras siga viviendo en el dispositivo.
 *
 * El almacén (lib/local-store) guarda su propio reflejo en memoria y las
 * vistas leen de ahí sin esperar; este proveedor solo necesita avisarle a
 * React cuándo algo cambió, con un contador de versión. Es el mismo trato que
 * tenía main.js con su render(), pero sin repintar la pantalla entera.
 *
 * En la etapa 3 este proveedor es el que va a encolar los cambios para
 * sincronizarlos; por eso toda escritura pasa por acá y no por los componentes.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import BASE from '@/data/deck.json';
import * as audio from '@/lib/audio';
import * as store from '@/lib/local-store';
import { grade, nextStreak, session, today, type Progress, type Word } from '@/lib/srs';

type Estado = {
  listo: boolean;
  deck: Word[];
  cola: Word[];
  indice: number;
  aciertos: number;
  fallos: number;
  progresoDe: (en: string) => Progress;
  ajuste: <K extends keyof store.Settings>(k: K) => store.Settings[K];
  guardarAjuste: <K extends keyof store.Settings>(k: K, v: store.Settings[K]) => void;
  calificar: (word: Word, acerto: boolean) => void;
  siguiente: () => void;
  rearmarCola: () => void;
  recargarMazo: () => void;
  alternarTema: () => void;
};

const Ctx = createContext<Estado | null>(null);

const BASE_DECK = BASE as Word[];

export function ProveedorEstado({ children }: { children: React.ReactNode }) {
  const [listo, setListo] = useState(false);
  const [, setVersion] = useState(0);
  const [deck, setDeck] = useState<Word[]>(BASE_DECK);
  const [cola, setCola] = useState<Word[]>([]);
  const [indice, setIndice] = useState(0);
  const [aciertos, setAciertos] = useState(0);
  const [fallos, setFallos] = useState(0);

  const repintar = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    let vivo = true;
    store.init().then(() => {
      if (!vivo) return;
      const mazo = store.fullDeck(BASE_DECK);
      setDeck(mazo);
      setCola(session(mazo, store.progressOf, 20));
      aplicarTema(store.get('theme'));
      setListo(true);
      // Las voces no están disponibles de inmediato: initVoices engancha
      // `voiceschanged` y repintamos cuando la lista real llegue.
      audio.initVoices();
      audio.loadAudioManifest();
    });
    const soltar = audio.onVoicesChanged(repintar);
    return () => {
      vivo = false;
      soltar();
    };
  }, [repintar]);

  const recargarMazo = useCallback(() => {
    setDeck(store.fullDeck(BASE_DECK));
    repintar();
  }, [repintar]);

  const rearmarCola = useCallback(() => {
    setCola(session(store.fullDeck(BASE_DECK), store.progressOf, 20));
    setIndice(0);
    setAciertos(0);
    setFallos(0);
  }, []);

  /** Registra el resultado, mueve la caja y mantiene la racha. */
  const calificar = useCallback(
    (word: Word, acerto: boolean) => {
      const antes = store.progressOf(word.en);
      store.saveProgress(word.en, grade(antes, acerto));

      const dia = today();
      if (store.get('lastDay') !== dia) {
        store.set('streak', nextStreak(store.get('streak'), store.get('lastDay'), dia));
        store.set('lastDay', dia);
      }
      if (acerto) setAciertos((n) => n + 1);
      else setFallos((n) => n + 1);
      repintar();
    },
    [repintar]
  );

  const siguiente = useCallback(() => setIndice((i) => i + 1), []);

  const guardarAjuste = useCallback(
    <K extends keyof store.Settings>(k: K, v: store.Settings[K]) => {
      store.set(k, v);
      repintar();
    },
    [repintar]
  );

  const alternarTema = useCallback(() => {
    const nuevo = store.get('theme') === 'dark' ? 'light' : 'dark';
    store.set('theme', nuevo);
    aplicarTema(nuevo);
    repintar();
  }, [repintar]);

  const valor = useMemo<Estado>(
    () => ({
      listo,
      deck,
      cola,
      indice,
      aciertos,
      fallos,
      progresoDe: store.progressOf,
      ajuste: store.get,
      guardarAjuste,
      calificar,
      siguiente,
      rearmarCola,
      recargarMazo,
      alternarTema,
    }),
    [
      listo,
      deck,
      cola,
      indice,
      aciertos,
      fallos,
      guardarAjuste,
      calificar,
      siguiente,
      rearmarCola,
      recargarMazo,
      alternarTema,
    ]
  );

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

/** data-skin, no prefers-color-scheme: la elección de la app manda. */
function aplicarTema(tema: 'light' | 'dark') {
  document.documentElement.dataset.skin = tema;
}

export function useEstado(): Estado {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useEstado fuera del proveedor');
  return ctx;
}
