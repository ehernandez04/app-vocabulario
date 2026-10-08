# App Vocabulario — contexto del proyecto

App para repasar vocabulario **inglés → español** en el camino (transporte público, caminando),
con audio y modo adivinar. Usuario y dueño: Erick (`ehernandez04`). La interfaz es **en español**.

Repo: https://github.com/ehernandez04/app-vocabulario

## Estado actual

Fase de **prototipo**. Todavía no existe la app real (sin Vite, sin `package.json`, sin service worker).
Lo que hay es `prototype/index.html`: un HTML de un solo archivo, vanilla JS, que ya funciona de
verdad (audio, tres modos, cajas de repaso, persistencia en `localStorage`).

El siguiente paso es convertirlo en la PWA real. Las tareas están en los issues de GitHub.

## Decisiones ya tomadas (no volver a discutir)

- **PWA instalable, no app nativa.** Una sola base de código; se instala desde el navegador con
  "Agregar a pantalla de inicio". El audio sale gratis con la Web Speech API del propio dispositivo.
  Si algún día hacen falta notificaciones push fuertes o publicar en tiendas, se envuelve con
  Capacitor reutilizando el mismo código.
- **Sin framework.** Vanilla HTML + CSS + JS, empaquetado con Vite. La app es pequeña y así queda ligera.
- **Hosting: Vercel** (ver "Entornos" abajo).
- **Sin backend** en las fases 1 y 2. El progreso vive en el dispositivo.
- **Audio: MP3 pregenerados con una TTS neuronal**, con la Web Speech API solo como respaldo.
  Erick señaló que la voz del navegador suena mal y tiene razón. Además de la calidad, los MP3
  resuelven el Modo camino en iPhone: `speechSynthesis` se corta al bloquear la pantalla, y un
  `<audio>` con MediaSession API no. Ver [docs/audio.md](docs/audio.md).
- **Diseño:** se eligió la dirección "post-it / papel" (ver abajo). Erick descartó la primera
  propuesta, de estilo diccionario.

## Entornos

| Entorno | Dónde | Para qué |
|---|---|---|
| Local | `npm run dev` → `http://localhost:5173` | Desarrollo. El service worker **sí** funciona en localhost. |
| Preview | Vercel crea una URL por cada rama y PR | Probar en el celular real. Imprescindible: instalar una PWA exige HTTPS, y las URL de preview lo dan. |
| Producción | rama `main` → `*.vercel.app` o dominio propio | La app que Erick usa a diario. |

Vercel se eligió por los preview deployments automáticos por rama (encajan con el flujo de
issues) y HTTPS gratis. Cloudflare Pages y Netlify sirven igual si hiciera falta cambiar.
GitHub Pages se descartó porque sirve en un subpath (`/app-vocabulario/`), lo que complica el
scope del service worker sin necesidad.

## Identidad visual (respetarla al escribir código nuevo)

Tomada del canvas de diseño que Erick aprobó. **Los post-it son objetos físicos: siempre llevan
papel de color con tinta oscura (`#1C1B19`), en tema claro y en oscuro.** Solo el entorno de la
app cambia con el tema.

```
Papel     #F3EFE6   Tinta       #1C1B19   Tinta suave #5E5A52
Regla     #E2DCCF   Papel-2     #EAE4D7
Post-it   #FFE066 (amarillo) · #FFB4A2 (coral) · #B8E1FF (azul) · #C8F0A8 (verde)
Acierto   #1F6F43   Fallo       #B4380B
Oscuro    papel #1A1916 · tarjeta #24231F · tinta #F3EFE6 · regla #36342E
```

- **Display:** Bricolage Grotesque 800, `letter-spacing` negativo. Es la palabra en inglés.
- **Cuerpo:** DM Sans 400/500/700.
- **Manuscrita:** Caveat 700 — se usa **solo para el español** y para notas al margen.
- Bordes de 1.5–2px en tinta, con sombra dura `0 2px 0` que se hunde al pulsar.
- Pantalla de referencia: 390×844 (iPhone). El prototipo usa 392×756.

## Modelo de datos

```js
// una palabra del mazo
{ en:'the way', ipa:'/ðə weɪ/', es:'el camino',
  xe:'I listen to podcasts on the way to work.',
  xs:'Escucho pódcasts de camino al trabajo.',
  note:'#FFE066' }   // color de post-it, asignado por índice

// progreso por palabra, en localStorage bajo la clave 'vocabruta.v2'
{ box:1..5, due:'2026-10-09', seen:0, miss:0 }
```

**Repetición espaciada (Leitner, 5 cajas).** Intervalos en días por caja: `[1, 2, 4, 8, 16]`.
Acierto → sube una caja. Fallo → vuelve a la caja 1. `due = hoy + intervalo[caja]`.
La sesión del día se arma con las palabras vencidas (`due <= hoy`), caja más baja primero, máximo 20.

El mazo es **uno solo y compartido por los tres modos**. Mazo actual: 20 palabras en
`prototype/index.html` (constante `DECK`). En la app real va en un JSON aparte.

## Los tres modos

1. **Tarjetas** — post-it con la palabra, fonética y audio. Se arrastra a la izquierda para
   "otra vez" y a la derecha para "lo sabía"; también hay botones.
2. **Adivinar** — cuatro traducciones. Lleva un interruptor "Solo audio" que oculta la palabra
   escrita, para ir caminando.
3. **Modo camino** — manos libres, la pieza central de la app. Bucle automático:
   inglés → pausa configurable (3/5/8 s) con cuenta atrás visible → español → siguiente.
   Opción de oír también la frase de ejemplo. El teléfono va en el bolsillo.

## Trampas conocidas de la Web Speech API

- Las voces cargan **en asíncrono**: hay que escuchar `voiceschanged` y no fiarse del primer
  `getVoices()`.
- El audio **solo arranca después de que el usuario toque algo**. Nada de autoplay al cargar.
- Para encadenar frases (el bucle del modo camino) hay que usar `utterance.onend`, y además un
  `setTimeout` de red de seguridad, porque `onend` a veces no se dispara.
- Se necesitan dos voces: `en-*` para el inglés y `es-*` para el español. Puede que una falte.
- iOS corta la síntesis al bloquear la pantalla. El modo camino necesita probarse en un iPhone real.

## Archivos

- `prototype/index.html` — el prototipo que funciona. Base de la app real.
- `design-ref/` — las cuatro pantallas del canvas original, extraídas para consulta.
  **Ojo:** ese código usa el runtime del canvas (`<x-dc>`, `{{...}}`, `sc-if`, `DCLogic`),
  no es web estándar y no se puede desplegar. Las clases de lógica sí son JS normal.
- `docs/design-notes.md` — qué se tomó del canvas y qué se arregló.

## Artifacts publicados

- Prototipo actual (post-it): https://claude.ai/artifact/CWTWbBoeZwCmkrXQsd8HXJ
- Primera propuesta, descartada (estilo diccionario): https://claude.ai/artifact/92Yurw8NS11K8DqFA2Xb8R

## Convenciones

- Los commits y los issues van **en español**.
- El repo no tiene `main` todavía al momento de escribir esto; la rama por defecto será `main`.
