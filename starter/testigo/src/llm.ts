// hackathon 12/09/2026 — EL TESTIGO
// Cliente de la Agents API de OpenAI (beta). Sin dependencias: solo fetch nativo (Node 18+).
// Mismo contrato que el cliente anterior (Responses API): chat(messages, opts) y chatJSON,
// así que detectores/ y redactor.ts no necesitan cambios.
//
// Qué cambió respecto a /v1/responses:
// - Endpoint: POST /v1/agents/sessions con header OpenAI-Beta: agents=v1.
// - El system prompt va en agent.instructions (el input solo acepta rol "user").
// - Structured outputs: agent.text.format = { type: "json_schema", schema } (sin name/strict).
// - Sin stream: hay que poll-ar GET /agents/sessions/{id} hasta status "idle" y
//   leer los items (GET .../items) buscando el message final del assistant.
// - La sesión queda guardada del lado de OpenAI → DELETE al final (best-effort).
//
// Docs: https://developers.openai.com/api/docs/guides/agents-api/overview
//
// En .env:
//   OPENAI_API_KEY=...            (necesita permisos api.agents.read/write)
//   OPENAI_MODEL=gpt-5.6-luna
//   OPENROUTER_API_KEY=...        # opcional, plan B automático
//   OPENROUTER_MODEL=openai/gpt-5.6-luna

// Cargar el .env de la raiz ANTES de leer process.env.
import "./env.js";

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

const OPENAI_URL = "https://api.openai.com/v1/agents/sessions";
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

/** Poll de sesión: cada cuánto mirar el estado. */
const POLL_MS = 700;
/** Tope de ciclos de poll. Con el default de timeoutMs (30s) sobran. */
const POLL_MAX = 40;

export const DEFAULT_MODEL = process.env.OPENAI_MODEL ?? "gpt-5.6-luna";

/** La familia gpt-5.x y gpt-6 rechazan temperature y top_p: el error es que el parámetro esté. */
function esRazonador(model: string): boolean {
  return /^(gpt-5|gpt-6|o[1-9])/.test(model.replace(/^openai\//, ""));
}

/**
 * Llama al modelo y devuelve el texto crudo.
 * Usa la Agents API si hay OPENAI_API_KEY; si no, cae a OpenRouter sin cambiar el código que la llama.
 */
export async function chat(messages: Message[], opts: ChatOpts = {}): Promise<string> {
  if (process.env.OPENAI_API_KEY) return chatAgentsApi(messages, opts);
  if (process.env.OPENROUTER_API_KEY) return chatOpenRouter(messages, opts);
  throw new Error("Falta OPENAI_API_KEY (o OPENROUTER_API_KEY) en .env");
}

/**
 * Igual que chat() pero devuelve el objeto ya parseado. Exige schema.
 * Con json_schema el parseo no puede fallar por forma; si falla, es un problema de transporte.
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

/** Una pasada por la Agents API: crea sesión con input, espera el turno, extrae y borra. */
async function chatAgentsApi(messages: Message[], opts: ChatOpts): Promise<string> {
  const model = opts.model ?? DEFAULT_MODEL;

  // El input de la Agents API solo acepta rol "user": el system prompt viaja como
  // instructions del agente (se concatenan las que lleguen), el resto va como items.
  const instructions = messages
    .filter((m) => m.role === "system")
    .map((m) => m.content)
    .join("\n\n");

  const input = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: "user",
      content: [{ type: "input_text", text: m.content }],
    }));

  if (input.length === 0) throw new Error("La Agents API requiere al menos un mensaje de user");

  const agent: Record<string, unknown> = { model };
  if (instructions) agent.instructions = instructions;
  // reasoning solo va a modelos que razonan (mismo criterio que antes).
  if (esRazonador(model)) agent.reasoning = { effort: opts.effort ?? "low" };
  if (opts.schema) {
    agent.text = { format: { type: "json_schema", schema: opts.schema.schema } };
  }

  const body: Record<string, unknown> = {
    agent,
    // Sin sandbox: EL TESTIGO solo clasifica y redacta, no ejecuta nada.
    environment: { type: "none" },
    input,
  };

  const timeout = opts.timeoutMs ?? 30_000;
  const sesion = (await postConReintentos(
    OPENAI_URL,
    { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "OpenAI-Beta": "agents=v1" },
    body,
    timeout,
  )) as any;

  try {
    if (sesion.status === "failed") {
      throw new Error(`La sesión falló: ${sesion.error ?? "motivo desconocido"}`);
    }
    if (sesion.status === "requires_action") {
      // Sin tools declaradas no debería pasar; si pasa, es deuda de este contrato.
      throw new Error("La sesión quedó esperando una acción que no sabemos cumplir");
    }
    // create() con input arranca el turno async: esperar a que termine.
    if (sesion.status === "in_progress") return await esperarYExtraer(sesion.id, timeout);

    // status "idle" sin pasar por in_progress: el turno ya terminó.
    return await extraerTexto(sesion.id);
  } finally {
    // La sesión persiste del lado de OpenAI: limpiar siempre, aunque el texto ya se tenga.
    borrarSesion(sesion.id).catch(() => {});
  }
}

