---
name: agente-ambiental
description: Arquitectura para construir un agente que vive dentro de un entorno (grupo de Telegram, formulario, portal, extensión de Chrome), observa eventos que no le están dirigidos y solo interviene cuando detecta un patrón. Usala cuando haya que escribir el detector, el estado por chat, el umbral de confianza, los comandos de control o el replay de calibración, y cuando haya que decidir si algo merece una llamada al modelo.
---

# Agente ambiental: detectar, decidir, intervenir, callarse

Un chatbot responde cuando le escriben. Un agente ambiental **mira** un entorno donde pasan cosas que no son para él y decide solo si vale la pena abrir la boca. Si en el video alguien le tipea al agente, es un chatbot con otro nombre.

El silencio es la feature. Un agente que interviene en cada mensaje es ruido y lo apagan en diez minutos.

## El pipeline, en este orden

```
evento del entorno  →  estado  →  filtro barato  →  modelo  →  umbral  →  acción  →  control
   (mensaje,          (últimos    (sin LLM,       (schema    (>= 0.8)   (reply,    (/mute,
    snapshot,          N + lo      heurísticas)    estricto)             fill)      /why)
    cambio de DOM)     del patrón)
```

Cada flecha que se saltea cuesta plata, latencia o credibilidad. El filtro barato es el que decide si el proyecto es viable: sin él, cada mensaje del grupo es una llamada al modelo.

## Estado

En memoria. Nada de base de datos: cuatro horas de build.

```ts
type Msg = { id: number; from: string; text: string; ts: number };

type ChatState = {
  mensajes: Msg[];          // ventana fija, últimos 40
  participantes: Set<string>;
  muteado: boolean;
  ultimaIntervencion: Intervention | null;   // para /why
  desdeUltimoChequeo: number;                // para no correr el detector en cada mensaje
  // + lo propio del patrón: glosario, decisiones, tareas sin dueño
};

const estados = new Map<number, ChatState>();
```

La ventana fija es lo que hace que el costo no crezca con la conversación. Cuarenta mensajes cortos entran de sobra en el contexto de cualquier modelo actual, así que el límite no es técnico: es que el modelo se distrae si le das toda la historia.

## El detector

```ts
export type Intervention = {
  message: string;      // lo que se va a decir, máximo 3 líneas
  evidence: string[];   // citas textuales de los mensajes que lo prueban
  confidence: number;   // 0 a 1
};

export type Detector = {
  name: string;
  /** Filtro barato. Sin LLM. Decide si vale gastar una llamada. */
  shouldRun(state: ChatState, msg: Msg): boolean;
  /** Llama al modelo. Devuelve null si no hay nada que decir. */
  run(state: ChatState, msg: Msg): Promise<Intervention | null>;
};
```

Un detector. Uno solo. Dos detectores a medias puntúan peor que uno que funciona.

### El filtro barato es donde está el ingenio

Heurísticas que corren en microsegundos y filtran el noventa y pico por ciento de los mensajes:

- **Deriva de definiciones:** un sustantivo que aparece en boca de dos personas distintas, tres o más veces, en una ventana corta.
- **Decisión no anotada:** frases de cierre ("dale", "listo", "hacemos X", "ok") seguidas de cambio de tema.
- **Tarea sin dueño:** verbo de acción en infinitivo o futuro sin pronombre de primera persona cerca ("hay que mandar", "falta armar").

Sumale siempre dos condiciones de guarda: al menos N mensajes desde el último chequeo, y no haber intervenido en los últimos M mensajes. Un agente que insiste es peor que uno que se pierde un caso.

### El prompt del detector

Reglas que cambian el resultado:

1. **Pedir evidencia textual.** El modelo tiene que citar los mensajes exactos. Sin cita, no hay intervención. Esto solo elimina la mayoría de los falsos positivos, porque obliga a anclar la afirmación en algo que existe.
2. **Prohibir consejos y resúmenes.** El agente señala un patrón, no opina, no modera, no resume la conversación. "Ojo: cuando Juan dice cliente habla del usuario final y cuando María lo dice habla de la empresa que paga. Llevan 8 mensajes hablando de cosas distintas." Eso es todo.
3. **Nombres propios adentro.** Un mensaje genérico parece un bot. Uno que dice quién dijo qué parece que estuvo prestando atención.
4. **Darle permiso explícito de no disparar.** En el prompt: "si no estás seguro, fire es false. Preferimos callarnos a equivocarnos." Sin esa frase, el modelo complace y encuentra patrones donde no hay.
5. **Schema estricto.** Ver la skill `openai-responses`. La forma de la salida no se pide en el prompt, se garantiza con `strict: true`.

