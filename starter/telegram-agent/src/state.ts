// hackathon 12/09/2026
// Estado por chat, en memoria. Sin base de datos.
//
// Cuidado: este estado vive SOLO en el proceso del bot. Las tareas de
// Trigger.dev no lo ven. Todo lo que una tarea necesite saber viaja en su
// payload, y el bot la cancela por runId si la situación se resuelve antes.

export type Msg = { id: number; from: string; text: string; ts: number };

/** La ventana que se le manda al modelo. Pura: no arrastra el resto del estado. */
export type Ventana = { mensajes: Msg[]; participantes: string[] };

/** Algo que el agente se comprometió a revisar más tarde. */
export type Seguimiento = {
  id: string;
  texto: string;
  abiertoPor: string;
  msgId: number;
  /** Run de Trigger.dev que va a despertar. Se cancela si esto se resuelve antes. */
  runId: string | null;
  resuelto: boolean;
};

export type Intervencion = {
  message: string;
  evidence: string[];
  confidence: number;
};

export type ChatState = {
  mensajes: Msg[];
  participantes: Set<string>;
  muteado: boolean;
  ultimaIntervencion: Intervencion | null;
  desdeUltimoChequeo: number;
  desdeUltimaIntervencion: number;
  seguimientos: Seguimiento[];
};

/** Ventana fija: el costo por llamada no crece con la conversación. */
const VENTANA = 40;

const estados = new Map<number, ChatState>();

export function getState(chatId: number): ChatState {
  let s = estados.get(chatId);
  if (!s) {
    s = {
      mensajes: [],
      participantes: new Set<string>(),
      muteado: false,
      ultimaIntervencion: null,
      desdeUltimoChequeo: 0,
      desdeUltimaIntervencion: Infinity,
      seguimientos: [],
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

export function ventana(s: ChatState): Ventana {
  return { mensajes: s.mensajes, participantes: [...s.participantes] };
}

export function abrirSeguimiento(
  s: ChatState,
  datos: { texto: string; abiertoPor: string; msgId: number },
): Seguimiento {
  const seg: Seguimiento = {
    id: `seg_${Date.now()}_${s.seguimientos.length}`,
    texto: datos.texto,
    abiertoPor: datos.abiertoPor,
    msgId: datos.msgId,
    runId: null,
    resuelto: false,
  };
  s.seguimientos.push(seg);
  return seg;
}

export function seguimientosAbiertos(s: ChatState): Seguimiento[] {
  return s.seguimientos.filter((x) => !x.resuelto);
}

/** Texto corto para /status. Que se lea en el celular durante el video. */
export function resumen(s: ChatState): string {
  const abiertos = seguimientosAbiertos(s);
  const lineas = [
    `mensajes en memoria: ${s.mensajes.length}`,
    `participantes: ${[...s.participantes].join(", ") || "ninguno"}`,
    `estado: ${s.muteado ? "muteado" : "escuchando"}`,
    `seguimientos abiertos: ${abiertos.length}`,
  ];
  for (const a of abiertos) lineas.push(`  · ${a.texto} (abrió ${a.abiertoPor})`);
  return lineas.join("\n");
}
