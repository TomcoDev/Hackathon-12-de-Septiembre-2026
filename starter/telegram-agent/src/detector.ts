// hackathon 12/09/2026
// Contrato del detector y el único camino de decisión del agente.
//
// Este módulo NO importa Trigger.dev ni grammY a propósito: lo usan el bot, el
// replay y las tareas en background sin arrastrarse dependencias entre sí.

import { chatJSON, type Schema } from "./llm.js";
import { update, ventana, type ChatState, type Intervencion, type Msg, type Ventana } from "./state.js";

export type Deteccion = {
  fire: boolean;
  confidence: number;
  message: string | null;
  evidence: string[];
  /** Qué habría que revisar dentro de un rato. null si no aplica. */
  followup: string | null;
};

export type Detector = {
  name: string;
  /** Filtro barato, SIN llamar al modelo. Decide si vale gastar una llamada. */
  shouldRun(v: Ventana, msg: Msg): boolean;
  /** Llama al modelo. Devuelve null si no hay nada que decir. */
  run(v: Ventana, msg: Msg): Promise<Deteccion | null>;
};

/** Solo se interviene por encima de esto. Calibrar con el replay, no a ojo. */
export const UMBRAL = Number(process.env.UMBRAL ?? 0.8);

/** Guardas para no correr el detector en cada mensaje ni insistir. */
const MIN_MENSAJES_ENTRE_CHEQUEOS = Number(process.env.MIN_CHEQUEO ?? 3);
const MIN_MENSAJES_ENTRE_INTERVENCIONES = Number(process.env.MIN_INTERVENCION ?? 10);

/**
 * Schema estricto compartido por todos los detectores.
 * Con strict:true la forma está garantizada: no hace falta parseo defensivo.
 * Todo campo va en required; lo que puede faltar se declara nullable.
 */
export const ESQUEMA_DETECCION: Schema = {
  name: "deteccion",
  schema: {
    type: "object",
    properties: {
      fire: {
        type: "boolean",
        description: "true SOLO si el patrón está claramente presente. Ante la duda, false.",
      },
      confidence: {
        type: "number",
        description: "0 a 1. Qué tan seguro estás de que el patrón está presente.",
      },
      message: {
        type: ["string", "null"],
        description:
          "Lo que el agente va a decir en el grupo. Español rioplatense, máximo 3 líneas, " +
          "con nombres propios. Señala el patrón, no da consejos ni resume. null si fire es false.",
      },
      evidence: {
        type: "array",
        description: "Citas TEXTUALES de los mensajes que prueban el patrón. Vacío si fire es false.",
        items: { type: "string" },
      },
      followup: {
        type: ["string", "null"],
        description:
          "Si esto debería revisarse más tarde porque todavía no está resuelto, describilo en " +
          "una línea. null si no hay nada que revisar después.",
      },
    },
    required: ["fire", "confidence", "message", "evidence", "followup"],
    additionalProperties: false,
  },
};

/** Formatea la ventana para el prompt. Quién dijo qué, numerado para poder citar. */
export function transcribir(v: Ventana): string {
  return v.mensajes.map((m) => `[${m.id}] ${m.from}: ${m.text}`).join("\n");
}

/**
 * Llamada estándar al modelo. Un detector concreto solo aporta su system prompt.
 * Devuelve null si el modelo no disparó, así el detector no repite la validación.
 */
export async function evaluar(system: string, v: Ventana): Promise<Deteccion | null> {
  const out = await chatJSON<Deteccion>(
    [
      { role: "system", content: system },
      { role: "user", content: transcribir(v) },
    ],
    { schema: ESQUEMA_DETECCION, effort: "low" },
  );
  return out.fire ? out : null;
}

export type Resultado =
  | { tipo: "silencio"; motivo: string }
  | { tipo: "intervencion"; intervencion: Intervencion; followup: string | null };

/**
 * Validación semántica de la salida del modelo. El schema garantiza la forma;
 * esto garantiza el criterio. La comparten el camino inline y el de background,
 * así el umbral es uno solo y calibrarlo sirve para los dos.
 */
export function validar(out: Deteccion | null): Resultado {
  if (!out) return { tipo: "silencio", motivo: "el modelo no vio el patrón" };
  if (out.confidence < UMBRAL) {
    return { tipo: "silencio", motivo: `confianza ${out.confidence.toFixed(2)} < ${UMBRAL}` };
  }
  if (!out.evidence.length) return { tipo: "silencio", motivo: "sin evidencia textual" };
  if (!out.message) return { tipo: "silencio", motivo: "disparó sin mensaje" };

  return {
    tipo: "intervencion",
    intervencion: { message: out.message, evidence: out.evidence, confidence: out.confidence },
    followup: out.followup,
  };
}

/**
 * El único camino de decisión. Lo usan el bot y el replay, y por eso calibrar
 * con archivos sirve para el grupo real.
 */
export async function procesar(
  chatId: number,
  msg: Msg,
  detector: Detector,
): Promise<Resultado> {
  const state: ChatState = update(chatId, msg);

  if (state.muteado) return { tipo: "silencio", motivo: "muteado" };
  if (state.desdeUltimaIntervencion < MIN_MENSAJES_ENTRE_INTERVENCIONES) {
    return { tipo: "silencio", motivo: "intervino recién" };
  }
  if (state.desdeUltimoChequeo < MIN_MENSAJES_ENTRE_CHEQUEOS) {
    return { tipo: "silencio", motivo: "pocos mensajes nuevos" };
  }

  const v = ventana(state);
  if (!detector.shouldRun(v, msg)) return { tipo: "silencio", motivo: "filtro barato" };

  state.desdeUltimoChequeo = 0;

  const r = validar(await detector.run(v, msg));
  if (r.tipo === "silencio") return r;

  state.ultimaIntervencion = r.intervencion;
  state.desdeUltimaIntervencion = 0;
  return r;
}
