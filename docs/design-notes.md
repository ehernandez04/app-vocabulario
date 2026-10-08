# Notas de diseño

## De dónde viene el diseño

De un canvas de cuatro pantallas (390×844) que Erick aprobó: *Inicio*, *Tarjetas post-it*,
*Adivinar la traducción* y *Modo camino — manos libres*. Está extraído en `design-ref/`.

Antes hubo una primera propuesta de estilo diccionario (fonética, tono sobrio, paleta vino y
ámbar). Se descartó. La dirección buena es la de **papel y post-it**.

## Qué se tomó del canvas, tal cual

- **La metáfora del post-it.** Notas de color, giradas unos grados, con sombra cálida y la
  esquina doblada. Encaja con el contenido: un post-it es justo lo que pegarías en el espejo
  para memorizar una palabra.
- **La paleta.** Papel `#F3EFE6`, tinta `#1C1B19`, y los cuatro colores de nota:
  `#FFE066` amarillo, `#FFB4A2` coral, `#B8E1FF` azul, `#C8F0A8` verde.
- **El trío de tipografías.** Bricolage Grotesque 800 para la palabra en inglés, DM Sans para
  la interfaz, y **Caveat manuscrita reservada al español**. Que el español vaya escrito a mano
  es el mejor detalle del diseño: separa los dos idiomas sin necesidad de etiquetas.
- **Bordes de tinta de 1.5–2px** con sombra dura `0 2px 0`, que se hunde al pulsar.
- **El Modo camino.** La idea más valiosa de todo el canvas. El bucle
  inglés → pausa para pensar → español, con la pausa configurable, es exactamente lo que
  significa "repasar en el camino": cero toques, el teléfono guardado.
- **"Solo audio" como interruptor** dentro de Adivinar, en vez de una cuarta pantalla.
- **La pantalla oscura del Modo camino**, que lo distingue del resto de la app.

## Qué se arregló

El canvas era un mockup, no una app. Faltaba lo que hace que el repaso sirva a lo largo de
semanas:

1. **Tres listas de palabras distintas** (8 tarjetas, 6 preguntas, 8 para el camino) que no
   coincidían entre sí → ahora hay **un solo mazo de 20** compartido por los tres modos.
2. **No había repetición espaciada.** Las tarjetas avanzaban con `(i + 1) % words.length`: un
   carrusel fijo. "Otra vez" y "Lo sabía" solo sumaban a un contador, sin cambiar qué veías
   después → ahora hay **cinco cajas Leitner** con intervalos de 1, 2, 4, 8 y 16 días.
3. **No se guardaba nada.** Al recargar volvías a la palabra 1 y la "racha de 6 días" era
   pintada → ahora todo vive en `localStorage`.
4. **Solo se oía el inglés en las tarjetas.** El canvas sí hablaba español en el Modo camino,
   pero el resto no → ahora el audio es bilingüe en los tres modos.
5. **Velocidad fija** en `rate: 0.9` → se añadió un botón **Despacio** (0.55), que es lo que
   hace falta con palabras como *nevertheless*.
6. **La selección de voz tomaba la primera disponible**, que suele ser la peor. Ver
   [audio.md](audio.md).

## Qué se añadió

- **Arrastrar la tarjeta** a la izquierda para "otra vez" y a la derecha para "lo sabía", con
  los sellos apareciendo al arrastrar. Es el gesto natural en un teléfono; los botones siguen ahí.
- **Un color de post-it por palabra**, asignado por índice. El mazo se siente como una pila de
  notas de verdad, en vez de todas del mismo color. El canvas tenía un único color global.
- **La pila visible**: dos notas asomando detrás de la actual, que se abren al pasar el cursor.
- **Cuenta atrás numérica** dentro del botón grande del Modo camino durante la pausa, y un halo
  que late mientras suena. Así, de un vistazo, sabes en qué paso va sin leer nada.
- **Oír también la frase de ejemplo** en el Modo camino, como opción.
- **Tema oscuro completo.** El canvas era crema salvo el Modo camino. La regla que mantiene la
  coherencia: **el post-it es un objeto físico**, así que siempre es papel de color con tinta
  oscura, en los dos temas. Solo cambia el entorno de la app. Por eso existe el token
  `--on-note`, fijo en `#1C1B19`.
- **Anillo de progreso** en Inicio y las cinco cajas como barras de color.
- **Teclado**: A/B/C/D para responder en Adivinar, espacio para revelar en Tarjetas.
- Mensajes emergentes que dicen a qué caja se movió la palabra, para que el sistema de repaso
  sea visible en vez de invisible.

## Nota técnica sobre `design-ref/`

Ese código **no es web estándar y no se puede desplegar**. Usa el runtime del canvas de diseño:
etiquetas `<x-dc>`, interpolación `{{...}}`, condicionales `<sc-if>`, bucles `<sc-for>` y clases
que heredan de `DCLogic`. Está en el repo solo como referencia visual.

Las clases de lógica de dentro sí son JavaScript normal, y de ahí salió el patrón bueno para
encadenar frases habladas: `utterance.onend` más un `setTimeout` de red de seguridad, porque
`onend` no siempre se dispara. Eso se conservó.
