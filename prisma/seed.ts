/**
 * Siembra las palabras de fábrica desde data/deck.json.
 *
 * Es idempotente: corrige las que cambiaron y agrega las que falten, sin
 * duplicar ni borrar nada. Así, arreglar una errata en una frase de ejemplo es
 * cambiar el JSON y volver a sembrar, sin desplegar.
 *
 * No toca las palabras de los usuarios ni el progreso de nadie.
 *
 *   pnpm seed
 *
 * Se corre con tsx, no con node a secas: el generador de Prisma 7 emite
 * TypeScript y sus imports internos van sin extensión, que Node no resuelve.
 */

import { readFile } from 'node:fs/promises';
import { prisma } from '../lib/prisma.ts';

type PalabraBase = {
  en: string;
  es: string;
  ipa?: string;
  emoji?: string;
  xe?: string;
  xs?: string;
};

async function main() {
  const deck: PalabraBase[] = JSON.parse(
    await readFile(new URL('../data/deck.json', import.meta.url), 'utf8')
  );

  let creadas = 0;
  let actualizadas = 0;

  for (const w of deck) {
    const campos = {
      es: w.es,
      ipa: w.ipa ?? '',
      emoji: w.emoji ?? '📝',
      xe: w.xe ?? '',
      xs: w.xs ?? '',
    };

    // No se puede usar upsert: la clave única de Prisma es [userId, en] y acá
    // userId es nulo, que en Postgres no choca consigo mismo. La unicidad real
    // la da el índice parcial words_en_fabrica_key.
    const existente = await prisma.word.findFirst({
      where: { userId: null, en: w.en },
      select: { id: true, ...Object.fromEntries(Object.keys(campos).map((k) => [k, true])) },
    });

    if (!existente) {
      await prisma.word.create({ data: { userId: null, en: w.en, ...campos } });
      creadas++;
      continue;
    }

    const cambio = Object.entries(campos).some(
      ([k, v]) => (existente as unknown as Record<string, unknown>)[k] !== v
    );
    if (cambio) {
      await prisma.word.update({ where: { id: existente.id }, data: campos });
      actualizadas++;
    }
  }

  const total = await prisma.word.count({ where: { userId: null } });
  console.log(`Fábrica: ${creadas} creadas, ${actualizadas} actualizadas, ${total} en total.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
