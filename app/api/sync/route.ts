/**
 * Sincronización: sube lo que cambió en el teléfono y baja lo que cambió en la
 * cuenta, en un solo viaje.
 *
 * Postgres es la fuente de verdad; el teléfono es una copia. Cada petición es
 * idempotente: repetirla (porque se cortó la señal a mitad, o porque se cerró
 * la app) no duplica ni retrocede nada.
 *
 * Petición:
 *   desde     cursor que devolvió la sincronización anterior (null = la primera)
 *   words     palabras propias nuevas o borradas desde entonces
 *   progress  avance cambiado; `base` es la versión del servidor que el teléfono
 *             vio por última vez para esa palabra (null si nunca la vio)
 *   streak, lastDay
 *
 * Respuesta: lo que cambió en el servidor desde `desde`, más el estado final de
 * todo lo que se subió (el teléfono necesita su nueva `version`), y un cursor
 * nuevo.
 *
 * Los conflictos se deciden por versión (ver lib/fusion.resolverProgreso).
 *
 * Solo viajan las palabras propias. Las de fábrica ya están en el teléfono,
 * dentro de la app; su progreso sí viaja.
 */

import { auth } from '@/auth';
import { instante, palabra, progreso, racha as sanearRacha, texto, type PalabraEntrada, type ProgresoEntrada } from '@/lib/entrada';
import { fusionarRacha, igualProgreso, resolverProgreso } from '@/lib/fusion';
import { prisma } from '@/lib/prisma';

const MAX = 5000;

/**
 * Margen al pedir cambios. Un registro que se confirma después de otro puede
 * llevar una fecha anterior al cursor, y sin margen no se bajaría nunca. Bajar
 * de más es inocuo —aplicar un cambio dos veces da lo mismo—; bajar de menos
 * pierde datos.
 */
const MARGEN_MS = 5000;

const mala = (mensaje: string) => Response.json({ error: mensaje }, { status: 400 });

