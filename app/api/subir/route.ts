/**
 * Sube a la cuenta lo que había en este teléfono antes de tener cuenta.
 *
 * Es aditivo y se puede repetir sin daño: las palabras se crean solo si faltan
 * y el progreso se fusiona con la regla de siempre (gana la caja más alta, nunca
 * se retrocede lo aprendido). Por eso reintentar tras un fallo a medias es
 * seguro, y por eso no hay nada que borrar: el servidor nunca quita nada.
 *
 * Todo lo que llega es input de un cliente, así que se sanea antes de tocar la
 * base. La sesión decide de quién es el avance; el cuerpo nunca trae un id.
 */

import { auth } from '@/auth';
import { fusionarProgreso, fusionarRacha, igualProgreso } from '@/lib/fusion';
import { prisma } from '@/lib/prisma';
import { BOXES } from '@/lib/srs';

const MAX_PALABRAS = 5000;
const FECHA = /^\d{4}-\d{2}-\d{2}$/;

type PalabraEntrada = { en: string; es: string; ipa: string; emoji: string; xe: string; xs: string };
type ProgresoEntrada = { box: number; due: string; seen: number; miss: number };

const texto = (v: unknown, max: number): string | null =>
  typeof v === 'string' ? v.trim().slice(0, max) : null;

const entero = (v: unknown, min: number, max: number): number | null =>
  typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max ? v : null;

function palabra(v: unknown): PalabraEntrada | null {
  if (!v || typeof v !== 'object') return null;
  const w = v as Record<string, unknown>;
  const en = texto(w.en, 200);
  const es = texto(w.es, 200);
  if (!en || !es) return null;
  return {
    en,
    es,
    ipa: texto(w.ipa, 200) ?? '',
    emoji: texto(w.emoji, 16) || '📝',
    xe: texto(w.xe, 500) ?? '',
    xs: texto(w.xs, 500) ?? '',
  };
}

function progreso(v: unknown): ProgresoEntrada | null {
  if (!v || typeof v !== 'object') return null;
  const p = v as Record<string, unknown>;
  const box = entero(p.box, 1, BOXES);
  const seen = entero(p.seen, 0, 1_000_000);
  const miss = entero(p.miss, 0, 1_000_000);
  if (box === null || seen === null || miss === null) return null;
  if (typeof p.due !== 'string' || !FECHA.test(p.due)) return null;
  return { box, due: p.due, seen, miss };
}

const mala = (mensaje: string) => Response.json({ error: mensaje }, { status: 400 });

export async function POST(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return Response.json({ error: 'Sin sesión' }, { status: 401 });

  // La cookie de sesión dura semanas y el id viaja en ella: puede apuntar a un
  // usuario que ya no existe (base movida o reiniciada). Sin esta comprobación
  // el fallo sería una violación de clave foránea, un 500 sin explicación.
  const usuario = await prisma.user.findUnique({
    where: { id: userId },
    select: { streak: true, lastDay: true },
  });
  if (!usuario) return Response.json({ error: 'Tu cuenta no existe: vuelve a entrar' }, { status: 401 });

  let cuerpo: Record<string, unknown>;
  try {
    cuerpo = await req.json();
  } catch {
    return mala('El cuerpo no es JSON');
  }
  if (!cuerpo || typeof cuerpo !== 'object') return mala('Formato inesperado');

  const crudas = Array.isArray(cuerpo.words) ? cuerpo.words : [];
  const crudoProgreso =
    cuerpo.progress && typeof cuerpo.progress === 'object'
      ? Object.entries(cuerpo.progress as Record<string, unknown>)
      : [];
  if (crudas.length > MAX_PALABRAS || crudoProgreso.length > MAX_PALABRAS) {
    return mala('Demasiadas palabras para una sola subida');
  }

  // Lo inválido se descarta y se cuenta, no tumba la subida entera: un registro
  // raro no debe dejar a nadie sin poder subir las otras 200 palabras.
  const palabras = new Map<string, PalabraEntrada>();
  let omitidos = 0;
  for (const c of crudas) {
    const w = palabra(c);
    if (w) palabras.set(w.en, w);
    else omitidos++;
  }
  const avances = new Map<string, ProgresoEntrada>();
  for (const [en, c] of crudoProgreso) {
    const p = progreso(c);
    if (p && en.length <= 200) avances.set(en, p);
    else omitidos++;
  }

  const racha = {
    streak: entero(cuerpo.streak, 0, 100_000) ?? 0,
    lastDay: typeof cuerpo.lastDay === 'string' && FECHA.test(cuerpo.lastDay) ? cuerpo.lastDay : null,
  };

  // 1. Las palabras propias que falten. skipDuplicates cubre la unicidad
  //    [userId, en]: repetir la subida no las duplica.
  const creadas = palabras.size
    ? await prisma.word.createMany({
        data: [...palabras.values()].map((w) => ({ userId, ...w })),
        skipDuplicates: true,
      })
    : { count: 0 };

  // 2. El progreso cuelga de una palabra, que puede ser de fábrica o tuya. El
  //    progreso se guarda por texto en inglés en el teléfono, así que hay que
  //    resolver a qué fila corresponde; si hay de las dos, gana la de fábrica,
  //    como en el mazo local.
  const claves = [...avances.keys()];
  const filas = claves.length
    ? await prisma.word.findMany({
        where: { en: { in: claves }, OR: [{ userId: null }, { userId }] },
        select: { id: true, en: true, userId: true },
      })
    : [];
  const idDe = new Map<string, string>();
  for (const f of filas) if (f.userId === null || !idDe.has(f.en)) idDe.set(f.en, f.id);

  const previos = idDe.size
    ? await prisma.progress.findMany({
        where: { userId, wordId: { in: [...idDe.values()] } },
        select: { wordId: true, box: true, due: true, seen: true, miss: true },
      })
    : [];
  const previoDe = new Map(previos.map((p) => [p.wordId, p]));

  const nuevos: { userId: string; wordId: string; box: number; due: string; seen: number; miss: number }[] = [];
  const cambios = [];
  let subidos = 0;
  for (const [en, entrante] of avances) {
    const wordId = idDe.get(en);
    if (!wordId) {
      omitidos++; // progreso de una palabra que no está en ninguna parte
      continue;
    }
    const previo = previoDe.get(wordId);
    const fusion = fusionarProgreso(previo, entrante);
    if (!previo) {
      nuevos.push({ userId, wordId, ...fusion });
      subidos++;
    } else if (!igualProgreso(previo, fusion)) {
      cambios.push(
        prisma.progress.update({ where: { userId_wordId: { userId, wordId } }, data: fusion })
      );
      subidos++;
    }
  }

  // 3. Progreso y racha juntos: o entra todo o no entra nada.
  const fusionada = fusionarRacha({ streak: usuario.streak, lastDay: usuario.lastDay }, racha);

  await prisma.$transaction([
    ...(nuevos.length ? [prisma.progress.createMany({ data: nuevos, skipDuplicates: true })] : []),
    ...cambios,
    prisma.user.update({ where: { id: userId }, data: fusionada }),
  ]);

  return Response.json({ palabras: creadas.count, avances: subidos, omitidos });
}
