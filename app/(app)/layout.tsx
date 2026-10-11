import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { Tabbar } from '@/components/Tabbar';
import { Toast } from '@/components/Toast';
import { ProveedorEstado } from '../estado';

/**
 * El armazón de la app, solo para quien tiene sesión.
 *
 * El guardia está acá y no en un middleware a propósito: así la comprobación
 * ocurre del lado del servidor, en el mismo sitio donde se arma la pantalla, y
 * no hay forma de que una vista se pinte un instante antes de redirigir.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect('/entrar');

  return (
    <ProveedorEstado
      usuario={{
        nombre: session.user.name ?? null,
        correo: session.user.email ?? null,
        foto: session.user.image ?? null,
      }}
    >
      <Toast />
      <main className="views">{children}</main>
      <Tabbar />
    </ProveedorEstado>
  );
}
