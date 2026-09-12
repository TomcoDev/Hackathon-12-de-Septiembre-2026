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
| | | |
| | | |
| | | |
| | | |
