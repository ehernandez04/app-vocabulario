/**
 * El cliente de Prisma, uno solo para toda la app.
 *
 * Prisma 7 ya no se conecta por su cuenta: hay que darle un adaptador. Usamos
 * el de Neon, que habla por HTTP en vez de abrir una conexión TCP. En un
 * entorno sin servidor como el nuestro —rutas de Next en Vercel— eso evita que
 * la primera petición tras un rato sin uso cargue con el costo de levantar la
 * conexión. La contra es que ata un poco más el proyecto a Neon; si algún día
 * estorba, se cambia por `@prisma/adapter-pg` apuntando al endpoint con pooler.
 *
 * En desarrollo se guarda en `globalThis` porque la recarga en caliente de Next
 * reevalúa los módulos y, sin esto, cada cambio dejaría otro cliente abierto.
 */

import { PrismaNeon } from '@prisma/adapter-neon';
import { PrismaClient } from './generated/prisma/client';

const crear = () =>
  new PrismaClient({
    adapter: new PrismaNeon({ connectionString: process.env.DATABASE_URL }),
  });

const global = globalThis as unknown as { prisma?: ReturnType<typeof crear> };

export const prisma = global.prisma ?? crear();

if (process.env.NODE_ENV !== 'production') global.prisma = prisma;
