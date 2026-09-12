// Cargar el .env de la raiz ANTES de leer process.env.
import "./env.js";

// hackathon 12/09/2026
// Cliente de la Responses API de OpenAI. Sin dependencias: solo fetch nativo (Node 18+).
// Reemplaza al cliente de OpenRouter de los starters manteniendo la firma chat(messages, opts),
// así que index.ts no necesita cambios. Agrega opts.schema (structured outputs estrictos).
//
// Docs: https://developers.openai.com/api/docs/guides/structured-outputs
//
// En .env:
//   OPENAI_API_KEY=...
//   OPENAI_MODEL=gpt-5.6-luna
//   OPENROUTER_API_KEY=...            # opcional, plan B automático
//   OPENROUTER_MODEL=openai/gpt-5.6-luna

export type Message = { role: "system" | "user" | "assistant"; content: string };

export type Schema = {
  /** Nombre del schema. Solo letras, números y guión bajo. */
  name: string;
  /** JSON Schema. Todo campo en required, additionalProperties:false en cada objeto. */
  schema: Record<string, unknown>;
};

export type ChatOpts = {
  model?: string;
  /** Si va, la respuesta viene garantizada con esa forma. Preferir esto a pedir JSON en el prompt. */
  schema?: Schema;
  /** none | low | medium | high | xhigh | max. Default low: el detector corre por mensaje. */
  effort?: "none" | "low" | "medium" | "high" | "xhigh" | "max";
  maxOutputTokens?: number;
  /** Corta la llamada. Default 30s. En un demo, fallar rápido es mejor que colgarse. */
  timeoutMs?: number;
};

const OPENAI_URL = "https://api.openai.com/v1/responses";
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

export const DEFAULT_MODEL = process.env.OPENAI_MODEL ?? "gpt-5.6-luna";

