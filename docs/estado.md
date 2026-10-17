# Estado actual

**El proyecto está migrando de una PWA local a una app con cuentas y base de datos.**
El plan vive en los milestones del repo: Etapa 0 · Cimientos, Etapa 1 · Paridad,
Etapa 2 · Cuentas, Etapa 3 · Sincronización. Verificar siempre contra los issues
(`gh issue list --state all --json number,title,milestone`), no contra este archivo.

La app corre sobre **Next 16 + Tailwind 4**, con la API prevista en el mismo proyecto
(Route Handlers), Postgres en Neon vía Prisma y Auth.js con Google. La etapa 1 está
cerrada: los tres modos, agregar palabras, exportar e importar, el audio y la PWA
funcionan, y `legacy/` ya se borró. La etapa 2 también: se entra con Google, hay lista
blanca, el esquema existe y lo que había en el teléfono se sube la primera vez. La etapa 3
está completa: la sincronización funciona y el estado se ve como una insignia en el avatar
(`components/IndicadorSync.tsx`) más una fila en Ajustes. La sincronización
funciona así: cada cambio queda marcado como sucio en IndexedDB y sube sola a los 5 s, al
abrir, al volver la señal y al volver a primer plano.

**Aprender por tema (#39) y la app como «inglés desde cero» (#76).** El nombre decidido es
**Paso a Paso** (antes «Vocabulario en Ruta»; renombrada en #81). La app pasó de repasar
vocabulario a una ruta de temas con niveles. La barra tiene **Inicio · Temas · Palabras**
(«Hablar» se suma cuando exista la práctica con IA, #78). Inicio muestra el tema y nivel en que
vas con un botón «Continuar»; el mazo, las listas y los tres modos de repaso (Tarjetas, Adivinar,
Camino) viven en `/palabras`. Reglas ya decididas: los **temas se abren en orden**; **no se salta un
nivel** salvo con un botón al final de ciertas lecciones (#79); para subir de nivel **solo cuenta
Ideas** (10 aciertos seguidos, un fallo reinicia la racha) y Vocabulary, Speaking y Listening no
bloquean (#77). Las cuatro partes son pantallas propias (`/temas/[tema]/vocabulario` y
`/temas/[tema]/practicar` con `?parte=speaking|listening`; Ideas es el valor por defecto),
repartidas por `paraParte` en `lib/temas.ts`: toma solo los ejercicios de traducir y los
reetiqueta como dictado o repetición según la parte. Vocabulary muestra las palabras propias
del tema y nivel —no el mazo global—, escritas a mano en el campo `palabras` de cada `Nivel`
(igual que los ejercicios de #63): sin caja ni racha, solo para repasar antes de practicar.
**Conversar con la IA (#78): pestaña «Hablar», un turno por vez.** Es la quinta parte de un nivel (junto a
Vocabulary, Ideas, Speaking y Listening), y también tiene su propia entrada en la barra de pestañas con la lista de
temas y el nivel en que vas en cada uno. No se guarda nada de la charla ni cuenta para la racha o el nivel: es solo
para soltarte hablando. Un turno encadena tres proveedores distintos, cada uno con su propio tope porque cobran
distinto (`lib/uso-ia.ts`, `lib/uso-voz.ts`, `lib/uso-tts.ts`): Azure Speech transcribe lo que dijiste (mismo
servicio que #68, sin evaluar pronunciación), Claude Haiku genera la respuesta de la IA en su papel ligado al
`foco` del nivel, y ElevenLabs la convierte en voz. Quedamos en el **plan gratis de ElevenLabs** (10.000
caracteres/mes): el tope mensual (`TtsUsage`, ~9.000 con margen) es de toda la cuenta, no por persona, y si se
agota la conversación sigue en texto, sin voz de la IA, nunca se bloquea. El audio nunca arranca solo: la primera
línea espera a que toques «Empezar a hablar» y cada respuesta sigue a que grabes tu turno, para no pisar la regla
de no autoplay. Los ejercicios los genera `claude-haiku-5-5` por tandas de 40 por nivel, en dos
peticiones paralelas de 20 (una de 40 tardaba ~53 s, al borde del límite), y se guardan en
`tema_ejercicios` (con marca de borrado); la práctica los copia a IndexedDB (`lib/ejercicios-local.ts`)
y califica comparando con las respuestas y errores típicos del propio ejercicio, así que funciona
sin conexión. Cada tanda cuesta 1 punto del tope diario y deja unos 28 ejercicios válidos: el
saneado (`lib/ejercicios-ia.ts`) descarta a propósito lo que no tiene exactamente una respuesta
posible. Los ejercicios son de tres tipos (`tipo` en `tema_ejercicios`): elegir, escribir el hueco y traducir. Los escritos se califican en el teléfono contra `aceptadas` y `errores` (`calificarEscrito`, que ignora mayúsculas, puntuación y apóstrofos, e iguala «I'll» con «I will»); si no coincide con nada, el ejercicio le pregunta a quien practica si quiere que la IA lo revise (`/api/temas/revisar`, 1 punto) y, mientras no haya respuesta, no cuenta ni como acierto ni como fallo. El nivel y la racha de cada tema viven en IndexedDB (almacén `temas`) y viajan a la cuenta (tabla `tema_progreso`, #70) con la misma idea de versión que el avance: si el servidor no cambió, entra lo del teléfono; si dos aparatos practicaron a la vez, gana el nivel más alto (`resolverTema`).

**Escucha y repite (#68): pronunciación con Azure Speech.** Una de cada tres traducciones de
la tanda se presenta como «repetir» (`conDictados`; sin conexión ese turno queda en traducir):
suena la frase, quien practica la dice, el teléfono la convierte a WAV de 16 kHz
(`lib/wav.ts`, porque cada navegador graba en un formato distinto) y `POST /api/temas/pronunciar`
la evalúa con *pronunciation assessment*. El resultado son tres estados («Se te entiende bien»,
«Casi», «Repítela») más el sonido más flojo, sin porcentajes (`lib/pronunciacion.ts`): el
objetivo es que se te entienda, no borrar el acento. **Los umbrales son provisionales:** hay
que calibrarlos con grabaciones reales. Tiene tope propio de 20 evaluaciones al día
(tabla `voice_usage`, `lib/uso-voz.ts`), aparte de los puntos de IA, porque Azure cobra por
segundo de audio. No cuenta para la racha ni para subir de nivel (#77). Variables:
`AZURE_SPEECH_KEY` y `AZURE_SPEECH_REGION`; sin ellas la ruta contesta 503.

**Recordatorio diario (#14): Web Push, no notificación local.** Una PWA no puede despertarse
sola a una hora fija, así que lo manda el servidor. Cada aparato es una fila de `push_subs` con
su hora (HH:MM) y su zona horaria; `lib/recordatorio.ts` decide si toca avisar (pasó la hora,
dentro de una hora de holgura, no avisado hoy y sin repaso hoy). El cron es un workflow de
GitHub Actions cada 15 min (`.github/workflows/recordatorio.yml`) que llama a
`/api/recordatorio/enviar` con `CRON_SECRET`: Vercel Hobby solo permite un cron al día. Las
claves VAPID de producción viven en Vercel y son distintas de las del `.env` local. **En
iPhone solo llega con la app instalada en la pantalla de inicio.** Si en local el aviso no
llega aunque el servidor responda 200, no es el código: Chrome puede no estar recibiendo push
(red, VPN, perfil) o macOS tener apagadas las notificaciones de Chrome.

