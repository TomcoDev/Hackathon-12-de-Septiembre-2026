# Registro de construcción

Por las reglas de elegibilidad el equipo tiene que poder explicar qué partes se crearon durante el hackathon. Este archivo, junto con el historial de commits, es esa explicación.

## Antes del evento (permitido por las reglas: templates, starter code, plantillas)

| Fecha | Qué | Quién |
|---|---|---|
| 11 sep, noche | Estructura del repo, `.gitignore`, `LICENSE`, `.env.example` | Néstor |
| 11 sep, noche | Plantillas: README, SUBMISSION, guion de video, post de redes, cronograma | Néstor |
| 11 sep, noche | Starter `telegram-agent`: conecta a Telegram, responde `/ping`, loguea mensajes. Sin lógica de agente. | Néstor |
| 11 sep, noche | Starter `chrome-extension`: manifest MV3, content script que lee el DOM, side panel vacío. Sin lógica de agente. | Néstor |
| 11 sep, noche | Starter `agent-backend`: servidor Express con un endpoint que llama a OpenRouter. Sin lógica de agente. | Néstor |
| 11 sep, noche | Documentos de planificación en `docs/` | Néstor |

## Durante el evento (11:15 a 15:30)

Completar en tiempo real. Una línea por hito. Esto es lo que el jurado puede pedir.

| Hora | Qué | Quién |
|---|---|---|
| 11:15 | Inicio del build. | Todos |
| 11:20 | El repo pasa a control de versiones. Hasta acá no había historial: el primer commit aísla el scaffolding del 11 de septiembre, el segundo el tooling de hoy. | Néstor |
| 11:26 | Base del agente en `starter/telegram-agent`. `llm.ts` migrado de OpenRouter chat/completions a la Responses API de OpenAI con structured outputs estrictos. Estado por chat en memoria, contrato del detector, umbral con validación semántica compartida, comandos de control (`/mute`, `/unmute`, `/status`, `/why`, `/listo`) y arnés de replay para calibrar. | Néstor |
| 11:26 | Trigger.dev integrado en dos roles: tarea de espera diferida que hace que el agente vuelva solo al grupo sin que nadie le escriba, y tarea de detección durable con reintentos. | Néstor |
| 12:15 | `starter/voice-agent`: chasis de agente ambiental de voz por REST (transcripción + TTS, sin Realtime). Descartado a las 12:50 al cerrar la idea; queda como historial. | Luis + Claude |
| 12:55 | Idea cerrada: EL TESTIGO. Plan por persona y criterio en `docs/PLAN_EL_TESTIGO.md`. Ruleta: Luis P1 entorno y datos, José P2 cerebro, Néstor P3 pantalla y entrega. | Todos |
| 13:05 | `starter/testigo`: contratos (`tipos.ts`, textuales de EL-TESTIGO.md §7) y tubería por hilos (`pipeline.ts`): filtro barato, umbral, bitácora de todas las decisiones incluido el silencio. | Luis + Claude |
| 13:20 | `importar.ts`: export JSON de Telegram Desktop → `mensajes.jsonl`. Hilos por reply o ventana de 20 min. Aplana `text` string/fragmentos. | Luis + Claude |
| 13:25 | `trigger.ts`: habla solo cuando alguien menciona el 1:1 en el grupo, una vez. `bot.ts`: DM privado con grammY; `/start` guarda el chat id (un bot no puede escribir primero). | Luis + Claude |
| 13:30 | `replay.ts` + `index.ts`: replay por la misma tubería que el bot en vivo, `/state` para la pantalla, borrar bullet, compartir (no manda nada). | Luis + Claude |
| 13:35 | Detector heurístico sin modelo (`detectores/heuristico.ts`): atribuye trabajo a terceros («gracias lu» es evidencia sobre lu) y fusiona corroboraciones. Plan B si la API cae. | Luis + Claude |
| 13:40 | `plan.ts`: el plan sale del primer mensaje del canal que enumera objetivos; `no_estaba_en_plan` se decide en la tubería. | Luis + Claude |
| 13:45 | Punta a punta sobre export sintético: 39 leídos · 5 anotados · 1 habló. Dos corridas, mismo resultado. | Luis + Claude |
| 14:05 | Pantalla del demo (`public/index.html`): contador de tres números, narración, embudo «por qué se calló», DM privado con evidencia citada, borrar y compartir. | Luis + Claude |
| 14:25 | `seed.ts`: mes sintético en formato export de Telegram (262 msgs, 6 personas, 149 hilos). Detector anota a todos, el DM filtra por persona. 262 · 15 · 1, cero falsos positivos. | Luis + Claude |
| 14:45 | Bot en vivo probado en el grupo real: nombres con emojis y admins anónimos manejados; cierre de hilos por tiempo; el DM va a quien dio `/start`. `npm run verificar` = prueba de terminado de P1. | Luis + Claude |
| 15:10 | Deploy en un server Linux limpio con Node 22 desde `main`: `npm install` + `npm start` funcionan siguiendo el README. Cayó por 409 (dos instancias con el mismo token): el bot ahora sobrevive y reintenta solo. | Luis + Claude |
