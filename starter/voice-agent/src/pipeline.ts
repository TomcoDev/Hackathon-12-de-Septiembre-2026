// Plomeria del agente ambiental de voz: estado por sala, guardas, umbral y bitacora.
// El PATRON no va aca: va en src/detectors/<patron>.ts implementando Detector.
//
// evento (frase) -> estado -> filtro barato -> modelo -> umbral -> accion -> control
//
// El silencio es la feature. Cada guarda de aca abajo existe para NO hablar.

export type Utterance = {
  id: number;
  speaker: string;
  text: string;
  ts: number;
  /** ms que tardo la transcripcion. Solo para la bitacora. */
  msAsr?: number;
};

/** Lo que el detector propone hacer. La accion es opcional: muchas veces solo se habla. */
export type Intervention = {
  /** Lo que el agente dice en voz alta. Maximo 2 frases: interrumpe gente hablando. */
  message: string;
  /** Citas textuales de lo que se dijo. Sin evidencia no se interviene. */
  evidence: string[];
  confidence: number;
  /** Accion a ejecutar. null = solo hablar. */
  action: { name: string; params: Record<string, unknown> } | null;
};

export type RoomState = {
  frases: Utterance[];
  hablantes: Set<string>;
  muteado: boolean;
  ultimaIntervencion: Intervention | null;
  desdeUltimoChequeo: number;
  desdeUltimaIntervencion: number;
  /** Todo lo que se decidio, incluido callarse. Es lo que se muestra en pantalla. */
  bitacora: Decision[];
};

export type Decision = {
  ts: number;
  frase: string;
  speaker: string;
} & Resultado;

export type Detector = {
  name: string;
  /** Filtro barato, sin LLM. false = no se gasta una llamada. Aca esta el ingenio. */
  shouldRun(state: RoomState, u: Utterance): boolean;
  /** Llama al modelo con schema estricto. null = no hay nada que decir. */
  run(state: RoomState, u: Utterance): Promise<Intervention | null>;
};

/** Lo que decide la tuberia, sin el cronometro. Omit<> sobre una union borra los campos
 *  propios de cada rama, asi que la union va declarada aparte. */
export type Veredicto =
  | { tipo: "silencio"; motivo: string }
  | { tipo: "intervencion"; intervencion: Intervention };

export type Resultado = Veredicto & { ms: number };

/** Ventana fija: el costo por llamada no crece con la conversacion. */
const VENTANA = 40;
/** Cuantas decisiones se guardan para la pantalla y para /why. */
const BITACORA = 60;

/** Solo se habla por encima de esto. Calibrar con `npm run replay`, no a ojo. */
export const UMBRAL = Number(process.env.UMBRAL ?? 0.8);

/** Guardas para no correr el detector en cada frase ni insistir. */
const MIN_FRASES_ENTRE_CHEQUEOS = Number(process.env.MIN_CHEQUEO ?? 2);
const MIN_FRASES_ENTRE_INTERVENCIONES = Number(process.env.MIN_INTERV ?? 8);

const salas = new Map<string, RoomState>();

export function getState(room: string): RoomState {
  let s = salas.get(room);
  if (!s) {
    s = {
      frases: [],
      hablantes: new Set(),
      muteado: false,
      ultimaIntervencion: null,
      desdeUltimoChequeo: 0,
      desdeUltimaIntervencion: Infinity,
      bitacora: [],
    };
    salas.set(room, s);
  }
  return s;
}

export function resetState(room: string): void {
  salas.delete(room);
}

let siguienteId = 1;
export function nuevaFrase(speaker: string, text: string, msAsr?: number): Utterance {
  return { id: siguienteId++, speaker, text, ts: Date.now(), msAsr };
}

/**
 * Un solo camino de decision, compartido por el microfono y por el replay.
 * Que los dos pasen por aca es lo que hace que calibrar con archivos sirva en vivo.
 */
export async function procesar(
  room: string,
  u: Utterance,
  detector: Detector,
): Promise<Resultado> {
  const t0 = Date.now();
  const state = getState(room);

  state.frases.push(u);
  if (state.frases.length > VENTANA) state.frases.shift();
  state.hablantes.add(u.speaker);
  state.desdeUltimoChequeo++;
  state.desdeUltimaIntervencion++;

  const fin = (r: Veredicto): Resultado => {
    const res: Resultado = { ...r, ms: Date.now() - t0 };
    state.bitacora.push({ ts: Date.now(), frase: u.text, speaker: u.speaker, ...res });
    if (state.bitacora.length > BITACORA) state.bitacora.shift();
    return res;
  };

  if (state.muteado) return fin({ tipo: "silencio", motivo: "muteado" });
  if (state.desdeUltimaIntervencion < MIN_FRASES_ENTRE_INTERVENCIONES) {
    return fin({ tipo: "silencio", motivo: "hablo recien" });
  }
  if (state.desdeUltimoChequeo < MIN_FRASES_ENTRE_CHEQUEOS) {
    return fin({ tipo: "silencio", motivo: "pocas frases nuevas" });
  }
  if (!detector.shouldRun(state, u)) {
    return fin({ tipo: "silencio", motivo: "filtro barato" });
  }

  state.desdeUltimoChequeo = 0;

  let out: Intervention | null;
  try {
    out = await detector.run(state, u);
  } catch (e: unknown) {
    // Que falle el modelo no puede tumbar al agente: se registra y se sigue escuchando.
    return fin({ tipo: "silencio", motivo: `error del modelo: ${(e as Error).message}`.slice(0, 160) });
  }

  if (!out) return fin({ tipo: "silencio", motivo: "el modelo no vio el patron" });

  // El schema garantiza la forma. La semantica se valida aca.
  if (out.confidence < UMBRAL) {
    return fin({ tipo: "silencio", motivo: `confianza ${out.confidence.toFixed(2)} < ${UMBRAL}` });
  }
  if (!out.evidence?.length) {
    return fin({ tipo: "silencio", motivo: "sin evidencia textual" });
  }

  state.ultimaIntervencion = out;
  state.desdeUltimaIntervencion = 0;
  return fin({ tipo: "intervencion", intervencion: out });
}
