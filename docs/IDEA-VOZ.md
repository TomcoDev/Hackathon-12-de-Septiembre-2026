# Idea: que el agente escuche los audios del grupo

**Estado: no construida.** Anotada el 12/09/2026 durante el build. Decidir después
del corte de las 13:00, nunca antes: el flujo central va primero.

## El problema

El agente escucha `message:text` y nada más. Si alguien manda un audio, el agente
no se entera de que existió. En un grupo de trabajo real, y más en uno paraguayo,
eso es la mitad de la conversación invisible.

El patrón puede estar entero adentro de una nota de voz. "Che, hay que llamar al
proveedor antes del viernes" dicho en audio es exactamente una tarea sin dueño, y
hoy el detector no la ve.

## Por qué encaja con lo que ya está construido

No toca el detector, ni el umbral, ni la evidencia, ni el seguimiento diferido.
Se transcribe el audio y el texto entra al pipeline como un `Msg` más:

```
message:voice → getFile → descarga → transcripción → Msg → procesar() → igual que siempre
```

Un archivo nuevo, `src/voz.ts`, y un handler en `index.ts`. Nada más.

## Lo verificado (12/09/2026, contra developers.openai.com)

| Dato | Valor |
|---|---|
| Endpoint | `POST https://api.openai.com/v1/audio/transcriptions` |
| Modelo recomendado | `gpt-transcribe` |
| Alternativas | `gpt-4o-transcribe`, `gpt-4o-mini-transcribe`, `whisper-1` (legacy) |
| Formatos | flac, mp3, mp4, mpeg, mpga, m4a, **ogg**, wav, webm |
| Tamaño máximo | 25 MB |

Telegram manda las notas de voz en OGG con codec Opus. **ogg está soportado**, así
que no hace falta ffmpeg ni transcodificar nada. Ese era el riesgo que podía
convertir esto en dos horas, y no existe.

## El código, en borrador

```ts
// src/voz.ts
export async function transcribir(filePath: string): Promise<string> {
  const url = `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${filePath}`;
  const audio = await fetch(url).then((r) => r.arrayBuffer());

  const form = new FormData();
  // El nombre importa: la API infiere el formato de la extensión.
  form.append("file", new Blob([audio], { type: "audio/ogg" }), "voz.ogg");
  form.append("model", "gpt-transcribe");
  form.append("language", "es");

  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    // Sin Content-Type a mano: fetch le pone el boundary del multipart.
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: form,
  });
  if (!res.ok) throw new Error(`transcripción ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return (await res.json()).text as string;
}
```

Y en `index.ts`, un handler que reusa todo:

```ts
bot.on("message:voice", async (ctx) => {
  const file = await ctx.getFile();
  if (!file.file_path) return;
  const texto = await transcribir(file.file_path);
  // Desde acá es idéntico al camino de texto.
  const msg: Msg = { id: ctx.message.message_id, from: ..., text: texto, ts: ... };
  const r = await procesar(ctx.chat.id, msg, detector);
  // ...
});
```

## Los dos costos, que no son obvios

**El filtro barato deja de protegernos.** Hoy un mensaje de texto que no huele al
patrón cuesta cero, porque el filtro corre sin modelo. Un audio hay que
transcribirlo **antes** de poder filtrarlo, así que cada nota de voz es una
llamada pagada sí o sí. Es barata, pero el piso deja de ser cero.

**Suma latencia.** Un audio de treinta segundos tarda un par de segundos en
volver como texto, y recién ahí arranca el detector. Si entra al video, el guion
tiene que contemplar esa pausa.

## Lo que NO hay que hacer

Un agente de voz en vivo con la Realtime API. Necesita un cliente de navegador o
teléfono con WebRTC, no un bot de Telegram, y contradice la premisa entera: si en
el video alguien le habla al agente, deja de ser ambiental. El criterio de
Innovation & Theme Alignment castiga exactamente eso.

Acá el agente **escucha**. No conversa.

## Cuándo sí

Si a las 13:00 el flujo central está cerrado y el replay calibrado. Entra cómodo
antes de las 14:00 y le da al video un momento fuerte: alguien manda un audio, y
el agente reacciona a algo que nadie escribió.

Si a las 13:00 no está cerrado, esta página se queda como está.
