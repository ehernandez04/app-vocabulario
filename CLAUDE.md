# App Vocabulario — contexto del proyecto

App para repasar vocabulario **inglés → español** en el camino (transporte público, caminando),
con audio y modo adivinar. Usuario y dueño: Erick (`ehernandez04`). La interfaz es **en español**.

Repo: https://github.com/ehernandez04/app-vocabulario

## Estado actual

**El proyecto está migrando de una PWA local a una app con cuentas y base de datos.**
El plan vive en los milestones del repo: Etapa 0 · Cimientos, Etapa 1 · Paridad,
Etapa 2 · Cuentas, Etapa 3 · Sincronización. Verificar siempre contra los issues
(`gh issue list --state all --json number,title,milestone`), no contra este archivo.

- **`legacy/`** es la app que de verdad funciona hoy: PWA con Vite, instalable, sin
  conexión, con los tres modos, agregar palabras propias, borrar, exportar e importar.
  Se retira cuando la nueva alcance paridad (#26). **No borrarla antes.**
- **La raíz** es el proyecto nuevo: Next 16 + Tailwind 4, con la API en el mismo
  proyecto (Route Handlers), Postgres en Neon vía Prisma y Auth.js con Google.

## Cómo se corre

```
npm install && npm run dev        # la app nueva, http://localhost:3000
npm run build                     # build de producción
npm run lint
npm run legacy:dev                # la app vieja de Vite, http://localhost:5173
```

**Next 16 tiene cambios rompedores respecto a lo que el modelo sabe de memoria.**
Antes de escribir código con una API de Next, leer la guía que corresponda en
`node_modules/next/dist/docs/`. El bloque de `AGENTS.md` lo repite y lo reescribe
`next dev` en cada arranque: si aparece en el diff, se commitea junto al trabajo.

**Al probar cambios en el contenedor de legacy, el service worker sirve la versión
anterior desde caché.** Hay que desregistrarlo y borrar las cachés, o se ven cambios
fantasma. En la consola:
`for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister();
for (const k of await caches.keys()) await caches.delete(k); location.reload()`

## Decisiones ya tomadas (no volver a discutir)

- **Next.js, no vanilla.** Lo que viene —login, lista editable, revisar por lote lo que
  pegaste, dictado, estado de sincronización— es estado vivo, justo donde re-renderizar
  con `innerHTML` empieza a costar horas. Además Erick ya mantiene `mi-presupuesto` con
  Next: un solo juego de costumbres entre los dos repos.
- **La API vive dentro del mismo proyecto Next** (Route Handlers), no en un NestJS
  aparte. Son unos ocho endpoints: un servicio más en Railway costaría dinero y
  ceremonia sin ganar nada. Si algún día hacen falta trabajos largos en segundo plano o
  websockets de verdad, ahí sí vuelve a tener sentido NestJS.
- **Postgres en Neon con Prisma**, igual que `mi-presupuesto`: rama de desarrollo y rama
  de producción, y el `.env` local **siempre** a desarrollo.
- **Local-first, no solo servidor.** Postgres es la fuente de verdad; el teléfono
  mantiene una copia en IndexedDB. El caso de uso principal es repasar en el metro sin
  señal: si la app exige red, deja de servir justo donde se usa. Los conflictos se
  resuelven como ya lo hacía el import: **gana la caja más alta, nunca se retrocede lo
  aprendido.**
- **Auth.js con Google y lista blanca de correos.** Sin contraseñas, sin registro, sin
  recuperación, sin proveedor de correo. El motivo de que haya login no es la privacidad
  del vocabulario: es que **las rutas que llaman a Claude y al TTS gastan dinero** y la
  app queda expuesta a la red. La lista blanca cierra eso mejor que cualquier rate limit.
- **Cada quien su mazo y su progreso.** Las palabras de fábrica las ve todo el mundo.
- **PWA instalable, no app nativa.** Si algún día hacen falta notificaciones push fuertes
  o publicar en tiendas, se envuelve con Capacitor.
- **Hosting: Vercel.** Previews por rama y HTTPS gratis, que hace falta para instalar la
  PWA en un teléfono de verdad. GitHub Pages se descartó: sirve en un subpath y complica
  el scope del service worker.
- **El modelo para generar tarjetas es `claude-haiku-5-5`** (etapa 4). A $0.10/$0.50 por
  millón de tokens cuesta diez veces menos que Haiku 4.5, que es lo que usa el asistente de
  `mi-presupuesto`. Para traducir, sacar la fonética y escribir una frase de ejemplo sobra.
  **Dos cuidados al escribir ese código:**
  - En Haiku 5.5 el pensamiento viene **encendido por defecto** y `budget_tokens` devuelve
    400. Si no se baja con `output_config: { effort: 'low' }`, cada palabra gasta más tokens
    de salida de lo esperado y se come parte del ahorro.
  - El SVG es harina de otro costal: dibujar es más difícil que traducir. Hay que comparar
    contra un modelo mayor antes de darlo por bueno, y dejar que el usuario rechace el dibujo
    y se quede con el emoji.
- **Audio: MP3 pregenerados con una TTS neuronal**, Web Speech API solo como respaldo.
  Más allá de la calidad, los MP3 resuelven el Modo camino en iPhone: `speechSynthesis`
  se corta al bloquear la pantalla y un `<audio>` con MediaSession no. Ver
  [docs/audio.md](docs/audio.md).

## Identidad visual (respetarla al escribir código nuevo)

Viene del canvas de diseño que Erick aprobó. **Regla que mantiene la coherencia entre temas:
el post-it es un objeto físico, así que siempre es papel de color con tinta oscura
(`--on-note`, fijo en `#1C1B19`). Solo cambia el entorno de la app.**

```
Papel     #F3EFE6   Tinta       #1C1B19   Tinta suave #5E5A52
Regla     #E2DCCF   Papel-2     #EAE4D7
Post-it   #FFE066 (amarillo) · #FFB4A2 (coral) · #B8E1FF (azul) · #C8F0A8 (verde)
Acierto   #1F6F43   Fallo       #B4380B
Oscuro    papel #1A1916 · tarjeta #24231F · tinta #F3EFE6 · regla #36342E
```

- **Display:** Bricolage Grotesque 800, `letter-spacing` negativo. Es la palabra en inglés.
- **Cuerpo:** DM Sans 400/500/700.
- **Manuscrita:** Caveat 700 — **solo para el español**. Separa los dos idiomas sin etiquetas.
- Bordes de 1.5–2px en tinta con sombra dura `0 2px 0`, que se hunde al pulsar.
- La ilustración de cada palabra se trata como una **pegatina** sobre la nota: recuadro con
  borde discontinuo, girado unos grados.

Los tokens viven en `app/globals.css`, también expuestos como utilidades de Tailwind
(`bg-paper`, `text-ink`, `bg-note-3`, `shadow-lift`…). Las tres tipografías se cargan con
`next/font/google` en `app/layout.tsx`.

**El tema claro no es negociable como punto de partida.** La app usa `data-skin="dark"`, un
atributo propio, y **no** `prefers-color-scheme` ni `data-theme`. Esto es deliberado: con
`data-theme` el visor de artifacts pisaba la elección de la app y la mostraba oscura. El botón
de la pantalla de Inicio es quien manda.

## Modelo de datos

En Postgres (Prisma), a partir de la etapa 2:

```
User      id, email, name, createdAt
Word      id, userId?, en, ipa, es, xe, xs, emoji, svg, audioEn, audioEs
Progress  userId, wordId, box, due, seen, miss, updatedAt   @@unique([userId, wordId])
```

`Word.userId` nulo = palabra de fábrica, visible para todos; con dueño = privada.
El SVG de la ilustración es texto y vive en su columna. Los MP3 van como `bytea`
(~20 KB cada uno); si algún día crece, se mudan a almacenamiento de objetos.

En el teléfono, como copia local para repasar sin señal (y hoy, en `legacy/`, como
único almacén):

```js
// una palabra
{ "en": "the way", "ipa": "/ðə weɪ/", "es": "el camino", "emoji": "🛣️",
  "xe": "I listen to podcasts on the way to work.",
  "xs": "Escucho pódcasts de camino al trabajo." }

// IndexedDB, almacén `progress`, clave = la palabra en inglés
{ box: 1..5, due: "2026-10-10", seen: 0, miss: 0 }
```

El color de post-it **no** se guarda: sale de la posición en el mazo (`noteColor`).
Si una palabra trae `img`, se usa esa imagen en lugar del emoji.

**Repetición espaciada (Leitner, 5 cajas).** Intervalos en días: `[1, 2, 4, 8, 16]`.
Acierto → sube una caja. Fallo → vuelve a la caja 1. `due = hoy + intervalo[caja]`.
La sesión se arma con lo vencido (`due <= hoy`), caja más baja primero, máximo 20.

**Las fechas son locales, nunca UTC.** `srs.today()` existe justamente para eso: a las 11 de la
noche en México `toISOString()` ya devuelve el día siguiente, lo que adelantaría los repasos y
rompería la racha. Y `daysBetween` compara días de calendario, no bloques de 24 h, para
sobrevivir al cambio de horario.

## Los tres modos

1. **Tarjetas** — post-it con palabra, fonética, pegatina y audio. Se arrastra a la izquierda
   para "otra vez" y a la derecha para "lo sabía"; también hay botones.
2. **Adivinar** — cuatro traducciones. Interruptor "Solo audio" que oculta la palabra escrita.
   La ilustración aparece **después** de responder, para no regalar la respuesta.
3. **Modo camino** — manos libres, la pieza central. Bucle automático: inglés → pausa
   configurable (3/5/8 s) con cuenta atrás visible → español → siguiente. Opción de oír el
   ejemplo. Usa MediaSession para la pantalla de bloqueo y los auriculares.

## Trampas conocidas

**Web Speech API**
- Las voces cargan en asíncrono: hay que escuchar `voiceschanged` y no fiarse del primer
  `getVoices()`.
- El audio solo arranca después de que el usuario toque algo. Nada de autoplay al cargar.
- Para encadenar frases hay que usar `utterance.onend` **más** un `setTimeout` de red de
  seguridad: `onend` a veces no se dispara y dejaría el bucle colgado.
- El primer `en-US` de la lista suele ser el peor. `audio.rankVoice()` puntúa y descarta las
  voces de novedad de macOS (Bad News, Bubbles, Zarvox…) y las "compact".
- iOS corta la síntesis al bloquear la pantalla. Por eso los MP3.

**Dictado por voz (etapa 4)**
- `SpeechRecognition` en iPhone es poco confiable, justo donde se va a usar. El dictado va
  con `MediaRecorder` y transcripción en el servidor; necesita conexión, a diferencia del
  repaso.

**Maquetación**
- La tarjeta de Tarjetas **manda la altura**: va en flujo normal y el área del mazo crece con
  ella. Si se vuelve a poner `position:absolute` con `inset:0`, al revelar la traducción el
  texto se recorta.
- La vista del Modo camino **no** lleva márgenes negativos. El fondo oscuro ya ocupa todo el
  ancho de la vista, y los márgenes negativos se comían el gutter lateral.
- La palabra en inglés usa `clamp()` con `vw` para que "overwhelming" o "nevertheless" se
  encojan en vez de partirse a mitad de palabra.

**Español**
- Cuidado con la concordancia en singular. Ya mordió dos veces: "1 palabra te **esperan**" y
  "1 palabra**s** y 1 avance**s**". Hay un ayudante `plural(n, 'palabra')`; para frases con
  verbo hay que escribir las dos variantes a mano.

**Ilustraciones generadas**
- Claude dibuja bien un reloj o una puerta; "sin embargo" o "abrumador" no tienen dibujo
  obvio y puede salir cualquier cosa. El usuario tiene que poder rechazar el SVG y quedarse
  con el emoji. No fingir que siempre acierta.

## Archivos

```
app/                    vistas y Route Handlers del proyecto nuevo
app/layout.tsx          las tres tipografías y data-skin
app/globals.css         tokens de color, tipografía y base
prisma/                 schema y migraciones (desde la etapa 0, #19)
legacy/                 la PWA de Vite que funciona hoy; se retira en #26
legacy/src/main.js      estado, render y eventos de la app vieja
legacy/src/lib/srs.js   cajas Leitner, fechas locales, racha — se porta en #21
legacy/src/lib/store.js IndexedDB
legacy/src/lib/audio.js elección de voz, MP3 con respaldo a síntesis, MediaSession
legacy/scripts/         iconos, generación de audio, artifact
docs/audio.md           por qué los MP3 y cómo se generan
design-ref/             las 4 pantallas del canvas original, solo consulta
```

`design-ref/` **no se puede desplegar**: usa el runtime del canvas (`<x-dc>`, `{{...}}`,
`sc-if`, `DCLogic`), no es web estándar.

## Artifact publicado

https://claude.ai/artifact/CWTWbBoeZwCmkrXQsd8HXJ — se generaba desde el build de Vite con
`npm run artifact`, que ahora vive en `legacy/`. No lleva service worker: los artifacts no
los permiten.

## Convenciones

- Los commits y los issues van **en español**.
- Rama por defecto: `main`. Una rama por issue, con el número al final
  (ej. `etapa-0/next-y-legacy-17`).
- Los issues nuevos llevan milestone de etapa.
