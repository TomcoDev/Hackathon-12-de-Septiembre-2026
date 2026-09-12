# [NOMBRE DEL PROYECTO]

> Una línea que diga qué hace el agente y dónde vive. Ejemplo: "Un agente que vive en el grupo de Telegram del equipo y solo interviene cuando detecta que dos personas están usando la misma palabra con significados distintos."

**Equipo:** Tereré Driven Development (TDD, pero el otro)
**Hackathon:** Agents, Everywhere, AI Tinkerers x OpenAI, 12 de septiembre de 2026, sede San Lorenzo, Paraguay

[![Ver demo](https://img.shields.io/badge/demo-video%202%20min-red)](LINK_AL_VIDEO)

---

## El problema

Dos o tres frases. Quién sufre esto, con qué frecuencia, qué cuesta hoy.

## El agente

Qué hace, en concreto. Qué evento lo dispara. Qué decide. Qué acción toma.

## Por qué el entorno es esencial

Esta sección es la que responde al criterio 2 del jurado. Explicar qué se rompería si esto fuera un chat común:

- El agente ve / escucha / detecta: ...
- Nadie le escribe: se activa por ...
- Si lo sacás de [entorno], se pierde ...

## Demo

Link al video de dos minutos: **LINK_AL_VIDEO**

Qué se ve en el video, en tres líneas.

## Cómo correrlo

```bash
git clone https://github.com/TomcoDev/Hackathon-12-de-Septiembre-2026.git
cd Hackathon-12-de-Septiembre-2026
cp .env.example .env   # completar las keys
# instrucciones específicas del starter elegido, ver starter/*/README.md
```

## Arquitectura

Un diagrama o una lista de componentes. Qué sponsor se usa para qué:

| Componente | Herramienta | Para qué |
|---|---|---|
| Modelo | OpenRouter / OpenAI | ... |
| ... | ... | ... |

## Qué se construyó durante el hackathon

Por las reglas de elegibilidad, esto tiene que estar claro. Ver también `docs/BUILD_LOG.md` y el historial de commits.

**Antes del evento (permitido: scaffolding y plantillas):** estructura del repo, `.env.example`, starters mínimos que solo conectan y responden `/ping`, plantillas de video y post.

**Durante el evento (11:15 a 15:30):** toda la lógica del agente: detección, decisión, acción, integración con el entorno, UI.

## Control del usuario

Qué puede hacer la persona si el agente se equivoca. Deshacer, ignorar, ajustar umbral, apagar. El criterio 4 pide "claro y controlable".

## Equipo

| Nombre | Rol en el build |
|---|---|
| Néstor Martínez | ... |
| ... | ... |
| ... | ... |
| ... | ... |

## Licencia

MIT