/** La familia gpt-5.x y gpt-6 rechazan temperature y top_p: el error es que el parámetro esté. */
function esRazonador(model: string): boolean {
  return /^(gpt-5|gpt-6|o[1-9])/.test(model.replace(/^openai\//, ""));
}

/**
 * Llama al modelo y devuelve el texto crudo.
 * Usa OpenAI si hay OPENAI_API_KEY; si no, cae a OpenRouter sin cambiar el código que la llama.
 */
export async function chat(messages: Message[], opts: ChatOpts = {}): Promise<string> {
  if (process.env.OPENAI_API_KEY) return chatOpenAI(messages, opts);
  if (process.env.OPENROUTER_API_KEY) return chatOpenRouter(messages, opts);
  throw new Error("Falta OPENAI_API_KEY (o OPENROUTER_API_KEY) en .env");
}

/**
 * Igual que chat() pero devuelve el objeto ya parseado. Exige schema.
 * Con strict:true el parseo no puede fallar por forma; si falla, es un problema de transporte.
 */
export async function chatJSON<T>(
  messages: Message[],
  opts: ChatOpts & { schema: Schema },
): Promise<T> {
  const raw = await chat(messages, opts);
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new Error(`El modelo no devolvió JSON válido: ${raw.slice(0, 200)}`);
  }
}

async function chatOpenAI(messages: Message[], opts: ChatOpts): Promise<string> {
  const model = opts.model ?? DEFAULT_MODEL;

  const body: Record<string, unknown> = {
    model,
    input: messages,
    max_output_tokens: opts.maxOutputTokens ?? 2000,
  };

  // reasoning solo va a modelos que razonan. A un gpt-4o le da 400.
  if (esRazonador(model)) body.reasoning = { effort: opts.effort ?? "low" };

  if (opts.schema) {
    body.text = {
      format: {
        type: "json_schema",
        name: opts.schema.name,
        schema: opts.schema.schema,
        strict: true,
      },
    };
  }

  const data = await postConReintentos(
    OPENAI_URL,
    { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body,
    opts.timeoutMs ?? 30_000,
  );

  return extraerTexto(data);
}

/** Plan B. Mismo contrato, endpoint chat/completions, schema en el formato anidado. */
async function chatOpenRouter(messages: Message[], opts: ChatOpts): Promise<string> {
  const model = opts.model ?? process.env.OPENROUTER_MODEL ?? "openai/gpt-5.6-luna";

  const body: Record<string, unknown> = { model, messages };
  if (!esRazonador(model)) body.temperature = 0;
  if (opts.schema) {
    body.response_format = {
      type: "json_schema",
      json_schema: { name: opts.schema.name, schema: opts.schema.schema, strict: true },
    };
  }

  const data = await postConReintentos(
    OPENROUTER_URL,
    {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "HTTP-Referer": "https://github.com/TomcoDev/Hackathon-12-de-Septiembre-2026",
      "X-Title": "Terere Driven Development",
    },
    body,
    opts.timeoutMs ?? 30_000,
  );

  const texto = (data as any)?.choices?.[0]?.message?.content;
  if (typeof texto !== "string" || !texto) throw new Error("OpenRouter devolvió una respuesta vacía");
  return texto;
}

/**
 * El output mezcla items de reasoning y el mensaje: nunca indexar output[0].
 * Maneja además refusal e incomplete, que el starter original ignoraba.
 */
function extraerTexto(data: unknown): string {
  const d = data as any;

  const partes: string[] = [];
  for (const item of d?.output ?? []) {
    if (item?.type !== "message") continue;
    for (const c of item?.content ?? []) {
      if (c?.type === "output_text" && typeof c.text === "string") partes.push(c.text);
      if (c?.type === "refusal") throw new Error(`El modelo se negó: ${c.refusal}`);
    }
  }
  if (partes.length) return partes.join("");

  if (d?.status === "incomplete") {
    throw new Error(`Respuesta incompleta: ${d?.incomplete_details?.reason ?? "motivo desconocido"}`);
  }
  if (typeof d?.output_text === "string" && d.output_text) return d.output_text;
  throw new Error(`Respuesta sin texto (status: ${d?.status ?? "?"})`);
}

/** Reintenta 429 y 5xx con backoff. Un 400 o 401 no se reintenta: no se va a arreglar solo. */
async function postConReintentos(
  url: string,
  headers: Record<string, string>,
  body: unknown,
  timeoutMs: number,
  intentos = 3,
): Promise<unknown> {
  let ultimo = "";

  for (let i = 0; i < intentos; i++) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });

      if (res.ok) return await res.json();

      const texto = (await res.text()).slice(0, 400);
      if (res.status !== 429 && res.status < 500) {
        throw new Error(`${res.status}: ${texto}${pista(res.status, texto)}`);
      }
      ultimo = `${res.status}: ${texto}`;
    } catch (e: any) {
      if (e?.name === "AbortError") ultimo = `timeout de ${timeoutMs}ms`;
      else if (String(e?.message ?? "").match(/^\d{3}:/)) throw e;
      else ultimo = String(e?.message ?? e);
    } finally {
      clearTimeout(t);
    }

    if (i < intentos - 1) await new Promise((r) => setTimeout(r, 500 * 2 ** i));
  }

  throw new Error(`La llamada al modelo falló tras ${intentos} intentos. Último error: ${ultimo}`);
}

/** Traduce los errores que más tiempo hacen perder. */
function pista(status: number, texto: string): string {
  if (status === 400 && /temperature|top_p/i.test(texto)) {
    return "\n  → los modelos gpt-5.x rechazan temperature y top_p. Sacá el parámetro.";
  }
  if (status === 400 && /schema|required|additionalProperties/i.test(texto)) {
    return "\n  → con strict:true todo campo va en required y cada objeto lleva additionalProperties:false.";
  }
  if (status === 401) {
    return "\n  → la key no llegó. Importá 'dotenv/config' antes del módulo que lee process.env.";
  }
  return "";
}