/** Poll de GET /agents/sessions/{id} hasta idle/failed/requires_action. */
async function esperarYExtraer(sessionId: string, timeoutMs: number): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  let ultimoStatus = "in_progress";

  for (let i = 0; i < POLL_MAX && Date.now() < deadline; i++) {
    await dormir(POLL_MS);
    const s = (await pedirConReintentos(
      `${OPENAI_URL}/${sessionId}`,
      { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "OpenAI-Beta": "agents=v1" },
      timeoutMs,
    )) as any;
    ultimoStatus = s.status;

    if (s.status === "idle") return extraerTexto(sessionId);
    if (s.status === "failed") throw new Error(`La sesión falló: ${s.error ?? "motivo desconocido"}`);
    if (s.status === "requires_action") {
      throw new Error("La sesión quedó esperando una acción que no sabemos cumplir");
    }
    // in_progress: seguir esperando.
  }

  throw new Error(`Timeout esperando la sesión (${ultimoStatus}) tras ${POLL_MAX} polls`);
}

/**
 * Lee los items de la sesión y arma el texto final.
 * Los items mezclan reasoning, commentary y mensajes: nos quedamos con los
 * output_text de los messages del assistant, priorizando phase "final_answer".
 */
async function extraerTexto(sessionId: string): Promise<string> {
  const page = (await pedirConReintentos(
    `${OPENAI_URL}/${sessionId}/items?order=asc&limit=100`,
    { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "OpenAI-Beta": "agents=v1" },
    30_000,
  )) as any;

  const items: any[] = page?.data ?? [];

  const finales: string[] = [];
  const commentaries: string[] = [];
  for (const item of items) {
    if (item?.type !== "message" || item?.role !== "assistant") continue;
    const texto = (item.content ?? [])
      .filter((c: any) => c?.type === "output_text" && typeof c.text === "string")
      .map((c: any) => c.text)
      .join("");
    if (!texto) continue;
    if (item.phase === "final_answer") finales.push(texto);
    else commentaries.push(texto);
  }

  if (finales.length) return finales.join("");
  // Sin marca de phase: el último message del assistant es el final.
  if (commentaries.length) return commentaries[commentaries.length - 1];
  throw new Error("El agente terminó sin dejar texto");
}

/** DELETE best-effort: si falla, la sesión huérfana expira sola del lado de OpenAI. */
async function borrarSesion(sessionId: string): Promise<void> {
  try {
    await fetch(`${OPENAI_URL}/${sessionId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "OpenAI-Beta": "agents=v1",
      },
    });
  } catch {
    // best-effort a propósito.
  }
}

function dormir(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
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

/** GET con los mismos reintentos que el POST (para poll e items). */
async function pedirConReintentos(
  url: string,
  headers: Record<string,  string>,
  timeoutMs: number,
  intentos = 3,
): Promise<unknown> {
  let ultimo = "";

  for (let i = 0; i < intentos; i++) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, { headers, signal: ctrl.signal });
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

  throw new Error(`El pedido al modelo falló tras ${intentos} intentos. Último error: ${ultimo}`);
}

/** Traduce los errores que más tiempo hacen perder. */
function pista(status: number, texto: string): string {
  if (status === 400 && /temperature|top_p/i.test(texto)) {
    return "\n  → los modelos gpt-5.x rechazan temperature y top_p. Sacá el parámetro.";
  }
  if (status === 400 && /schema|required|additionalProperties/i.test(texto)) {
    return "\n  → en json_schema todo campo va en required y cada objeto lleva additionalProperties:false.";
  }
  if (status === 401) {
    return "\n  → la key no llegó o no tiene permisos de Agents (api.agents.read/write).";
  }
  if (status === 403) {
    return "\n  → la key necesita api.agents.read + api.agents.write además de api.responses.write.";
  }
  if (status === 404) {
    return "\n  → la Agents API está en beta: confirmá el endpoint /v1/agents/sessions y el header agents=v1.";
  }
  return "";
}
