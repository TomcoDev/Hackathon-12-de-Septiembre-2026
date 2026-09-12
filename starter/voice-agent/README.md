# voice-agent

Chasis de **agente ambiental de voz**. Escucha una conversación que no le está dirigida, decide si vale la pena hablar, habla si hace falta, y puede ejecutar acciones con aprobación humana.

Nadie le habla al agente. No hay palabra de activación, no hay botón de "preguntar". Se deja el micrófono abierto y se conversa; el agente elige el momento.

## Por qué no usa Realtime API

Realtime existe para conversar con latencia sub-segundo. Un agente ambiental no conversa: escucha y a veces interrumpe, y tolera uno o dos segundos sin que se note. Realtime paga esa latencia con WebRTC, negociación SDP, tokens efímeros y un canal persistente que se cae con el wifi de un evento.

Este chasis usa dos endpoints REST estables: `/v1/audio/transcriptions` y `/v1/audio/speech`. Sigue siendo voz de punta a punta, con muchísima menos superficie de falla. Si sobra tiempo, migrar la entrada a Realtime es cambiar `src/audio.ts`: el resto no se entera.

## Setup

Requiere Node 22+ y una `OPENAI_API_KEY` en el `.env` **de la raíz del repo** (no en esta carpeta).

```bash
cp .env.example .env        # desde la raíz, y completar OPENAI_API_KEY
cd starter/voice-agent
npm install
npm run dev
```

Abrir `http://localhost:3000`, poner un nombre, apretar **Escuchar**.

Para dos personas: abrir la página en dos dispositivos o dos pestañas con nombres distintos, misma sala (`?room=demo`). El detector necesita saber quién dijo qué; con un solo micrófono no hay forma de separar hablantes.

## Verificación (Corte 1)

```bash
curl localhost:3000/health          # {"ok":true, ..., "key":true}
npm run replay -- fixtures/caso-negativo.json   # tiene que dar OK con 0 intervenciones
npm run replay -- fixtures/caso-positivo.json   # tiene que dar OK con 1 intervención
```

Si el positivo no dispara y el negativo sí, casi nunca es el umbral: es que el prompt no exige evidencia, o que el filtro barato deja pasar lo que no debe.

## La tubería

```
micrófono → VAD → frase → transcripción → estado → filtro barato → modelo → umbral → voz + acción
                                                       (sin LLM)   (schema      (0.8)
                                                                    estricto)
```

Cada guarda existe para **no** hablar. El silencio es la feature: un agente que interviene en cada frase es ruido y lo apagan en diez minutos.

| Archivo | Qué es |
|---|---|
| `src/pipeline.ts` | Estado por sala, guardas, umbral, bitácora. Agnóstico al patrón. |
| `src/detectors/malentendido.ts` | **El detector de ejemplo.** Es lo único que se reemplaza. |
| `src/audio.ts` | Transcripción y TTS. Cae a `whisper-1` solo si el modelo configurado no existe. |
| `src/actions.ts` | Qué puede *hacer* el agente. Toda acción con efecto afuera pasa por aprobación. |
| `src/llm.ts` | Responses API con structured outputs estrictos. Plan B automático a OpenRouter. |
| `src/replay.ts` | Calibración sin micrófono, por la misma tubería. |
| `public/` | La pantalla del demo. |

## Cambiar de detector

Es un import. En `src/index.ts`:

```ts
import { malentendido as DETECTOR } from "./detectors/malentendido.js";
```

Un detector nuevo implementa dos funciones:

```ts
export const miDetector: Detector = {
  name: "mi-patron",
  shouldRun(state, u) { /* heurística barata, sin LLM. Acá está el ingenio. */ },
  async run(state, u) { /* Responses API con schema estricto. null = callarse. */ },
};
```

**Uno solo.** Dos detectores a medias puntúan peor que uno que funciona.

El detector que viene es de ejemplo y es reemplazable: detecta cuando dos personas que no comparten idioma creen haber acordado algo y entendieron cosas distintas. No traduce (eso es Google Translate, y sería un contenedor): solo abre la boca ante una discrepancia concreta, citando lo que se dijo.

## La pantalla es el argumento

La columna derecha muestra **todas** las decisiones, incluidas las de callarse y por qué: `filtro barato`, `confianza 0.62 < 0.8`, `sin evidencia textual`, `error del modelo`.

Eso es deliberado. Un agente que solo muestra sus aciertos parece magia, y la magia puntúa bajo. Mostrar "escuché 43 frases, hablé 1 vez, y acá están las 3 veces que casi hablo y por qué no" convierte una afirmación en algo auditable, y es la respuesta directa a *mostrame la precisión, no el concepto*.

## Control del usuario

| Botón | Qué hace |
|---|---|
| Mute / Unmute | Deja de intervenir en esta sala. |
| ¿Por qué? | Repite la última intervención con la evidencia completa. |
| Status | Cuántas frases escuchó, cuántas veces habló. |
| Reset | Estado limpio. |

Las acciones con efecto afuera (`requiereAprobacion: true`) no se ejecutan: quedan en pantalla esperando **Aprobar** o **Descartar**. Ejecutar sin confirmar es la forma más rápida de perder el criterio de control.

## Manejo de fallas

- Si el modelo falla o tarda, se registra en la bitácora y el agente **sigue escuchando**. Una llamada rota no tumba al agente.
- 429 y 5xx reintentan con backoff; 400 y 401 no, porque no se arreglan solos.
- Si `OPENAI_API_KEY` no está pero sí `OPENROUTER_API_KEY`, cae a OpenRouter sin cambiar código.
- Si el modelo de transcripción no existe en la cuenta, cae a `whisper-1` en vez de perder la frase.
- Mientras el agente habla no se envía audio, así no se escucha a sí mismo.

## Endpoints

| Método | Ruta | Para qué |
|---|---|---|
| POST | `/utterance?room=&speaker=` | Audio crudo en el body. Transcribe y procesa. |
| POST | `/text` | Misma tubería sin micrófono. Para probar el detector escribiendo. |
| POST | `/speak` | Texto → mp3. |
| POST | `/control` | `mute` `unmute` `status` `why` `reset`. |
| POST | `/approve` | Aprobar o descartar una acción pendiente. |
| GET | `/state?room=` | Estado, bitácora, pendientes, acciones ejecutadas. |
| GET | `/health` | Chequeo rápido: detector, umbral, si hay key. |

## Qué falta (lo que se construye hoy)

- El detector real, cuando el equipo cierre el problema. `malentendido.ts` es el placeholder.
- Las acciones reales del dominio en `src/actions.ts`. Las dos que vienen son de prueba.
- Fixtures de calibración del patrón elegido, en `fixtures/`.
