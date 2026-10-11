/**
 * Entrar con Google.
 *
 * No hay registro ni contraseñas: Google dice quién sos y una lista blanca
 * decide si pasás. El motivo de que haya login no es la privacidad del
 * vocabulario —si alguien ve que estás aprendiendo "overwhelming", no pasa
 * nada—: es que las rutas que llaman a Claude y al TTS **gastan dinero**, y la
 * app está expuesta en internet. La lista blanca cierra eso mejor que
 * cualquier límite por IP.
 *
 * La sesión va en una cookie firmada (JWT), no en la base: así no hace falta
 * una consulta por cada petición. El usuario sí se guarda, porque sus palabras
 * y su progreso cuelgan de él.
 */

import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import { prisma } from '@/lib/prisma';

/** Los correos que pueden entrar, separados por coma en CORREOS_PERMITIDOS. */
function permitidos(): string[] {
  return (process.env.CORREOS_PERMITIDOS ?? '')
    .split(',')
    .map((c) => c.trim().toLowerCase())
    .filter(Boolean);
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google],
  pages: {
    signIn: '/entrar',
    error: '/entrar',
  },
  callbacks: {
    async signIn({ profile }) {
      const correo = profile?.email?.toLowerCase();
      if (!profile || !correo) return false;

      // Lista vacía = nadie entra. Preferible a que un despliegue sin la
      // variable deje la app abierta de par en par sin que nadie se entere.
      const lista = permitidos();
      if (!lista.includes(correo)) return '/sin-acceso';

      // El usuario se crea la primera vez y después solo se refresca el
      // nombre y la foto, que Google puede cambiar.
      await prisma.user.upsert({
        where: { email: correo },
        create: {
          email: correo,
          name: profile.name ?? null,
          image: typeof profile.picture === 'string' ? profile.picture : null,
        },
        update: {
          name: profile.name ?? null,
          image: typeof profile.picture === 'string' ? profile.picture : null,
        },
      });
      return true;
    },

    async jwt({ token }) {
      // El id de nuestra base viaja en el token para no consultarla en cada
      // petición. Solo se busca la primera vez, cuando todavía no está.
      if (!token.uid && token.email) {
        const u = await prisma.user.findUnique({
          where: { email: token.email.toLowerCase() },
          select: { id: true },
        });
        if (u) token.uid = u.id;
      }
      return token;
    },

    async session({ session, token }) {
      if (token.uid) session.user.id = token.uid as string;
      return session;
    },
  },
});
