// Voz de entrada y de salida por REST. Nada de WebRTC ni WebSocket.
//
// Por que no Realtime API: un agente ambiental no conversa, escucha y a veces habla.
// Tolera 1-2 segundos. Realtime paga latencia sub-segundo con SDP, tokens efimeros y
// un canal que se cae en wifi de evento. Estos dos endpoints son REST estable.
//
// Docs: https://developers.openai.com/api/docs/guides/speech-to-text
//       https://developers.openai.com/api/docs/guides/text-to-speech

import { exigirKey, TRANSCRIBE_MODEL, TTS_MODEL, TTS_VOICE } from "./env.js";

const TRANSCRIBE_URL = "https://api.openai.com/v1/audio/transcriptions";
const TTS_URL = "https://api.openai.com/v1/audio/speech";

/** Modelos de transcripcion a probar, en orden. whisper-1 es el que siempre existe. */
const CASCADA_TRANSCRIPCION = [TRANSCRIBE_MODEL, "whisper-1"].filter(
  (m, i, a) => a.indexOf(m) === i,
);

export type Transcripcion = { text: string; modelo: string; ms: number };

/**
 * Audio -> texto. Si el modelo configurado no existe en la cuenta, cae a whisper-1
 * en vez de tirar el evento. En un demo, degradar es mejor que perder la frase.
 */
export async function transcribir(
  audio: Buffer,
  opts: { mime?: string; idioma?: string; pista?: string } = {},
): Promise<Transcripcion> {
  const key = exigirKey();
  const t0 = Date.now();
  const errores: string[] = [];

  for (const modelo of CASCADA_TRANSCRIPCION) {
    const fd = new FormData();
    fd.append("file", new Blob([new Uint8Array(audio)], { type: opts.mime ?? "audio/webm" }), "u.webm");
    fd.append("model", modelo);
    fd.append("response_format", "json");
    // El idioma se pasa solo si se sabe: forzarlo mal es peor que no pasarlo.
    if (opts.idioma) fd.append("language", opts.idioma);
    // El prompt sesga el vocabulario. Sirve para nombres propios y jerga del dominio.
    if (opts.pista) fd.append("prompt", opts.pista);

    const res = await fetch(TRANSCRIBE_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
      body: fd,
    });

    if (res.ok) {
      const data = (await res.json()) as { text?: string };
      return { text: (data.text ?? "").trim(), modelo, ms: Date.now() - t0 };
    }

    const cuerpo = (await res.text()).slice(0, 200);
    errores.push(`${modelo} -> ${res.status}: ${cuerpo}`);
    // 401 y 429 no se arreglan cambiando de modelo.
    if (res.status === 401 || res.status === 429) break;
  }

  throw new Error(`No se pudo transcribir. ${errores.join(" | ")}`);
}

/** Texto -> mp3. Devuelve el buffer para que el browser lo reproduzca. */
export async function hablar(texto: string): Promise<Buffer> {
  const key = exigirKey();

  const res = await fetch(TTS_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: TTS_MODEL,
      voice: TTS_VOICE,
      input: texto,
      response_format: "mp3",
      // El agente interrumpe una conversacion ajena: tono breve y sin entusiasmo.
      instructions: "Hablá en tono neutro, breve y bajo. No saludes. No suenes entusiasta.",
    }),
  });

  if (!res.ok) {
    throw new Error(`TTS ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  return Buffer.from(await res.arrayBuffer());
}