export async function POST(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return Response.json({ error: 'Sin sesión' }, { status: 401 });

  // El cursor se toma antes de leer nada: lo que se escriba mientras tanto
  // quedará dentro de la ventana de la próxima sincronización.
  const cursor = new Date();

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
  if (!cuerpo || typeof cuerpo !== 'object' || Array.isArray(cuerpo)) return mala('Formato inesperado');

  const crudasPalabras = Array.isArray(cuerpo.words) ? cuerpo.words : [];
  const crudoProgreso = Array.isArray(cuerpo.progress) ? cuerpo.progress : [];
  if (crudasPalabras.length > MAX || crudoProgreso.length > MAX) {
    return mala('Demasiados cambios para una sola sincronización');
  }

  const desde = instante(cuerpo.desde);
  const ventana = desde ? new Date(desde.getTime() - MARGEN_MS) : null;
  let omitidos = 0;

  // ── palabras ────────────────────────────────────────────────────────────
  const vivas = new Map<string, PalabraEntrada>();
  const borradas = new Set<string>();
  for (const c of crudasPalabras) {
    const w = palabra(c);
    if (!w) {
      omitidos++;
      continue;
    }
    if ((c as Record<string, unknown>).borrada === true) {
      borradas.add(w.en);
      vivas.delete(w.en);
    } else if (!borradas.has(w.en)) {
      vivas.set(w.en, w);
    }
  }

  if (vivas.size) {
    const existentes = await prisma.word.findMany({
      where: { userId, en: { in: [...vivas.keys()] } },
      select: { en: true, deletedAt: true },
    });
    const yaEsta = new Map(existentes.map((e) => [e.en, e]));
    const nuevas = [...vivas.values()].filter((w) => !yaEsta.has(w.en));
    // Una palabra marcada como borrada que vuelve a llegar viva: quien la
    // agregó de nuevo manda, así que se «des-borra».
    const resucitar = [...vivas.values()].filter((w) => yaEsta.get(w.en)?.deletedAt);
    await prisma.$transaction([
      ...(nuevas.length
        ? [prisma.word.createMany({ data: nuevas.map((w) => ({ userId, ...w })), skipDuplicates: true })]
        : []),
      ...resucitar.map((w) =>
        prisma.word.update({ where: { userId_en: { userId, en: w.en } }, data: { ...w, deletedAt: null } })
      ),
    ]);
  }
  if (borradas.size) {
    await prisma.word.updateMany({
      where: { userId, en: { in: [...borradas] }, deletedAt: null },
      data: { deletedAt: new Date() },
    });
  }

  // ── progreso ────────────────────────────────────────────────────────────
  const entrantes = new Map<string, { p: ProgresoEntrada; base: Date | null }>();
  for (const c of crudoProgreso) {
    const en = texto((c as Record<string, unknown>)?.en, 200);
    const p = progreso(c);
    if (!en || !p) {
      omitidos++;
      continue;
    }
    entrantes.set(en, { p, base: instante((c as Record<string, unknown>).base) });
  }

  // El progreso se guarda por texto en inglés en el teléfono: hay que resolver
  // a qué fila corresponde. Si hay de fábrica y propia, gana la de fábrica,
  // como en el mazo local. Las palabras borradas no reciben progreso.
  const idDe = new Map<string, string>();
  if (entrantes.size) {
    const filas = await prisma.word.findMany({
      where: { en: { in: [...entrantes.keys()] }, deletedAt: null, OR: [{ userId: null }, { userId }] },
      select: { id: true, en: true, userId: true },
    });
    for (const f of filas) if (f.userId === null || !idDe.has(f.en)) idDe.set(f.en, f.id);
  }

  const previos = idDe.size
    ? await prisma.progress.findMany({
        where: { userId, wordId: { in: [...idDe.values()] } },
        select: { wordId: true, box: true, due: true, seen: true, miss: true, updatedAt: true },
      })
    : [];
  const previoDe = new Map(previos.map((p) => [p.wordId, p]));

  const crear: { userId: string; wordId: string; box: number; due: string; seen: number; miss: number }[] = [];
  const actualizar = [];
  let choques = 0;
  for (const [en, { p, base }] of entrantes) {
    const wordId = idDe.get(en);
    if (!wordId) {
      omitidos++;
      continue;
    }
    const previo = previoDe.get(wordId);
    const { progreso: final, choque } = resolverProgreso(
      previo ? { progreso: previo, actualizado: previo.updatedAt } : null,
      p,
      base
    );
    if (choque) choques++;
    if (!previo) crear.push({ userId, wordId, ...final });
    else if (!igualProgreso(previo, final)) {
      actualizar.push(
        prisma.progress.update({ where: { userId_wordId: { userId, wordId } }, data: final })
      );
    }
  }

  const sanea = sanearRacha(cuerpo.streak, cuerpo.lastDay);
  const fusionada = fusionarRacha({ streak: usuario.streak, lastDay: usuario.lastDay }, sanea);

  await prisma.$transaction([
    ...(crear.length ? [prisma.progress.createMany({ data: crear, skipDuplicates: true })] : []),
    ...actualizar,
    prisma.user.update({ where: { id: userId }, data: fusionada }),
  ]);

  // ── lo que bajo ─────────────────────────────────────────────────────────
  const subidos = [...idDe.values()];
  const palabrasNuevas = await prisma.word.findMany({
    where: {
      userId,
      // La primera vez no hace falta avisar de lo ya borrado.
      ...(ventana ? { updatedAt: { gte: ventana } } : { deletedAt: null }),
    },
    select: { en: true, es: true, ipa: true, emoji: true, xe: true, xs: true, createdAt: true, deletedAt: true },
  });
  const avance = await prisma.progress.findMany({
    where: {
      userId,
      word: { deletedAt: null },
      ...(ventana ? { OR: [{ updatedAt: { gte: ventana } }, { wordId: { in: subidos } }] } : {}),
    },
    select: { box: true, due: true, seen: true, miss: true, updatedAt: true, word: { select: { en: true } } },
  });

  return Response.json({
    cursor: cursor.toISOString(),
    words: palabrasNuevas.map(({ deletedAt, createdAt, ...w }) => ({
      ...w,
      createdAt: createdAt.toISOString(),
      borrada: deletedAt !== null,
    })),
    progress: avance.map(({ word, updatedAt, ...p }) => ({
      en: word.en,
      ...p,
      version: updatedAt.toISOString(),
    })),
    streak: fusionada.streak,
    lastDay: fusionada.lastDay,
    choques,
    omitidos,
  });
}
