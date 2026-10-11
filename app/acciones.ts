'use server';

import { signOut } from '@/auth';

/** Cerrar sesión desde un componente de cliente. */
export async function salir() {
  await signOut({ redirectTo: '/entrar' });
}
