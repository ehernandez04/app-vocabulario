/**
 * Envío de Web Push (#14). Solo en el servidor: la clave privada VAPID no sale de aquí.
 */

import webpush from 'web-push';
import { prisma } from './prisma';

export type Aviso = { titulo: string; cuerpo: string };

export const pushConfigurado = () =>
  Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);

let listo = false;
function preparar() {
  if (listo) return;
  webpush.setVapidDetails(
    'mailto:' + (process.env.VAPID_CONTACTO ?? 'soporte@app-vocabulario.vercel.app'),
    process.env.VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  );
  listo = true;
}

/**
 * Manda el aviso a un aparato. true = entregado al servicio de push. Si el
 * navegador dice que la suscripción ya no existe (404/410: se desinstaló la app
 * o se revocó el permiso) se borra, para no insistir cada día en el vacío.
 */
export async function enviar(
  sub: { id: string; endpoint: string; p256dh: string; auth: string },
  aviso: Aviso
): Promise<boolean> {
  preparar();
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify(aviso),
      { TTL: 60 * 60 * 6, urgency: 'normal' }
    );
    return true;
  } catch (e) {
    const status = (e as { statusCode?: number }).statusCode;
    if (status === 404 || status === 410) {
      await prisma.pushSub.deleteMany({ where: { id: sub.id } });
    }
    return false;
  }
}
