# App Vocabulario

App para repasar vocabulario **inglés → español** en el camino, con audio y modo adivinar.
Pensada para usarse con una mano en el transporte público — o sin manos, con los auriculares
puestos y el teléfono en el bolsillo.

Será una **PWA instalable**: se abre en el navegador, se agrega a la pantalla de inicio y
funciona sin conexión.

## Estado

**Prototipo.** `prototype/index.html` es un solo archivo HTML que ya funciona: audio real,
los tres modos y las cinco cajas de repaso guardando el progreso en el dispositivo.
Ábrelo en el navegador y pruébalo.

La app con Vite, manifest y service worker está por construirse. Las tareas están en los
[issues](https://github.com/ehernandez04/app-vocabulario/issues).

## Los tres modos

**Tarjetas** — La palabra en inglés sobre un post-it, con su fonética y su audio. Piensas la
traducción, la descubres y te califcas. Arrastra la tarjeta a la izquierda para "otra vez" o a
la derecha para "lo sabía".

**Adivinar** — Cuatro traducciones, sin teclado. Lleva un interruptor *Solo audio* que esconde
la palabra escrita, para ir caminando.

**Modo camino** — Manos libres. Oyes la palabra en inglés, tienes 3, 5 u 8 segundos para
pensarla, y llega la respuesta en español. Encadena solo, con el teléfono guardado.

## Cómo repasa

Cinco cajas, estilo Leitner. Cada palabra sube una caja cuando la aciertas y vuelve a la 1
cuando falla. Los intervalos son de 1, 2, 4, 8 y 16 días, y la sesión del día se arma con lo
que toca repasar, empezando por las cajas más bajas.

## Documentación

- [CLAUDE.md](CLAUDE.md) — contexto completo del proyecto: decisiones tomadas, identidad
  visual, modelo de datos y trampas conocidas.
- [docs/audio.md](docs/audio.md) — por qué la voz del navegador suena mal y cómo se arregla.
- [docs/design-notes.md](docs/design-notes.md) — de dónde viene el diseño y qué se cambió.
- [design-ref/](design-ref/) — las cuatro pantallas del canvas original, solo como referencia.

## Stack previsto

Vanilla HTML + CSS + JS con Vite, Workbox para el service worker, y despliegue en Vercel.
Sin framework: la app es pequeña y así queda ligera. Sin backend: el progreso vive en el
dispositivo.
