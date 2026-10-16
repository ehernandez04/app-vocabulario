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

En el teléfono, como copia local para repasar sin señal (y hoy, hasta que lleguen las
cuentas, como único almacén):

```js
// una palabra
{ "en": "the way", "ipa": "/ðə weɪ/", "es": "el camino", "emoji": "🛣️",
  "xe": "I listen to podcasts on the way to work.",
  "xs": "Escucho pódcasts de camino al trabajo." }

// IndexedDB, almacén `progress`, clave = la palabra en inglés
{ box: 1..5, due: "2026-10-10", seen: 0, miss: 0 }
```

**Listas (#13).** Una lista es `{ id, name, words: string[] (textos en inglés), createdAt }`, en
el almacén `lists` de IndexedDB; una palabra puede estar en varias, de fábrica o propia.
`settings.lista` guarda cuál se repasa (null = todas) y filtra la sesión de Tarjetas,
Adivinar y Camino, pero no el anillo ni las cajas de Inicio. Las tres de partida (Básicas,
Trabajo, Viajes) se siembran una vez por teléfono (`_listasSembradas`). Viajan a la cuenta
(tablas `lists` y `list_words`): el `id` lo genera el teléfono, se sincronizan enteras (no por
operación) y se borran con marca. Mismo criterio que el avance: si el servidor no cambió desde
la `base` que el teléfono vio, entra lo del teléfono; si cambió, se unen las palabras y se queda
el nombre del servidor (`resolverLista`). Una lista nueva cuyo nombre ya existe se funde con
esa (lo que evita que dos teléfonos con la siembra dupliquen «Básicas»); el servidor contesta
`reasignadas` y el teléfono adopta el id definitivo.

El color de post-it **no** se guarda: sale de la posición en el mazo (`noteColor`).
Si una palabra trae `img`, se usa esa imagen en lugar del emoji.

**Repetición espaciada (Leitner, 5 cajas).** Intervalos en días: `[1, 2, 4, 8, 16]`.
Acierto → sube una caja. Fallo → vuelve a la caja 1. `due = hoy + intervalo[caja]`.
La sesión se arma con lo vencido (`due <= hoy`), caja más baja primero, máximo 20.

**Las fechas son locales, nunca UTC.** `srs.today()` existe justamente para eso: a las 11 de la
noche en México `toISOString()` ya devuelve el día siguiente, lo que adelantaría los repasos y
rompería la racha. Y `daysBetween` compara días de calendario, no bloques de 24 h, para
sobrevivir al cambio de horario.

## Asistente para agregar palabras (#50)

`POST /api/palabra/buscar` (login obligatorio; `ANTHROPIC_API_KEY` solo en el servidor)
pide a `claude-haiku-5-5` los significados de una palabra, separados por tipo, y corrige la
pronunciación con un diccionario real cuando responde. **Tope de 30 puntos por persona y
día** (`ai_usage`, día UTC); una búsqueda que falla por culpa nuestra no cuenta. Sin clave,
la ruta devuelve 503 y el formulario manual sigue igual.

**Varios significados = varias tarjetas, y la distinción va en la clave** (opción A, decidida):
«run (sustantivo)», «to run (verbo: dirigir)». No cambia la clave ni el modelo; lo que se
muestra y se pronuncia pasa por `textoEn()` / `<PalabraEn>`, que quitan la etiqueta. Un
solo significado se guarda a secas, como una palabra de siempre.

**Dibujo con IA (#53).** `POST /api/palabra/dibujo` pide un SVG a Haiku, Sonnet u Opus, **a
elección de quien lo pide** (por defecto Haiku; la preferencia se guarda en el teléfono).
Comparados con 8 palabras: los tres bien en cosas concretas, Opus claramente mejor en las
abstractas. **El tope diario es de 30 «puntos»: una búsqueda vale 1 y un dibujo 2** (`lib/uso-ia.ts`).
El SVG del modelo nunca se usa tal cual: `lib/svg.ts` lo reconstruye con una lista corta de
etiquetas y atributos (si algo no encaja, se descarta) y se muestra solo como `<img src="data:…">`.
Viaja con la palabra (`Word.svg`, columna que ya existía) y al bajar se vuelve `Word.img`.

