# EL TESTIGO

> Un agente que vive en tu grupo de Telegram, no habla, y se acuerda de lo que hiciste.

Lee el grupo donde ya trabajás. No responde, no pregunta, no interrumpe. Anota en silencio lo que **hiciste** —no lo que prometiste— con link al mensaje que lo prueba. Y la única vez que abre la boca es cuando alguien menciona el 1:1 en el grupo: te manda **un** mensaje privado con lo que hiciste este mes. A vos. A nadie más.

**Lee en público, habla en privado. Nunca al revés.**

## Correr

```bash
# desde la raíz del repo: .env con TELEGRAM_BOT_TOKEN, PERSONA=lu (y OPENAI_API_KEY para el detector real)
cd starter/testigo
npm install
npm run dev              # servidor en :3000 + bot en vivo si hay token
```

Abrir `http://localhost:3000` (pantalla de Néstor). `POST /replay` arranca la demo.

## La demo: replay de un mes real

```bash
# 1. exportar el grupo desde Telegram Desktop: ⋮ → Exportar historial → JSON, sin media
npm run importar -- "C:\...\ChatExport_2026-09-12\result.json" data/agosto.jsonl
#    imprime los autores: elegir uno como PERSONA en .env

# 2. reproducir por la MISMA tubería que el bot en vivo
npm run replay -- data/agosto.jsonl --ms 0      # calibrar
npm run replay -- data/agosto.jsonl --ms 80     # ritmo de video
```

Termina con exit 0 si habló exactamente una vez. Correrlo dos veces tiene que dar lo mismo.

`data/agosto.jsonl` es privado y está en `.gitignore`. Solo se sube `data/ejemplo.jsonl` (sintético).

## La tubería

```
mensaje del grupo ──▶ hilo ──▶ ¿se cerró? ──▶ filtro barato ──▶ detector ──▶ umbral ──▶ anota EN SILENCIO
        │                                       (sin modelo)                 (0.75)
        └──▶ ¿alguien mencionó el 1:1? ──▶ redactor ──▶ UN mensaje privado
```

Nadie le escribe. Se activa por lo que ve, no por lo que le piden. La bitácora registra **todas** las decisiones, incluidas las de callarse y por qué: eso es lo que muestra la pantalla.

| Archivo | Qué | Dueño |
|---|---|---|
| `src/importar.ts` | Export de Telegram → `mensajes.jsonl`. Arma hilos por reply o por ventana de 20 min. | Luis |
| `src/pipeline.ts` | Estado, hilos, filtro barato, umbral, bitácora. Agnóstico al detector. | Luis |
| `src/trigger.ts` | Lo único que lo hace hablar. Una vez por período. | Luis |
| `src/bot.ts` | Escucha el grupo, manda el DM. Guarda el chat de quien dio `/start`. | Luis |
| `src/replay.ts` | La demo y la herramienta de calibración. Misma tubería. | Luis |
| `src/index.ts` | Servidor: `/state` para la pantalla, `/replay`, borrar bullet, compartir. | Luis |
| `src/detectores/heuristico.ts` | Detector **sin modelo**. Plan B, y lo que corre hasta que llegue el real. | — |
| `src/detectores/evidencia.ts` | Detector real con Responses API y schema estricto. | **José** |
| `src/redactor.ts` | Evidencias → 8 bullets. Regla anti-genérico en código. | **José** |
| `src/plan.ts` | El plan sale del canal. `no_estaba_en_plan`. | **José** |
| `public/` | Contador · replay · bitácora · entregable · borrar · compartir. | **Néstor** |
| `src/tipos.ts` | **Los contratos.** No se cambian sin avisar. | todos |

## Cambiar el cerebro

Un export en `src/detectores/index.ts`:

```ts
export { evidencia as DETECTOR } from "./evidencia.js";
```

## Endpoints (para la pantalla)

| Método | Ruta | Qué |
|---|---|---|
| GET | `/state` | Contador, últimos mensajes, bitácora, evidencias, plan, disparador, entregable |
| POST | `/replay` `{archivo, ms}` | Arranca el replay en background |
| POST | `/reset` | Estado limpio |
| DELETE | `/entregable/:evidencia_id` | La persona borra un bullet |
| POST | `/entregable/compartir` | Marca compartido. **No manda nada a nadie.** |
| GET | `/health` | `dmPosible` dice si la persona ya dio `/start` |

## Control de la persona

Es su registro. Borra lo que no fue así. Nada sale sin que apriete compartir, y compartir hoy no manda nada: existe para que se vea que existe.

## Trampas conocidas

- **Un bot no puede escribirle primero a nadie.** La persona le manda `/start` en privado, una vez. Se guarda en `data/chats.json`.
- `/setprivacy` → Disable en BotFather, o el bot no ve el grupo. Si ya estaba en el grupo, sacarlo y volverlo a agregar.
- `\b` de JS no funciona después de `é`: los regex usan lookarounds sobre `[a-záéíóúñ]`.
- El export trae `text` como string **o** como lista de fragmentos. `importar.ts` aplana los dos.

## Las cinco preguntas del Juez

1. **¿Qué decide que un `if` no decidiría?** A quién atribuir el trabajo cuando lo escribió otro: *"gracias lu, con eso salió"* es evidencia sobre lu. Y qué cuenta como hecho vs. prometido.
2. **¿Qué pasa si le sacás el entorno?** No hay evento, no hay hilos, no hay mensaje del 1:1 que lo despierte.
3. **¿Quién le escribe?** Nadie.
4. **¿Qué controla el usuario?** Borra, corrige, y nada sale sin apretar.
5. **¿Qué existía ayer?** `starter/telegram-agent` con `/ping`. Todo esto se construyó hoy: ver `docs/BUILD_LOG.md`.
