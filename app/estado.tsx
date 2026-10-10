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
  aviso: Aviso | null;
  avisar: (texto: string, accion?: AccionAviso) => void;
  progresoDe: (en: string) => Progress;
  ajuste: <K extends keyof store.Settings>(k: K) => store.Settings[K];
  guardarAjuste: <K extends keyof store.Settings>(k: K, v: store.Settings[K]) => void;
  calificar: (word: Word, acerto: boolean) => Progress;
  /** Devuelve la última calificación a como estaba. null si no hay nada que deshacer. */
  deshacer: (() => void) | null;
  siguiente: () => void;
  rearmarCola: () => void;
  recargarMazo: () => void;
  alternarTema: () => void;
};

export type AccionAviso = { etiqueta: string; alPulsar: () => void };
export type Aviso = { texto: string; accion?: AccionAviso };

/** Lo necesario para devolver una calificación a como estaba. */
type Revertible = {
  word: Word;
  progreso: Progress;
  acerto: boolean;
  streak: number;
  lastDay: string | null;
};

const Ctx = createContext<Estado | null>(null);

let temporizadorAviso: number | undefined;

const BASE_DECK = BASE as Word[];

export function ProveedorEstado({ children }: { children: React.ReactNode }) {
  const [listo, setListo] = useState(false);
  const [version, setVersion] = useState(0);
  const [deck, setDeck] = useState<Word[]>(BASE_DECK);
  const [cola, setCola] = useState<Word[]>([]);
  const [indice, setIndice] = useState(0);
  const [aciertos, setAciertos] = useState(0);
  const [fallos, setFallos] = useState(0);
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const [revertible, setRevertible] = useState<Revertible | null>(null);

  const repintar = useCallback(() => setVersion((v) => v + 1), []);

  const avisar = useCallback((texto: string, accion?: AccionAviso) => {
    setAviso({ texto, accion });
    clearTimeout(temporizadorAviso);
    // Con algo que pulsar hace falta más tiempo: 1,8 s no alcanza para leer,
    // decidir y llegar al botón.
    temporizadorAviso = window.setTimeout(() => setAviso(null), accion ? 6000 : 1800);
  }, []);

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
      const despues = grade(antes, acerto);
      // Se guarda lo de antes —incluida la racha— para poder deshacer. Es la
      // única copia: solo se puede deshacer la última.
      setRevertible({
        word,
        progreso: antes,
        acerto,
        streak: store.get('streak'),
        lastDay: store.get('lastDay'),
      });
      store.saveProgress(word.en, despues);

      const dia = today();
      if (store.get('lastDay') !== dia) {
        store.set('streak', nextStreak(store.get('streak'), store.get('lastDay'), dia));
        store.set('lastDay', dia);
      }
      if (acerto) setAciertos((n) => n + 1);
      else setFallos((n) => n + 1);
      repintar();
      return despues;
    },
    [repintar]
  );

  const deshacer = useCallback(() => {
    if (!revertible) return;
    store.saveProgress(revertible.word.en, revertible.progreso);
    store.set('streak', revertible.streak);
    store.set('lastDay', revertible.lastDay);
    if (revertible.acerto) setAciertos((n) => Math.max(0, n - 1));
    else setFallos((n) => Math.max(0, n - 1));
    setIndice((i) => Math.max(0, i - 1));
    setRevertible(null);
    setAviso(null);
    repintar();
  }, [revertible, repintar]);

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
      aviso,
      avisar,
      deshacer: revertible ? deshacer : null,
      progresoDe: store.progressOf,
      ajuste: store.get,
      guardarAjuste,
      calificar,
      siguiente,
      rearmarCola,
      recargarMazo,
      alternarTema,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `version` no se usa dentro del memo: está a propósito, como disparador
    [
      // `version` tiene que estar: el almacén y las voces viven fuera de React,
      // así que un cambio ahí solo repinta si el valor del contexto cambia. Sin
      // esto, `children` llega con la misma referencia y el árbol no se vuelve
      // a renderizar — por eso el selector de voz se quedaba en la voz vieja.
      version,
      listo,
      deck,
      cola,
      indice,
      aciertos,
      fallos,
      aviso,
      avisar,
      revertible,
      deshacer,
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
