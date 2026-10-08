# Audio: por qué suena mal y cómo se arregla

El prototipo usa la **Web Speech API** (`speechSynthesis`), la voz que ya trae el dispositivo.
Es gratis y funciona sin conexión, pero la calidad depende por completo de qué voces tenga
instalado el teléfono o la computadora, y el valor por defecto suele ser malo.

## Arreglo inmediato (ya está en el prototipo)

Dos cosas, ambas implementadas en `prototype/index.html`:

**1. Dejar de tomar la primera voz que aparece.** El primer `en-US` que devuelve el navegador
suele ser el peor. En macOS la lista arranca con voces de novedad —Bad News, Bubbles, Zarvox,
Jester— y con versiones "compact" de baja calidad. Ahora se puntúan (`rankVoice`):

- Las de novedad se descartan de plano.
- `Google …` gana mucho: en Chrome es la mejor disponible y es una voz remota de buena calidad.
- `Natural`, `Neural`, `Premium`, `Enhanced` ganan casi igual: son las que Apple y Windows
  descargan aparte.
- `Siri`, `Samantha`, `Ava`, `Allison`, `Aria`, `Jenny` suman.
- `localService === false` suma: las remotas suelen ser las buenas.
- `compact` resta.

**2. Un selector de voz en la pantalla de Inicio**, con botón de prueba. La elección se guarda.
Ninguna heurística acierta en todos los dispositivos, así que la última palabra es del usuario.

**Además, gratis y vale mucho la pena:** en iPhone y Mac se descargan voces de calidad muy
superior en **Ajustes → Accesibilidad → Contenido hablado → Voces → Inglés**. Las marcadas
*Premium* o *Mejorada* son otra cosa. En Android, en *Ajustes → Accesibilidad → Texto a voz*
conviene tener el motor de Google y descargar el paquete de inglés.

## El arreglo de verdad: MP3 pregenerados con una TTS neuronal

Para un mazo que cambia poco, lo mejor es **no sintetizar en vivo**. Se generan los audios una
sola vez con un servicio neuronal, se guardan como MP3 en el repo y la app los reproduce con
`<audio>`. La Web Speech API se queda solo como respaldo para las palabras que el usuario agregue.

### Por qué es mejor, más allá de la calidad

- **Calidad idéntica en todos los dispositivos.** Da igual qué voces tenga el teléfono.
- **Funciona sin conexión** de verdad: los MP3 entran en el caché del service worker.
- **Resuelve el Modo camino en iPhone.** Esto es lo importante. `speechSynthesis` se corta
  cuando se bloquea la pantalla, y el Modo camino existe precisamente para llevar el teléfono
  en el bolsillo. Un `<audio>` con la **MediaSession API** sigue sonando con la pantalla
  bloqueada, y además aparece en los controles de la pantalla de bloqueo y en los auriculares
  (play/pausa, siguiente). Es la diferencia entre que el modo funcione y que no.
- **Cero latencia y cero dependencia de red** al reproducir.

### Cuánto cuesta

Un mazo de 500 palabras con su frase de ejemplo, en inglés y español, son unos
**50.000–60.000 caracteres**. A los precios típicos de estos servicios (del orden de 15–20 USD
por millón de caracteres) sale por **menos de un dólar, una sola vez**. Varios tienen capa
gratuita mensual que cubre el mazo completo. Conviene confirmar precios al momento de usarlo,
porque cambian.

### Opciones

| Servicio | Calidad | Nota |
|---|---|---|
| **ElevenLabs** | La más natural | Capa gratuita mensual pequeña; la mejor opción si lo que importa es que suene humano |
| **OpenAI TTS** | Muy buena | Una sola llamada HTTP, la integración más simple |
| **Google Cloud TTS** (Neural2 / Chirp) | Muy buena | Mucha variedad de acentos en-US / en-GB |
| **Amazon Polly** (Neural) | Buena | Capa gratuita amplia el primer año |
| **Azure Neural TTS** | Muy buena | Capa gratuita mensual generosa |

Cualquiera sirve. La elección es de gusto, no técnica.

### Cómo se implementa

Un script de build que se corre a mano cuando el mazo cambia:

```
npm run audio      # lee src/data/deck.json, llama a la API, escribe public/audio/*.mp3
```

- Nombre de archivo por hash del texto, para no regenerar lo que ya existe.
- Cuatro pistas por palabra: `en`, `en-ejemplo`, `es`, `es-ejemplo`.
- Los MP3 se comitean al repo. Son pocos KB cada uno y así el deploy no depende de la API.
- La clave de la API vive en `.env.local`, **nunca** en el repo ni en el cliente. El script
  corre en la máquina de desarrollo, no en Vercel.
- En la app: `playTrack(word, 'en')` busca el MP3; si no existe, cae a `speechSynthesis`.

### Audio de hablantes reales

Wikimedia Commons y Wiktionary tienen grabaciones de pronunciación hechas por hablantes nativos,
con licencia libre. Suenan mejor que cualquier TTS, pero la cobertura es irregular (muchas
palabras no tienen, y casi ninguna frase de ejemplo). Sirve como extra para palabras sueltas,
no como base del mazo.

## Importante sobre las pruebas

El prototipo publicado como artifact **no puede cargar MP3 externos** (su CSP lo bloquea), así
que esta parte se prueba en la app real con Vite, no en el artifact. En el artifact se seguirá
oyendo la voz del dispositivo con el selector.
