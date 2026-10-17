import { signOut } from '@/auth';

/**
 * Cuando el correo no está en la lista blanca.
 *
 * Casi nadie la verá, pero sin ella quien llegue se topa con un error en
 * blanco y no sabe si se rompió la app o si es él. Dice qué pasó y qué hacer.
 *
 * A propósito **no** se muestra el correo con el que entró: lo sabe quien
 * acaba de usarlo, y cualquier otro que llegue a esta URL no tiene por qué
 * enterarse de nada.
 */
export default function SinAcceso() {
  return (
    <section className="view entrada">
      <div className="block">
        <p className="eyebrow">Paso a Paso</p>
        <h1 className="h1">
          Esta cuenta
          <br />
          no tiene acceso
        </h1>
      </div>

      <div className="entrada-aviso">
        <div className="note" style={{ '--note': '#FF8FC5' } as React.CSSProperties}>
          <p>
            La app es privada: solo entran los correos autorizados. Si crees que el tuyo
            debería estar, pídeselo a Erick y vuelve a intentarlo.
          </p>
        </div>
      </div>

      <form
        action={async () => {
          'use server';
          await signOut({ redirectTo: '/entrar' });
        }}
      >
        <button type="submit" className="btn solid wide">
          Salir y probar con otra cuenta
        </button>
      </form>

      <p className="muted sm center">No se guardó nada de esta cuenta.</p>
    </section>
  );
}
