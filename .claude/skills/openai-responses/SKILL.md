---
name: openai-responses
description: Llamar a la API de OpenAI (Responses API) desde TypeScript sin dependencias nuevas, con structured outputs estrictos, function calling, reasoning effort y manejo de errores. Usala cuando toques src/llm.ts, cuando el agente tenga que devolver JSON con forma garantizada, cuando aparezca un 400 raro (temperature, schema inválido), cuando la respuesta parsee mal, o cuando haya que elegir modelo entre gpt-5.6-luna, terra y sol.
---

# Responses API desde TypeScript, sin dependencias

Verificado contra `developers.openai.com` el 12/09/2026. Node 18+ ya trae `fetch`: no hace falta instalar nada.

## Antes que nada: el starter no habla esta API

`starter/agent-backend/src/llm.ts` y `starter/telegram-agent/src/llm.ts` son **dos copias del mismo archivo**. Las dos llaman a OpenRouter `chat/completions`, no a la Responses API, y **no aceptan `opts.schema`**. Los prompts de `docs/PROMPTS_BUILD.md` asumen que sí ("usar src/llm.ts tal como está (Responses API, gpt-5.6-luna)").

Antes de construir cualquier detector: copiar `reference/llm.ts` de esta skill sobre el `llm.ts` del starter que se use. Mantiene la firma `chat(messages, opts)` que ya usa `index.ts`, así que no rompe lo existente, y agrega `opts.schema`.

## Las tres trampas que no dan un error legible

1. **`temperature` mata la request.** La familia gpt-5.x rechaza `temperature` y `top_p`. El error es que el parámetro **esté presente**, no su valor. El `llm.ts` del starter manda `temperature: 0.2` siempre, así que contra `gpt-5.6-luna` falla en la primera llamada. `reference/llm.ts` no lo manda nunca a modelos de razonamiento.
2. **`output[0]` no es el mensaje.** Los modelos de razonamiento devuelven items `{type:"reasoning"}` antes del `{type:"message"}`. Hay que filtrar por tipo, nunca indexar. Un `data.output[0].content[0].text` devuelve `undefined` de forma intermitente, que es la peor forma de fallar en un demo.
3. **`strict: true` exige que *todo* esté en `required`.** No existe el campo opcional. Un campo que puede faltar se declara `"type": ["string", "null"]` y va igual en `required`. Además `additionalProperties: false` es obligatorio en cada objeto, incluidos los anidados.

## Forma de la request

```
POST https://api.openai.com/v1/responses
Authorization: Bearer $OPENAI_API_KEY
```

```json
{
  "model": "gpt-5.6-luna",
  "input": [
    { "role": "system", "content": "..." },
    { "role": "user", "content": "..." }
  ],
  "reasoning": { "effort": "low" },
  "max_output_tokens": 2000,
  "text": {
    "format": {
      "type": "json_schema",
      "name": "intervencion",
      "strict": true,
      "schema": { "...": "JSON Schema" }
    }
  }
}
```

`input` acepta un string suelto o el array de items. `instructions` es el system prompt alternativo, de un solo nivel. Para encadenar turnos sin remandar todo: `previous_response_id`.

`reasoning.effort` acepta `none`, `low`, `medium` (default), `high`, `xhigh`, `max`. Para un detector que corre por mensaje, `low` o `none`. El default `medium` agrega segundos de latencia y tokens de razonamiento que se pagan.

## Forma de la respuesta

```json
{
  "id": "resp_...",
  "status": "completed",
  "output": [
    { "type": "reasoning", "summary": [] },
    { "type": "message", "role": "assistant",
      "content": [ { "type": "output_text", "text": "{\"fire\":true}" } ] }
  ],
  "usage": { "input_tokens": 0, "output_tokens": 0, "total_tokens": 0 }
}
```

Tres casos que hay que manejar y el starter no maneja:

- `content[].type === "refusal"` y el texto está en `c.refusal`, no en `c.text`. El modelo se negó.
- `status === "incomplete"` y el motivo está en `incomplete_details.reason`, casi siempre `max_output_tokens`.
- `status === "completed"` sin ningún item `message`. Tratarlo como error, no como string vacío.

## Structured outputs: la receta

El schema va inline. Ejemplo real para un detector:

