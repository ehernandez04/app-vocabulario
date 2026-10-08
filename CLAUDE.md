# App Vocabulario — contexto del proyecto

App para repasar vocabulario **inglés → español** en el camino (transporte público, caminando),
con audio y modo adivinar. Usuario y dueño: Erick (`ehernandez04`). La interfaz es **en español**.

Repo: https://github.com/ehernandez04/app-vocabulario

## Estado actual

La app **ya existe y funciona**: PWA con Vite, instalable, sin conexión, en Docker.
Verificada en el navegador: las 20 tarjetas se revelan y califican sin recortes, la
repetición espaciada persiste en IndexedDB y el bucle del Modo camino encadena bien
(inglés → cuenta atrás → español → siguiente).

Lo que falta son los issues abiertos de la fase 3 y el audio pregenerado.

## Cómo se corre

```
npm install && npm run dev        # http://localhost:5173
docker compose --profile dev up   # lo mismo, en contenedor, con recarga en caliente
docker compose up -d web          # producción con nginx en http://localhost:8080
npm run artifact                  # genera build/artifact.html para publicar como artifact
npm run icons                     # regenera los iconos de la PWA
npm run audio                     # genera los MP3 (requiere clave de API, ver docs/audio.md)
```

**Al probar cambios en el contenedor, el service worker sirve la versión anterior desde caché.**
Hay que desregistrarlo y borrar las cachés, o se ven cambios fantasma. En la consola:
`for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister();
for (const k of await caches.keys()) await caches.delete(k); location.reload()`

## Decisiones ya tomadas (no volver a discutir)

- **PWA instalable, no app nativa.** Una sola base de código. Si algún día hacen falta
  notificaciones push fuertes o publicar en tiendas, se envuelve con Capacitor.
- **Sin framework.** Vanilla HTML + CSS + JS con Vite. La app pesa ~30 KB de JS.
- **Hosting: Vercel**, por los preview deployments por rama y el HTTPS gratis (que hace falta
  para instalar la PWA en un teléfono de verdad). GitHub Pages se descartó: sirve en un subpath
  y complica el scope del service worker.
- **Sin backend.** El progreso vive en el dispositivo. La copia de seguridad es exportar JSON.
- **Audio: MP3 pregenerados con una TTS neuronal**, Web Speech API solo como respaldo.
  Erick señaló que la voz del navegador suena mal y tiene razón. Más allá de la calidad, los MP3
  resuelven el Modo camino en iPhone: `speechSynthesis` se corta al bloquear la pantalla y un
  `<audio>` con MediaSession no. Ver [docs/audio.md](docs/audio.md).
- **Una sola fuente de verdad.** `src/` es la app; el artifact se *genera* desde el mismo build
  con `npm run artifact`. No hay prototipo aparte que mantener en paralelo.

## Entornos

| Entorno | Dónde | Para qué |
|---|---|---|
| Local | `npm run dev` → :5173 | Desarrollo. El service worker **sí** funciona en localhost. |
| Docker dev | `docker compose --profile dev up` → :5173 | Lo mismo sin instalar Node en la máquina. |
| Docker prod | `docker compose up -d web` → :8080 | nginx sirviendo el build, igual que en producción. |
| Preview | Vercel, una URL por rama y PR | Probar en el celular real; instalar una PWA exige HTTPS. |
| Producción | `main` → `*.vercel.app` | La app del día a día. |

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

**El tema claro no es negociable como punto de partida.** La app usa `data-skin="dark"`, un
atributo propio, y **no** `prefers-color-scheme` ni `data-theme`. Esto es deliberado: con
`data-theme` el visor de artifacts pisaba la elección de la app y la mostraba oscura. El botón
de la pantalla de Inicio es quien manda.

## Modelo de datos

```js
// src/data/deck.json — una palabra
{ "en": "the way", "ipa": "/ðə weɪ/", "es": "el camino", "emoji": "🛣️",
  "xe": "I listen to podcasts on the way to work.",
  "xs": "Escucho pódcasts de camino al trabajo." }

// IndexedDB, almacén `progress`, clave = la palabra en inglés
{ box: 1..5, due: "2026-10-10", seen: 0, miss: 0 }
```

El color de post-it **no** se guarda: sale de la posición en el mazo (`noteColor`).
Si una palabra trae `img`, se usa esa imagen en lugar del emoji — así se puede pasar a
fotos reales sin tocar el código de las vistas.

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

**Maquetación**
- La tarjeta de Tarjetas **manda la altura**: `#live` va en flujo normal y `.deckarea` crece con
  ella. Si se vuelve a poner `position:absolute` con `inset:0`, al revelar la traducción el
  texto se recorta.
- `.view.camino` **no** lleva márgenes negativos. El fondo oscuro ya ocupa todo el ancho de la
  vista, y los márgenes negativos se comían el gutter lateral.
- `.en` usa `clamp()` con `vw` para que "overwhelming" o "nevertheless" se encojan en vez de
  partirse a mitad de palabra.

## Archivos

```
index.html              entrada de Vite
src/main.js             estado, render y eventos
src/styles.css          todos los tokens y estilos
src/data/deck.json      el mazo (20 palabras)
src/lib/srs.js          cajas Leitner, fechas locales, racha
src/lib/store.js        IndexedDB + migración desde el localStorage del prototipo viejo
src/lib/audio.js        elección de voz, MP3 con respaldo a síntesis, MediaSession
src/lib/ui.js           iconos, escape, colores de nota, pegatina, aviso emergente
src/views/*.js          una vista por modo
scripts/make-icons.py   genera los PNG del icono sin dependencias
scripts/generate-audio.mjs  genera los MP3 con OpenAI o ElevenLabs
scripts/make-artifact.mjs   empaqueta dist/ en un HTML suelto para el artifact
design-ref/             las 4 pantallas del canvas original, solo consulta
```

`design-ref/` **no se puede desplegar**: usa el runtime del canvas (`<x-dc>`, `{{...}}`,
`sc-if`, `DCLogic`), no es web estándar.

## Artifact publicado

https://claude.ai/artifact/CWTWbBoeZwCmkrXQsd8HXJ — se regenera con `npm run artifact`
y se republica a esa misma URL. No lleva service worker: los artifacts no los permiten.

## Convenciones

- Los commits y los issues van **en español**.
- Rama por defecto: `main`.
