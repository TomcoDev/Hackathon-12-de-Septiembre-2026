// hackathon 12/09/2026
// Plomería del agente ambiental: estado por chat, guardas y umbral.
// El PATRÓN no va acá: va en src/detectors/<patron>.ts implementando la interfaz Detector.

export type Msg = { id: number; from: string; text: string; ts: number };

export type Intervention = {
  message: string;
  evidence: string[];
  confidence: number;
};

export type ChatState = {
  mensajes: Msg[];
  participantes: Set<string>;
  muteado: boolean;
  ultimaIntervencion: Intervention | null;
  desdeUltimoChequeo: number;
  desdeUltimaIntervencion: number;
};

export type Detector = {
  name: string;
  /** Filtro barato, sin LLM. Si devuelve false no se gasta una llamada. */
  shouldRun(state: ChatState, msg: Msg): boolean;
  /** Llama al modelo con schema estricto. null = no hay nada que decir. */
  run(state: ChatState, msg: Msg): Promise<Intervention | null>;
};

/** Ventana fija: el costo por llamada no crece con la conversación. */
const VENTANA = 40;

/** Solo se interviene por encima de esto. Calibrar con replay, no a ojo. */
export const UMBRAL = 0.8;

/** Mínimos para no correr el detector en cada mensaje ni insistir. */
const MIN_MENSAJES_ENTRE_CHEQUEOS = 3;
const MIN_MENSAJES_ENTRE_INTERVENCIONES = 10;

const estados = new Map<number, ChatState>();

export function getState(chatId: number): ChatState {
  let s = estados.get(chatId);
  if (!s) {
    s = {
      mensajes: [],
      participantes: new Set(),
      muteado: false,
      ultimaIntervencion: null,
      desdeUltimoChequeo: 0,
      desdeUltimaIntervencion: Infinity,
    };
    estados.set(chatId, s);
  }
  return s;
}

export function update(chatId: number, msg: Msg): ChatState {
  const s = getState(chatId);
  s.mensajes.push(msg);
  if (s.mensajes.length > VENTANA) s.mensajes.shift();
  s.participantes.add(msg.from);
  s.desdeUltimoChequeo++;
  s.desdeUltimaIntervencion++;
  return s;
}

export type Resultado =
  | { tipo: "silencio"; motivo: string }
  | { tipo: "intervencion"; intervencion: Intervention };

/**
 * Un solo camino de decisión, compartido por Telegram y por el replay.
 * Que los dos usen esto es lo que hace que calibrar con archivos sirva para el grupo real.
 */
export async function procesar(
  chatId: number,
  msg: Msg,
  detector: Detector,
): Promise<Resultado> {
  const state = update(chatId, msg);

  if (state.muteado) return { tipo: "silencio", motivo: "muteado" };
  if (state.desdeUltimaIntervencion < MIN_MENSAJES_ENTRE_INTERVENCIONES) {
    return { tipo: "silencio", motivo: "intervino recién" };
  }
  if (state.desdeUltimoChequeo < MIN_MENSAJES_ENTRE_CHEQUEOS) {
    return { tipo: "silencio", motivo: "pocos mensajes nuevos" };
  }
  if (!detector.shouldRun(state, msg)) {
    return { tipo: "silencio", motivo: "filtro barato" };
  }

  state.desdeUltimoChequeo = 0;

  const out = await detector.run(state, msg);
  if (!out) return { tipo: "silencio", motivo: "el modelo no vio el patrón" };

  // El schema garantiza la forma. La semántica se valida acá.
  if (out.confidence < UMBRAL) {
    return { tipo: "silencio", motivo: `confianza ${out.confidence.toFixed(2)} < ${UMBRAL}` };
  }
  if (!out.evidence?.length) {
    return { tipo: "silencio", motivo: "sin evidencia textual" };
  }

  state.ultimaIntervencion = out;
  state.desdeUltimaIntervencion = 0;
  return { tipo: "intervencion", intervencion: out };
}
