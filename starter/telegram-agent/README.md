# telegram-agent

Bot de Telegram mínimo con grammY. Escucha todos los mensajes de texto de un grupo y los loguea. Responde `/ping` y `/llm` para verificar que Telegram y OpenRouter están conectados.

Es la base para un **agente ambiental**: uno que no espera que le hablen, sino que mira el flujo del grupo y solo interviene cuando detecta un patrón.

## Setup (5 minutos)

1. En Telegram, hablar con `@BotFather`:
   - `/newbot`, elegir nombre y username. Copiar el token.
   - `/setprivacy`, elegir el bot, `Disable`. Sin esto el bot no ve los mensajes del grupo, solo los que lo mencionan.
2. Crear un grupo de prueba y agregar el bot. Si ya estaba agregado antes de cambiar privacy, sacarlo y volverlo a agregar.
3. Pegar el token en `.env` como `TELEGRAM_BOT_TOKEN`.

```bash
cd starter/telegram-agent
npm install
npm run dev
```

4. En el grupo, escribir `/ping`. Tiene que responder `pong 🧉`.
5. Escribir `/llm`. Tiene que responder con lo que diga el modelo.
6. Escribir cualquier cosa. Tiene que aparecer en la consola.

## Qué hay que construir durante el hackathon

Todo lo marcado con `TODO` en `src/index.ts`. Hoy el bot solo escucha y loguea. El estado, el detector y la intervención no existen. Eso es a propósito por las reglas de elegibilidad.

## Ideas de detector (ver docs/20-ideas-con-el-Juez.pdf)

- Deriva de definiciones: dos personas usan la misma palabra con significados distintos.
- Decisión no anotada: el grupo llegó a un acuerdo y nadie lo registró. Con contradicción de una decisión anterior, mejor.
- Tarea sin dueño: se mencionó algo necesario y nadie lo agarró.

Los tres usan la misma arquitectura. Construirla una vez y enchufar el detector que mejor funcione a las 14:30.

## Long polling vs webhook

Este starter usa long polling (`bot.start()`), que funciona desde cualquier laptop sin URL pública. Para el hackathon es suficiente. Si hace falta webhook (por ejemplo para Trigger.dev), grammY lo soporta con `webhookCallback`.
