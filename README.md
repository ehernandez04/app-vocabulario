# Vocabulario en Ruta

App para repasar vocabulario **inglés → español** en el camino, con audio y repetición
espaciada. Pensada para usarse con una mano en el transporte público — o sin manos, con los
auriculares puestos y el teléfono en el bolsillo.

Es una **PWA instalable**: se abre en el navegador, se agrega a la pantalla de inicio y
funciona sin conexión.

> **El proyecto está en migración.** La app que funciona hoy vive en [`legacy/`](legacy/)
> —la PWA de Vite, local y sin cuentas— y la raíz es la versión nueva con Next, cuentas y
> base de datos. El plan va por etapas en los milestones del repo. `legacy/` se retira
> cuando la nueva alcance paridad.

## Empezar

```bash
npm install
npm run dev          # la app nueva, http://localhost:3000
npm run legacy:dev   # la app vieja de Vite, http://localhost:5173
```

La vieja también corre con Docker, sin instalar nada más:

```bash
cd legacy
docker compose --profile dev up      # desarrollo con recarga en caliente, :5173
docker compose up -d web             # producción con nginx, :8080
```

## Los tres modos

**Tarjetas** — La palabra en inglés sobre un post-it, con su fonética, su ilustración y su
audio. Piensas la traducción, la descubres y te calificas. Arrastra la tarjeta a la izquierda
para "otra vez" o a la derecha para "lo sabía".

**Adivinar** — Cuatro traducciones, sin teclado. Lleva un interruptor *Solo audio* que esconde
la palabra escrita, para ir caminando.

**Modo camino** — Manos libres. Oyes la palabra en inglés, tienes 3, 5 u 8 segundos para
pensarla, y llega la respuesta en español. Encadena solo, con el teléfono guardado, y se
controla desde los auriculares.

## Tu propio mazo

Vienen 20 palabras de fábrica, pero puedes agregar las tuyas desde la pantalla de Inicio:
inglés, español, un emoji como ilustración y, si quieres, la fonética y una frase de ejemplo.
Entran en la caja 1, así que las ves el mismo día.

También puedes exportar el mazo con tu progreso y volver a importarlo en otro teléfono. Al
importar eliges fusionar —que conserva lo tuyo y se queda con la caja más alta, así nunca
retrocedes— o reemplazar.

## Cómo repasa

Cinco cajas, estilo Leitner. Cada palabra sube una caja cuando la aciertas y vuelve a la 1
cuando falla. Los intervalos son de 1, 2, 4, 8 y 16 días, y la sesión del día se arma con lo
que toca repasar, empezando por las cajas más bajas.

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | La app nueva, en :3000 |
| `npm run build` | Build de producción |
| `npm run lint` | ESLint |
| `npm run legacy:dev` | La app vieja de Vite, en :5173 |

Dentro de `legacy/` siguen estando `npm run icons`, `npm run audio` y `npm run artifact`.

## Stack

**La app nueva:** Next 16 con el App Router, Tailwind 4, y la API en el mismo proyecto
—sin servicio aparte—. Postgres en Neon con Prisma, y Auth.js con Google para entrar.
El progreso se guarda en el servidor, pero el teléfono mantiene una copia en IndexedDB:
la idea es poder repasar en el metro sin señal y sincronizar al salir.

**La app vieja (`legacy/`):** vanilla HTML + CSS + JS con Vite y Workbox, unos 30 KB de
JavaScript, sin backend ni cuentas.

## Documentación

- [CLAUDE.md](CLAUDE.md) — contexto completo: decisiones tomadas, identidad visual, modelo de
  datos y trampas conocidas. **Empieza por aquí.**
- [docs/audio.md](docs/audio.md) — por qué la voz del navegador suena mal y cómo se arregla.
- [docs/design-notes.md](docs/design-notes.md) — de dónde viene el diseño y qué se cambió.
- [design-ref/](design-ref/) — las cuatro pantallas del canvas original, solo como referencia.
