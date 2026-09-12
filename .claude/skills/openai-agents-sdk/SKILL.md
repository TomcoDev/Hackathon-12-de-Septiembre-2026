---
name: openai-agents-sdk
description: Construir agentes con el Agents SDK de OpenAI en TypeScript (@openai/agents), con tools tipadas por zod, loop de ejecución, handoffs entre agentes, guardrails, agentes de voz en tiempo real y agentes con sandbox. Usala cuando el agente tenga que elegir y encadenar herramientas solo, cuando haga falta delegar entre varios agentes, o para decidir si conviene el SDK o una llamada cruda a la Responses API.
---

# Agents SDK en TypeScript

Verificado contra `openai.github.io/openai-agents-js` el 12/09/2026.

## Primero: decidir si hace falta

El SDK agrega dos dependencias y un loop de ejecución que no controlás. Para este repo, la regla de `docs/PROMPTS_BUILD.md` es explícita: sin dependencias nuevas salvo que sea imprescindible, y avisando antes.

| Situación | Qué usar |
|---|---|
| Una llamada, salida con forma fija (un detector, un validador) | Responses API cruda. Ver la skill `openai-responses` |
| El modelo tiene que **elegir** entre varias herramientas y encadenarlas sin que vos sepas el orden | Agents SDK |
| Varios agentes especializados que se pasan el trabajo | Agents SDK, handoffs |
| Voz en tiempo real | Agents SDK, `@openai/agents/realtime` |
| Un agente que toca archivos en un workspace aislado | Agents SDK, `@openai/agents/sandbox` |

Un detector ambiental es una llamada con schema estricto. **No necesita el SDK.** Meterlo ahí agrega latencia y una capa de indirección para depurar bajo presión de tiempo.

## Instalación

```bash
npm install @openai/agents zod
```

Necesita `OPENAI_API_KEY` en el entorno. Habla con OpenAI directamente: el plan B de OpenRouter que tiene `llm.ts` no aplica acá, así que si el SDK es el único camino del agente, la caída de la key es un punto único de falla. Tenerlo en cuenta antes del demo.

## Lo mínimo que corre

```ts
import { Agent, run } from '@openai/agents';

const agent = new Agent({
  name: 'Assistant',
  instructions: 'You are a helpful assistant.',
});

const result = await run(agent, 'Write a haiku about recursion in programming.');
console.log(result.finalOutput);
```

`run()` es posicional: `run(agent, input, options?)`. El resultado trae `finalOutput` ya resuelto después de todo el loop de tools.

## Tools tipadas

Una función de TypeScript se vuelve herramienta con `tool()`. El schema de zod se convierte solo a JSON Schema, así que el tipo en tiempo de compilación y la validación en runtime salen de la misma fuente.

```ts
import { Agent, tool, run } from '@openai/agents';
import { z } from 'zod';

const lookupRuc = tool({
  name: 'lookup_ruc',
  description: 'Busca la razón social registrada para un RUC en el padrón.',
  parameters: z.object({
    ruc: z.string().describe('RUC con dígito verificador, formato 80012345-6'),
  }),
  strict: true,
  execute: async ({ ruc }) => {
    const fila = padron.find((p) => p.ruc === ruc);
    return fila ? JSON.stringify(fila) : 'no encontrado';
  },
});

const agent = new Agent({
  name: 'Validador',
  instructions: 'Validás facturas contra el padrón. Nunca inventes una razón social.',
  model: 'gpt-5.6-luna',
  tools: [lookupRuc],
});
```

El SDK pide zod v4. `execute` devuelve string o algo serializable: eso es lo que vuelve al modelo.

Herramientas alojadas del lado de OpenAI, que se importan y se usan sin implementar nada: `webSearchTool()`, `fileSearchTool()`, `codeInterpreterTool()`, `imageGenerationTool()`, `computerTool()`.

## Handoffs

Un agente delega en otro. Se declaran en la configuración del agente, y para que los tipos acompañen se usa `Agent.create({ handoffs: [...] })` en vez del constructor. El helper `handoff()` permite configurar cada traspaso. Antes de escribirlo, leer `openai.github.io/openai-agents-js/guides/handoffs/`: las opciones exactas cambian entre versiones y no conviene adivinarlas.

Cuándo sirve de verdad: cuando los agentes tienen **instrucciones incompatibles**, no solo tareas distintas. Un agente que clasifica y otro que redacta pueden ser un solo agente con dos tools. Dos agentes con tono, reglas y permisos opuestos son un handoff legítimo.

## Guardrails

Validaciones que corren en paralelo al agente y lo cortan si la entrada o la salida no cumplen. Es la forma que tiene el SDK de decir "no dejes que esto llegue al usuario". Para un demo con jurado, el equivalente barato es validar en código después de la llamada, que es más fácil de mostrar en pantalla.

## Subpaquetes

```ts
import { RealtimeAgent, RealtimeSession } from '@openai/agents/realtime';
import { SandboxAgent, gitRepo } from '@openai/agents/sandbox';
import { UnixLocalSandboxClient } from '@openai/agents/sandbox/local';
```

El agente de voz se conecta con `await session.connect({ apiKey })` y usa una **client key**, no la key de servidor. No poner `OPENAI_API_KEY` en código de navegador.

## Modelo

Vale lo mismo que en la skill `openai-responses`: `gpt-5.6-luna` como default, y la familia gpt-5.x rechaza `temperature` y `top_p`. Si el SDK expone un `modelSettings` con temperatura, dejarlo sin tocar para estos modelos.

## Costo de depuración

El loop decide solo cuántas veces llama al modelo. Un agente con tres tools puede hacer cinco llamadas para una respuesta, y en un demo eso se ve como una pausa larga sin explicación. Si el tiempo de respuesta importa, medirlo antes de comprometerse, y tener a mano la versión con una sola llamada.