## El umbral

Intervenir solo con `confidence >= 0.8`. El número no se elige a ojo: se calibra con el replay.

El replay es un script que reproduce una conversación guionada mensaje por mensaje por el mismo pipeline, sin Telegram, e imprime en qué mensaje intervino, con qué confianza y con qué evidencia. Es el test y es la herramienta de calibración, y cuesta veinte minutos escribirlo.

```
npm run replay -- docs/test-conversations/caso1.json
```

Criterio de terminado: sobre el caso donde el patrón existe, interviene en el mensaje correcto o uno después. Sobre el caso donde no existe, no interviene ni una vez. Recién ahí se prueba en el grupo real.

Si el caso sutil no dispara y el caso negativo sí, el problema casi nunca es el umbral: es que el prompt no pide evidencia o el filtro barato deja pasar lo que no debe.

## El control es un criterio, no un extra

El rubro oficial lo puntúa bajo *Usefulness & Agentic Experience*: acciones con sentido, feedback comprensible y control apropiado. Cuatro comandos, quince minutos de trabajo:

| Comando | Qué hace |
|---|---|
| `/mute` | deja de intervenir en este chat |
| `/unmute` | vuelve |
| `/status` | muestra el estado resumido: cuántos mensajes, qué tiene detectado |
| `/why` | repite la última intervención con la evidencia completa |

`/why` es el que más impresiona en un demo: convierte una afirmación del agente en algo auditable.

En un agente de navegador el equivalente es: nunca escribir en un campo sin click de la persona, mostrar la razón al lado de la propuesta, y poder ignorar. Escribir en el DOM sin confirmación es la forma más rápida de perder el criterio 4.

## Presupuesto por evento

Antes de construir, hacer la cuenta. Con `gpt-5.6-luna` a $0.20 por millón de tokens de entrada, un detector con cuarenta mensajes de contexto son unos mil tokens por corrida. Mil corridas cuestan centavos. El problema nunca es la plata: es la **latencia**. Cada corrida con `effort: "medium"` son segundos, y un agente que reacciona tarde en el video parece roto.

Por eso `effort: "low"` o `"none"`, y por eso el filtro barato.

## El criterio que el guion del video no cubre

El rubro oficial del kit tiene cuatro criterios. El tercero, *Technical Execution & Integration*, pide explícitamente mostrar **cómo se maneja un error o una cancelación**. Las cinco reglas de `docs/GUION_VIDEO.md` no cubren ninguna de las dos.

Cuesta diez segundos de video. Una intervención que la persona corta con `/mute`, o un caso donde el detector duda y el agente se calla, con el motivo visible en la consola. Mostrar que el sistema degrada bien vale más que un segundo caso de éxito.

Lo mismo con el primero, *Core Requirements & Functionality*: pide un resultado real. Una aprobación no prueba que la acción se ejecutó. Si el agente escribe en un campo, se muestra el campo cambiado. Si postea en el grupo, se muestra el mensaje en el grupo.

## Anti-patrones que se ven en los demos

- **El agente que saluda.** Nadie le habló. No tiene que presentarse.
- **El resumen de la conversación.** Eso lo hace ChatGPT con copiar y pegar. Si el demo se puede reproducir pegando el chat en una ventana, el entorno era un contenedor y el criterio 2 se pierde.
- **El detector que corre en cada mensaje.** Se nota en la latencia y en la factura.
- **Dos detectores a medias.** Uno que funciona gana.
- **Intervenir sin evidencia.** Parece magia, y la magia puntúa bajo.
- **Estado global en vez de por chat.** Se rompe apenas hay dos grupos.

## Las cinco preguntas, respondidas por la arquitectura

Las de `docs/CRONOGRAMA.md`, que hay que responder a las 11:00:

1. *¿Qué decide que un if no decidiría?* → que dos usos de la misma palabra significan cosas distintas. Eso es semántica, no string matching. El filtro barato es el `if`; el detector es lo que un `if` no puede.
2. *¿Qué pasa si le sacás el entorno?* → no hay evento. El agente no tiene entrada.
3. *¿Quién le escribe?* → nadie. Se activa por `message:text` o por un cambio de DOM.
4. *¿Qué controla el usuario?* → mute, why, y en el navegador el click antes de escribir.
5. *¿Qué parte existía ayer?* → los starters conectan y responden `/ping`. Todo lo de arriba de esta página se construye hoy y va en `docs/BUILD_LOG.md`.