```ts
const INTERVENCION = {
  name: "intervencion",
  schema: {
    type: "object",
    properties: {
      fire: { type: "boolean", description: "true solo si el patrón está presente" },
      confidence: { type: "number", description: "0 a 1" },
      message: { type: ["string", "null"], description: "máximo 3 líneas, en español, null si fire es false" },
      evidence: {
        type: "array",
        description: "citas textuales de los mensajes que prueban el patrón",
        items: { type: "string" },
      },
    },
    required: ["fire", "confidence", "message", "evidence"],
    additionalProperties: false,
  },
} as const;

type Salida = { fire: boolean; confidence: number; message: string | null; evidence: string[] };
const out = await chatJSON<Salida>(messages, { schema: INTERVENCION });
```

Con `strict: true` la salida está garantizada por construcción: no hace falta retry loop ni parseo defensivo con reintentos. Sí hace falta validar la **semántica**, que la confianza caiga entre cero y uno y que la evidencia no venga vacía cuando dispara. El schema garantiza la forma, nunca el criterio.

Palabras clave de JSON Schema con soporte parcial: `minLength`, `maxItems`, `format`, `pattern`. No apoyarse en ellas para validar. Validar en TypeScript después.

## Function calling

En la Responses API la tool va **plana**, no anidada bajo `function` como en Chat Completions:

```json
{ "type": "function", "name": "lookup_ruc", "description": "...",
  "parameters": { "type": "object", "properties": { "ruc": { "type": "string" } },
                  "required": ["ruc"], "additionalProperties": false },
  "strict": true }
```

El modelo devuelve en `output` un item:

```json
{ "type": "function_call", "call_id": "call_123", "name": "lookup_ruc",
  "arguments": "{\"ruc\":\"80012345-6\"}" }
```

`arguments` es un **string** con JSON adentro. Se ejecuta la función y se reinyecta el resultado como item de input en la llamada siguiente, con el mismo `call_id`:

```json
{ "type": "function_call_output", "call_id": "call_123", "output": "texto o JSON stringificado" }
```

Cuándo no usar tools: si la consulta es determinista y ya la tenés en memoria, como un padrón mock o una tabla de reglas, resolvela en código antes de llamar al modelo y pasale el resultado en el prompt. Sale más barato, es más rápido y no puede alucinar. Las tools son para cuando el modelo tiene que **decidir** si consultar.

## Modelos

| ID exacto | Contexto | Salida máx | Precio por millón, entrada y salida |
|---|---|---|---|
| `gpt-5.6-luna` | 1.05M | 128K | $0.20 y $1.20 |
| `gpt-5.6-terra` | 1.05M | 128K | verificar en la página de modelos |
| `gpt-5.6-sol`, alias `gpt-5.6` | 1.05M | 128K | $4 y $20 |
| `gpt-6-astra` | 1.05M | 128K | verificar. No acepta `effort: "none"` |

`gpt-5.6-luna` soporta streaming, structured outputs y function calling, y acepta tanto `v1/responses` como `v1/chat/completions`. Es el default correcto para un detector que corre en cada mensaje. Subir a terra solo si luna falla en el caso sutil de calibración, y medirlo con el replay, no a ojo.

## Errores y qué significan de verdad

| Código | Causa real más probable |
|---|---|
| 400 `unsupported parameter` | mandaste `temperature` o `top_p` a un gpt-5.x |
| 400 `invalid schema` | falta un campo en `required`, o falta `additionalProperties: false` en un objeto anidado |
| 401 | la key no está en el entorno. `dotenv/config` tiene que importarse **antes** que el módulo que lee `process.env` |
| 429 | cuota o rate limit. Reintentar con backoff, que `reference/llm.ts` ya hace |
| 500 o 503 | del lado de OpenAI. Reintentar |

## Plan B si la key de OpenAI se cae en pleno demo

`reference/llm.ts` conmuta solo. Si hay `OPENAI_API_KEY` usa la Responses API, y si no cae a OpenRouter con `chat/completions`, traduciendo el schema al formato anidado que ese endpoint pide. El código del agente no cambia ni una línea. Probarlo una vez antes del congelamiento de las 15:00, comentando la key de OpenAI en `.env`.

## Verificación

```bash
cd starter/telegram-agent   # o agent-backend
npx tsc --noEmit
```

Una llamada de humo antes de construir encima:

```bash
curl https://api.openai.com/v1/responses -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-5.6-luna","input":"respondé solo: listo","reasoning":{"effort":"none"}}'
```
