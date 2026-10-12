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
 *   lists     listas cambiadas: `{id, name, words (textos en inglés), base, borrada?}`.
 *             El id lo genera el teléfono. Se sube la lista entera, no el cambio.
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
import { instante, lista as sanearLista, palabra, progreso, racha as sanearRacha, texto, type ListaEntrada, type PalabraEntrada, type ProgresoEntrada } from '@/lib/entrada';
import { fusionarRacha, igualLista, igualProgreso, resolverLista, resolverProgreso } from '@/lib/fusion';
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
  const crudasListas = Array.isArray(cuerpo.lists) ? cuerpo.lists : [];
  if (crudasPalabras.length > MAX || crudoProgreso.length > MAX || crudasListas.length > MAX) {
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

  // ── listas ──────────────────────────────────────────────────────────────
  // Se resuelven con el mismo criterio que el avance (ver lib/fusion.resolverLista).
  // Una lista nueva cuyo nombre ya existe en la cuenta se funde con ella en vez de
  // duplicarse: así dos teléfonos que sembraron «Básicas» cada uno acaban con una.
  type Guardada = { name: string; words: string[]; updatedAt: Date; deletedAt: Date | null };
  const entrantesListas = new Map<string, ListaEntrada>();
  for (const c of crudasListas) {
    const l = sanearLista(c);
    if (!l) omitidos++;
    else entrantesListas.set(l.id, l);
  }

  const guardadas = new Map<string, Guardada>();
  const reasignadas: Record<string, string> = {};
  const opsListas = [];
  const tocadas = new Set<string>();
  if (entrantesListas.size) {
    const filas = await prisma.list.findMany({
      where: { userId },
      select: { id: true, name: true, updatedAt: true, deletedAt: true, words: { select: { word: { select: { en: true } } } } },
    });
    for (const f of filas) {
      guardadas.set(f.id, { name: f.name, words: f.words.map((x) => x.word.en), updatedAt: f.updatedAt, deletedAt: f.deletedAt });
    }
    // Un id que ya pertenece a otra cuenta no se toca.
    const ajenos = new Set(
      (
        await prisma.list.findMany({
          where: { id: { in: [...entrantesListas.keys()].filter((id) => !guardadas.has(id)) }, NOT: { userId } },
          select: { id: true },
        })
      ).map((x) => x.id)
    );

    // También las palabras que la lista ya tiene: al unir dos versiones hay que
    // poder volver a escribirlas, no solo las que llegan.
    const nombres = [
      ...new Set([
        ...[...entrantesListas.values()].flatMap((l) => l.words),
        ...[...guardadas.values()].flatMap((g) => g.words),
      ]),
    ];
    const idPalabra = new Map<string, string>();
    if (nombres.length) {
      const palabras = await prisma.word.findMany({
        where: { en: { in: nombres }, deletedAt: null, OR: [{ userId: null }, { userId }] },
        select: { id: true, en: true, userId: true },
      });
      for (const f of palabras) if (f.userId === null || !idPalabra.has(f.en)) idPalabra.set(f.en, f.id);
    }

    for (const l of entrantesListas.values()) {
      if (ajenos.has(l.id)) {
        omitidos++;
        continue;
      }
      if (l.borrada) {
        const g = guardadas.get(l.id);
        if (g && !g.deletedAt) {
          opsListas.push(prisma.list.update({ where: { id: l.id }, data: { deletedAt: new Date() } }));
          tocadas.add(l.id);
        }
        continue;
      }
      // ¿A cuál fila corresponde? Por id; si es nueva, por nombre entre las vivas.
      let destino = l.id;
      let previa = guardadas.get(l.id);
      if (!previa) {
        const igualNombre = [...guardadas.entries()].find(
          ([, g]) => !g.deletedAt && g.name.toLowerCase() === l.name.toLowerCase()
        );
        if (igualNombre) {
          destino = igualNombre[0];
          previa = igualNombre[1];
          reasignadas[l.id] = destino;
        }
      }
      const { lista: final } = resolverLista(
        previa ? { lista: { name: previa.name, words: previa.words }, actualizado: previa.updatedAt, borrada: !!previa.deletedAt } : null,
        { name: l.name, words: l.words.filter((en) => idPalabra.has(en)) },
        previa && destino === l.id ? l.base : null
      );
      tocadas.add(destino);
      if (previa && !previa.deletedAt && igualLista(previa, final)) continue; // nada cambia: no se sube la versión

      const ids = final.words.map((en) => idPalabra.get(en)).filter((x): x is string => !!x);
      if (!previa) {
        opsListas.push(
          prisma.list.create({
            data: { id: destino, userId, name: final.name, words: { create: ids.map((wordId) => ({ wordId })) } },
          })
        );
      } else {
        opsListas.push(
          prisma.list.update({ where: { id: destino }, data: { name: final.name, deletedAt: null } }),
          prisma.listWord.deleteMany({ where: { listId: destino } }),
          ...(ids.length ? [prisma.listWord.createMany({ data: ids.map((wordId) => ({ listId: destino, wordId })) })] : [])
        );
      }
      guardadas.set(destino, { name: final.name, words: final.words, updatedAt: new Date(), deletedAt: null });
    }
  }

  const sanea = sanearRacha(cuerpo.streak, cuerpo.lastDay);
  const fusionada = fusionarRacha({ streak: usuario.streak, lastDay: usuario.lastDay }, sanea);

  await prisma.$transaction([
    ...(crear.length ? [prisma.progress.createMany({ data: crear, skipDuplicates: true })] : []),
    ...actualizar,
    prisma.user.update({ where: { id: userId }, data: fusionada }),
    ...opsListas,
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

  const listasNuevas = await prisma.list.findMany({
    where: {
      userId,
      OR: [
        ventana ? { updatedAt: { gte: ventana } } : { deletedAt: null },
        { id: { in: [...tocadas] } },
      ],
    },
    select: {
      id: true,
      name: true,
      createdAt: true,
      updatedAt: true,
      deletedAt: true,
      words: { select: { word: { select: { en: true } } } },
    },
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
    lists: listasNuevas.map((l) => ({
      id: l.id,
      name: l.name,
      words: l.words.map((x) => x.word.en),
      createdAt: l.createdAt.toISOString(),
      version: l.updatedAt.toISOString(),
      borrada: l.deletedAt !== null,
    })),
    reasignadas,
    streak: fusionada.streak,
    lastDay: fusionada.lastDay,
    choques,
    omitidos,
  });
}
