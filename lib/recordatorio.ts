/**
 * Cuándo toca avisar (#14). Puro, para poder probarlo: el cron y la ruta solo
 * ponen la base y el envío.
 *
 * La hora que eligió la persona es local, así que se compara en su zona
 * horaria. Es lo que hace que el aviso de las 8:30 siga siendo a las 8:30 tras
 * el cambio de horario, sin que nadie lo toque.
 */

/**
 * Cuánto después de la hora elegida sigue valiendo el aviso. El cron corre cada
 * 15 min; la holgura cubre un cron caído un rato sin mandar a mediodía un aviso
 * pedido para las 8.
 */
export const VENTANA_MIN = 60;

export const HORA_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function zonaValida(tz: unknown): tz is string {
  if (typeof tz !== 'string' || !tz || tz.length > 64) return false;
  try {
    new Intl.DateTimeFormat('en', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** El día (YYYY-MM-DD) y los minutos desde medianoche en esa zona. */
export function enZona(ahora: Date, tz: string): { dia: string; minutos: number } {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(ahora)
      .map((x) => [x.type, x.value])
  );
  return { dia: `${p.year}-${p.month}-${p.day}`, minutos: Number(p.hour) * 60 + Number(p.minute) };
}

const minutosDe = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3));

/**
 * Avisa si ya pasó la hora elegida (dentro de la ventana), si
 * hoy no se avisó ya y si hoy aún no repasó. El día se compara con `lastDay`,
 * que es la fecha local del último repaso.
 */
export function tocaAvisar(
  s: { hour: string; tz: string; lastSentDay: string | null },
  ultimoRepaso: string | null,
  ahora: Date
): boolean {
  const { dia, minutos } = enZona(ahora, s.tz);
  if (s.lastSentDay === dia) return false;
  if (ultimoRepaso === dia) return false;
  const desde = minutosDe(s.hour);
  return minutos >= desde && minutos < desde + VENTANA_MIN;
}

/** El texto del aviso. `pendientes` = palabras vencidas hoy. */
export function textoAviso(pendientes: number, racha: number): { titulo: string; cuerpo: string } {
  const palabras =
    pendientes > 0
      ? pendientes === 1
        ? 'Te espera 1 palabra.'
        : `Te esperan ${pendientes} palabras.`
      : 'Hay palabras listas para repasar.';
  const rachaTxt = racha > 1 ? ` Tu racha de ${racha} días sigue viva.` : '';
  return { titulo: 'Vocabulario', cuerpo: palabras + rachaTxt };
}
