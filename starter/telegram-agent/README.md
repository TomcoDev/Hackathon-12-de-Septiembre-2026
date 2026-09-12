# telegram-agent

Agente ambiental que vive en un grupo de Telegram. No responde a nadie: escucha
todos los mensajes, mantiene estado por chat y solo interviene cuando detecta un
patrón. El silencio es una feature.

## Arquitectura

```
mensaje del grupo
      ↓
  state.ts          ventana de 40 mensajes por chat, en memoria
      ↓
  detector.ts       guardas + filtro barato (sin modelo) + umbral
      ↓
  detectors/patron.ts   el patrón: filtro barato y prompt
      ↓
  llm.ts            Responses API de OpenAI, schema estricto
      ↓
  interviene en el grupo con evidencia citada
      ↓
  trigger/seguimiento.ts   espera N minutos y vuelve SOLO al grupo
```

| Archivo | Qué hace |
|---|---|
| `src/llm.ts` | Responses API con structured outputs estrictos. Cae a OpenRouter solo si falta la key de OpenAI. |
| `src/state.ts` | Estado por chat: ventana de mensajes, participantes, mute, seguimientos abiertos. |
| `src/detector.ts` | Contrato `Detector`, schema de detección, umbral y validación semántica. Un solo camino de decisión. |
| `src/detectors/patron.ts` | **El detector.** Cambiar la constante `PATRON` para elegir entre los tres. |
| `src/telegram.ts` | Bot API por fetch, para postear desde las tareas de Trigger.dev que no tienen `ctx`. |
| `src/trigger/seguimiento.ts` | Espera diferida. Es lo que hace que el agente actúe sin que nadie esté mirando. |
| `src/trigger/deteccion.ts` | El detector como tarea durable, con reintentos y trazas. |
| `src/replay.ts` | Reproduce conversaciones guionadas por el mismo pipeline. Test y calibración. |

## Poner en marcha

1. Completar en el `.env` de la raíz del repo: `TELEGRAM_BOT_TOKEN`, `OPENAI_API_KEY`, `TRIGGER_SECRET_KEY`.

2. Copiar ese `.env` acá, porque el CLI de Trigger.dev lee el de esta carpeta:

   ```bash
   cp ../../.env .env
   ```

   Los dos están en `.gitignore`. Si cambiás la raíz, volvé a copiar.

3. En [@BotFather](https://t.me/BotFather): `/setprivacy` → **Disable**, y después sacar
   el bot del grupo y volverlo a agregar. Sin esto el bot solo ve los mensajes
   donde lo mencionan, y el agente ambiental deja de ser ambiental.

4. Arrancar los dos procesos, en terminales separadas:

   ```bash
   npm run dev           # el bot
   npm run trigger:dev   # el worker de Trigger.dev
   ```

   La primera vez, `npm run trigger:init` para crear el proyecto y llenar
   `TRIGGER_PROJECT_REF`.

## Verificar

```bash
npm run typecheck
npm run replay -- ../../docs/test-conversations/caso1.json
```

En el grupo: `/ping` responde, `/llm` prueba el modelo, `/status` muestra el estado.

## Calibrar

Todo se ajusta por `.env` sin tocar código:

| Variable | Para qué |
|---|---|
| `PATRON` | Cuál de los tres patrones detecta |
| `UMBRAL` | Confianza mínima para intervenir. Arranca en 0.8 |
| `MIN_CHEQUEO` | Mensajes nuevos antes de gastar una llamada al modelo |
| `MIN_INTERVENCION` | Mensajes de silencio obligatorio después de hablar |
| `SEGUIMIENTO_MINUTOS` | Cuánto espera antes de volver. **Bajar a 1 para grabar el video** |

El replay imprime el motivo de cada silencio. Ahí se ve si el que sobra es el
filtro barato o el umbral.

## Control del usuario

| Comando | Qué hace |
|---|---|
| `/mute` | Deja de intervenir en este chat |
| `/unmute` | Vuelve |
| `/status` | Estado resumido y seguimientos abiertos |
| `/why` | Repite la última intervención con toda la evidencia |
| `/listo` | Cierra el seguimiento y **cancela** la tarea diferida antes de que despierte |
