'use client';

import { useCallback, useEffect, useState } from 'react';
import { useEstado } from '@/app/estado';

/**
 * El recordatorio diario (#14): un interruptor, la hora y, cuando el aparato no
 * puede recibir avisos, la explicación de por qué en vez de un interruptor muerto.
 *
 * Los avisos son Web Push: los manda el servidor a la hora elegida, así que
 * llegan con la app cerrada. En iPhone solo funcionan con la app instalada en la
 * pantalla de inicio, y eso es lo que más confunde, de ahí el estado propio.
 */

type Fase = 'cargando' | 'apagado' | 'activo' | 'ios-sin-instalar' | 'denegado' | 'sin-soporte';

const CLAVE_HORA = 'recordatorioHora';
const HORA_INICIAL = '08:30';

function horaGuardada(): string {
  try {
    return localStorage.getItem(CLAVE_HORA) || HORA_INICIAL;
  } catch {
    return HORA_INICIAL;
  }
}

const esIOS = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

const instalada = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  (navigator as unknown as { standalone?: boolean }).standalone === true;

/** La clave pública VAPID viaja en base64 url; PushManager la quiere en bytes. */
function aBytes(b64: string): Uint8Array<ArrayBuffer> {
  const relleno = '='.repeat((4 - (b64.length % 4)) % 4);
  const bin = atob((b64 + relleno).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

const zona = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

async function registro() {
  // En desarrollo no hay service worker (ver RegistrarSW): getRegistration no se cuelga.
  return navigator.serviceWorker.getRegistration();
}

export function FilaRecordatorio() {
  const { avisar } = useEstado();
  const [fase, setFase] = useState<Fase>('cargando');
  const [hora, setHora] = useState(HORA_INICIAL);
  const [ocupado, setOcupado] = useState(false);
  const [endpoint, setEndpoint] = useState<string | null>(null);

  const revisar = useCallback(async () => {
    setHora(horaGuardada());
    if (esIOS() && !instalada()) return setFase('ios-sin-instalar');
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      return setFase('sin-soporte');
    }
    if (Notification.permission === 'denied') return setFase('denegado');
    const reg = await registro();
    if (!reg) return setFase('sin-soporte');
    const sub = await reg.pushManager.getSubscription();
    setEndpoint(sub?.endpoint ?? null);
    setFase(sub && Notification.permission === 'granted' ? 'activo' : 'apagado');
  }, []);

  useEffect(() => {
    // Lee APIs del navegador que no existen en el servidor.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void revisar();
  }, [revisar]);

  async function enviarSuscripcion(sub: PushSubscription, h: string) {
    const json = sub.toJSON();
    const r = await fetch('/api/recordatorio', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys, hour: h, tz: zona() }),
    });
    if (!r.ok) throw new Error('servidor');
  }

  async function encender() {
    // Un iPhone sin instalar no llega aquí con el interruptor activo, pero se explica.
    if (esIOS() && !instalada()) return setFase('ios-sin-instalar');
    const clave = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!clave) return avisar('Los avisos no están configurados');
    setOcupado(true);
    try {
      const permiso = await Notification.requestPermission();
      if (permiso !== 'granted') return setFase(permiso === 'denied' ? 'denegado' : 'apagado');
      const reg = await registro();
      if (!reg) return setFase('sin-soporte');
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: aBytes(clave) }));
      await enviarSuscripcion(sub, hora);
      setEndpoint(sub.endpoint);
      setFase('activo');
      avisar(`Recordatorio a las ${hora}`);
    } catch {
      avisar('No se pudo activar el recordatorio');
    } finally {
      setOcupado(false);
    }
  }

  async function apagar() {
    setOcupado(true);
    try {
      const sub = await (await registro())?.pushManager.getSubscription();
      if (sub) {
        await fetch('/api/recordatorio', {
          method: 'DELETE',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setEndpoint(null);
      setFase('apagado');
    } catch {
      avisar('No se pudo apagar el recordatorio');
    } finally {
      setOcupado(false);
    }
  }

  async function cambiarHora(h: string) {
    if (!/^\d\d:\d\d$/.test(h)) return;
    setHora(h);
    try {
      localStorage.setItem(CLAVE_HORA, h);
    } catch {
      // Sin almacenamiento se vuelve a la hora inicial al reabrir; el servidor guarda la buena.
    }
    try {
      const sub = await (await registro())?.pushManager.getSubscription();
      if (sub) await enviarSuscripcion(sub, h);
    } catch {
      avisar('No se pudo guardar la hora');
    }
  }

  async function probar() {
    if (!endpoint) return;
    setOcupado(true);
    try {
      const r = await fetch('/api/recordatorio/probar', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ endpoint }),
      });
      avisar(r.ok ? 'Enviado: debería llegar en unos segundos' : 'No se pudo enviar el aviso de prueba');
    } catch {
      avisar('Sin conexión: el aviso de prueba necesita red');
    } finally {
      setOcupado(false);
    }
  }

  const encendido = fase === 'activo';
  const subtitulo =
    fase === 'activo'
      ? 'Activo en este teléfono'
      : fase === 'ios-sin-instalar'
        ? 'Necesita la app en tu pantalla de inicio.'
        : fase === 'denegado'
          ? 'Bloqueado en este navegador.'
          : fase === 'sin-soporte'
            ? 'Este navegador no puede recibir avisos.'
            : 'Te escribimos a la hora que elijas si ese día aún no repasaste.';

  return (
    <>
      <p className="eyebrow">Recordatorio</p>
      <div className="recordatorio">
        <div className="rec-fila">
          <span className="rec-txt">
            <b>Aviso diario para repasar</b>
            <span className={encendido ? 'ok' : undefined}>{subtitulo}</span>
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={encendido}
            aria-label="Recordatorio diario"
            className="sw"
            disabled={ocupado || fase === 'cargando' || fase === 'sin-soporte'}
            onClick={() => (encendido ? void apagar() : void encender())}
          />
        </div>

        {encendido && (
          <>
            <div className="rec-hora">
              <label htmlFor="rec-hora">
                <b>Hora</b>
                <span>{zona()} · se ajusta sola con el cambio de horario</span>
              </label>
              <input
                id="rec-hora"
                type="time"
                value={hora}
                onChange={(e) => void cambiarHora(e.target.value)}
              />
            </div>
            <button type="button" className="pill rec-prueba" disabled={ocupado} onClick={() => void probar()}>
              Enviar uno de prueba
            </button>
          </>
        )}

        {fase === 'ios-sin-instalar' && (
          <div className="rec-aviso">
            <b>En iPhone los avisos solo llegan con la app instalada.</b>
            <ol>
              <li>Toca el botón Compartir de Safari.</li>
              <li>Elige «Añadir a pantalla de inicio».</li>
              <li>Abre la app desde ese icono y vuelve aquí.</li>
            </ol>
          </div>
        )}

        {fase === 'denegado' && (
          <div className="rec-aviso mal">
            <b>Dijiste que no a las notificaciones.</b>
            Para activarlas, permítelas para esta app en los ajustes del teléfono o del navegador y vuelve a
            encender el interruptor.
          </div>
        )}
      </div>
    </>
  );
}
