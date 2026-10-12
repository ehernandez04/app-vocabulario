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

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import BASE from '@/data/deck.json';
import * as audio from '@/lib/audio';
import * as store from '@/lib/local-store';
import { grade, nextStreak, session, today, type Progress, type Word } from '@/lib/srs';
import { plural } from '@/lib/ui';

export type Usuario = { nombre: string | null; correo: string | null; foto: string | null };

type Estado = {
  usuario: Usuario;
  listo: boolean;
  deck: Word[];
  cola: Word[];
  indice: number;
  aciertos: number;
  fallos: number;
  aviso: Aviso | null;
  avisar: (texto: string, accion?: AccionAviso, duracion?: number) => void;
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

export function ProveedorEstado({
  children,
  usuario,
}: {
  children: React.ReactNode;
  usuario: Usuario;
}) {
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

  const avisar = useCallback((texto: string, accion?: AccionAviso, duracion?: number) => {
    setAviso({ texto, accion });
    clearTimeout(temporizadorAviso);
    // Con algo que pulsar hace falta más tiempo: 1,8 s no alcanza para leer,
    // decidir y llegar al botón.
    temporizadorAviso = window.setTimeout(() => setAviso(null), duracion ?? (accion ? 6000 : 1800));
  }, []);

  /**
   * La primera vez que entras con cuenta, lo que ya había en este teléfono se
   * sube. Quien venía usando la app sin cuenta no puede perder su avance, y no
   * se borra nada local en ningún caso: si falla, todo sigue acá y se reintenta.
   *
   * Una sola vez por cuenta (`yaSubidoA`). Lo que se cree después de esa subida
   * lo recoge la sincronización de la etapa 3, no esto.
   */
  const subiendo = useRef(false);
  // El aviso de «Reintentar» llama a la versión de entonces, no a la de ahora.
  const subirRef = useRef<() => void>(() => {});
  const subir = useCallback(async () => {
    const cuenta = usuario.correo;
    if (!cuenta || subiendo.current || store.yaSubidoA(cuenta)) return;
    const datos = store.datosParaSubir();
    if (!store.haySubida(datos)) {
      store.marcarSubido(cuenta); // teléfono nuevo: no hay nada que subir
      return;
    }
    subiendo.current = true;
    try {
      const r = await fetch('/api/subir', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(datos),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const { palabras, avances } = (await r.json()) as { palabras: number; avances: number };
      store.marcarSubido(cuenta);
      const partes = [
        palabras > 0 && plural(palabras, 'palabra'),
        avances > 0 && plural(avances, 'avance'),
      ].filter(Boolean);
      // Si la cuenta ya lo tenía todo (una subida anterior que murió a medias),
      // no hay nada que contar.
      if (partes.length) avisar(`Subimos ${partes.join(' y ')} a tu cuenta`, undefined, 4500);
    } catch {
      avisar(
        'No se pudo subir tu avance a la cuenta',
        { etiqueta: 'Reintentar', alPulsar: () => subirRef.current() },
        10000
      );
    } finally {
      subiendo.current = false;
    }
  }, [usuario.correo, avisar]);

  useEffect(() => {
    subirRef.current = subir;
  }, [subir]);

  useEffect(() => {
    if (!listo) return;
    // Sin señal no se intenta: en el metro un aviso de error cada vez que abres
    // la app sería ruido. Se sube en cuanto vuelva la conexión.
    const intentar = () => subirRef.current();
    if (navigator.onLine) intentar();
    window.addEventListener('online', intentar);
    return () => window.removeEventListener('online', intentar);
  }, [listo]);

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
      // El índice llega después del primer render, así que hay que repintar:
      // si no, Inicio no se entera de que hay voces grabadas y no las muestra.
      audio.loadAudioManifest().then(repintar);
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
      usuario,
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
      usuario,
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
