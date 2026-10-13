'use client';

/**
 * Grabarte y oírte (#35, paso 1). No sale nada del teléfono: la toma vive en
 * memoria como un blob y se descarta al cambiar de palabra.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import * as audio from './audio';

export const MAX_SEGUNDOS = 6;
const BARRAS = 28;

export type EstadoVoz = 'reposo' | 'grabando' | 'oyendo';
export type PasoOyendo = 'modelo' | 'tu' | null;

type Modelo = { texto: string; word: string };

type Opciones = {
  /** Cuántos segundos como máximo dura una toma. */
  max?: number;
  /** Si al terminar suena el modelo y luego tu toma (Tarjetas). Falso: se queda quieta. */
  oirAlTerminar?: boolean;
  /** Se llama cuando hay una toma lista (al parar a mano o al llegar al máximo). */
  alTerminar?: () => void;
};

export function useGrabadora(clave: string, modelo: Modelo, { max = MAX_SEGUNDOS, oirAlTerminar = true, alTerminar }: Opciones = {}) {
  const [estado, setEstado] = useState<EstadoVoz>('reposo');
  const [paso, setPaso] = useState<PasoOyendo>(null);
  const [segundos, setSegundos] = useState(0);
  const [duracion, setDuracion] = useState(0);
  const [niveles, setNiveles] = useState<number[]>(() => Array(BARRAS).fill(0.08));
  const [hayToma, setHayToma] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const modeloRef = useRef(modelo);
  const alTerminarRef = useRef(alTerminar);
  useEffect(() => {
    modeloRef.current = modelo;
    alTerminarRef.current = alTerminar;
  });

  const grabador = useRef<MediaRecorder | null>(null);
  const flujo = useRef<MediaStream | null>(null);
  const ctx = useRef<AudioContext | null>(null);
  const reloj = useRef<ReturnType<typeof setInterval> | null>(null);
  const pulso = useRef<ReturnType<typeof setInterval> | null>(null);
  const url = useRef<string | null>(null);
  const blob = useRef<Blob | null>(null);
  const reproductor = useRef<HTMLAudioElement | null>(null);
  // Cada cancelación invalida una comparación en curso.
  const turno = useRef(0);

  const soltarMicro = useCallback(() => {
    if (reloj.current) clearInterval(reloj.current);
    reloj.current = null;
    if (pulso.current) clearInterval(pulso.current);
    pulso.current = null;
    flujo.current?.getTracks().forEach((t) => t.stop());
    flujo.current = null;
    ctx.current?.close().catch(() => {});
    ctx.current = null;
  }, []);

  const callarToma = useCallback(() => {
    turno.current++;
    reproductor.current?.pause();
    setPaso(null);
  }, []);

  const descartar = useCallback(() => {
    callarToma();
    const g = grabador.current;
    if (g && g.state !== 'inactive') {
      g.onstop = null;
      g.stop();
    }
    grabador.current = null;
    soltarMicro();
    if (url.current) URL.revokeObjectURL(url.current);
    url.current = null;
    blob.current = null;
    reproductor.current = null;
    setHayToma(false);
    setEstado('reposo');
    setSegundos(0);
    setError(null);
  }, [callarToma, soltarMicro]);

  // Pasar de tarjeta borra la toma; salir de la vista también.
  useEffect(() => {
    return () => descartar();
  }, [clave, descartar]);

  const parar = useCallback(() => {
    const g = grabador.current;
    if (g && g.state !== 'inactive') g.stop();
  }, []);

  const tocar = useCallback(async (conModelo: boolean) => {
    if (!url.current) return;
    callarToma();
    audio.stop();
    const mio = turno.current;
    setEstado('oyendo');
    if (conModelo) {
      setPaso('modelo');
      const m = modeloRef.current;
      await audio.say(m.texto, 'en', { rate: 0.95, word: m.word, part: 'en' });
      if (mio !== turno.current) return;
    }
    setPaso('tu');
    const a = new Audio(url.current);
    reproductor.current = a;
    const fin = () => {
      if (mio !== turno.current) return;
      setPaso(null);
      setEstado('reposo');
    };
    a.onended = fin;
    a.onerror = fin;
    a.play().catch(fin);
  }, [callarToma]);

  const grabar = useCallback(async () => {
    if (estado === 'grabando') return parar();
    descartar();
    // Si la app sigue diciendo la palabra, el micrófono se grabaría a ella.
    audio.stop();
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('Este navegador no puede grabar.');
      return;
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError('Activa el micrófono en los ajustes del navegador.');
      return;
    }
    flujo.current = stream;
    const inicio = Date.now();
    const trozos: Blob[] = [];
    const g = new MediaRecorder(stream);
    grabador.current = g;
    g.ondataavailable = (e) => e.data.size && trozos.push(e.data);
    g.onstop = () => {
      const seg = Math.max(1, Math.round((Date.now() - inicio) / 1000));
      soltarMicro();
      grabador.current = null;
      if (!trozos.length) {
        setEstado('reposo');
        return;
      }
      blob.current = new Blob(trozos, { type: g.mimeType });
      url.current = URL.createObjectURL(blob.current);
      setDuracion(Math.min(seg, max));
      setHayToma(true);
      if (oirAlTerminar) tocar(true);
      else setEstado('reposo');
      alTerminarRef.current?.();
    };

    // La onda sale del volumen real del micrófono.
    try {
      const ac = new AudioContext();
      ctx.current = ac;
      const an = ac.createAnalyser();
      an.fftSize = 256;
      ac.createMediaStreamSource(stream).connect(an);
      const datos = new Uint8Array(an.fftSize);
      setNiveles(Array(BARRAS).fill(0.08));
      pulso.current = setInterval(() => {
        an.getByteTimeDomainData(datos);
        let pico = 0;
        for (const v of datos) pico = Math.max(pico, Math.abs(v - 128));
        const nivel = Math.min(1, 0.08 + (pico / 128) * 2.2);
        setNiveles((prev) => [...prev.slice(1), nivel]);
      }, 70);
    } catch {
      /* sin onda, la grabación sigue */
    }

    setSegundos(0);
    setEstado('grabando');
    g.start();
    reloj.current = setInterval(() => {
      const s = Math.floor((Date.now() - inicio) / 1000);
      setSegundos(s);
      if (s >= max) parar();
    }, 200);
  }, [estado, descartar, parar, soltarMicro, tocar, max, oirAlTerminar]);

  return {
    estado,
    paso,
    segundos,
    duracion,
    niveles,
    hayToma,
    error,
    grabar,
    /** La toma tal como la grabó el navegador, para mandarla al servidor. */
    toma: () => blob.current,
    comparar: () => tocar(true),
    soloTu: () => tocar(false),
    descartar,
  };
}
