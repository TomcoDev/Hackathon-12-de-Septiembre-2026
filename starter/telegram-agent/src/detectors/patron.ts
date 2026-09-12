// hackathon 12/09/2026
// EL detector. Uno solo.
//
// ────────────────────────────────────────────────────────────────────────────
//  PARA ELEGIR EL PATRÓN: cambiar la constante PATRON de abajo. Nada más.
//  El filtro barato y el prompt se seleccionan solos.
// ────────────────────────────────────────────────────────────────────────────

import { evaluar, type Detector, type Deteccion } from "../detector.js";
import type { Msg, Ventana } from "../state.js";

export type Patron = "tarea-sin-dueno" | "decision-no-anotada" | "deriva-definiciones";

/** ← ACÁ. Una de las tres. */
export const PATRON: Patron = (process.env.PATRON as Patron) ?? "tarea-sin-dueno";

// ── Filtros baratos ─────────────────────────────────────────────────────────
// Corren en microsegundos y evitan gastar una llamada al modelo por mensaje.
// Son deliberadamente toscos: su trabajo es descartar, no decidir.

const PEDIDOS = /\b(hay que|habr[ií]a que|falta|faltar[ií]a|alguien tiene que|se necesita|necesitamos|tenemos que|hace falta)\b/i;
const ASIGNACIONES = /\b(yo (lo|la|me)?\s*(hago|agarro|veo|tomo)|me encargo|lo tomo|dale yo|voy yo|lo hago)\b/i;
const CIERRES = /\b(dale|listo|ok|oka|okey|perfecto|hagamos|vamos con|quedamos|decidido|cerrado)\b/i;

function filtroTareaSinDueno(v: Ventana, msg: Msg): boolean {
  // Hubo un pedido reciente y nadie lo agarró después.
  const recientes = v.mensajes.slice(-12);
  const iPedido = recientes.findIndex((m) => PEDIDOS.test(m.text));
  if (iPedido === -1) return false;
  const despues = recientes.slice(iPedido + 1);
  if (despues.some((m) => ASIGNACIONES.test(m.text))) return false;
  return despues.length >= 3 || PEDIDOS.test(msg.text);
}

function filtroDecisionNoAnotada(v: Ventana, msg: Msg): boolean {
  // Una frase de cierre, y después la conversación siguió de largo.
  if (CIERRES.test(msg.text)) return true;
  const recientes = v.mensajes.slice(-8);
  const iCierre = recientes.findIndex((m) => CIERRES.test(m.text));
  return iCierre !== -1 && recientes.length - iCierre >= 4;
}

function filtroDerivaDefiniciones(v: Ventana, _msg: Msg): boolean {
  // Un sustantivo largo que dos personas distintas repiten varias veces.
  const porPalabra = new Map<string, { veces: number; gente: Set<string> }>();
  for (const m of v.mensajes.slice(-15)) {
    for (const w of m.text.toLowerCase().match(/[a-záéíóúñ]{5,}/g) ?? []) {
      const e = porPalabra.get(w) ?? { veces: 0, gente: new Set<string>() };
      e.veces++;
      e.gente.add(m.from);
      porPalabra.set(w, e);
    }
  }
  for (const e of porPalabra.values()) if (e.veces >= 3 && e.gente.size >= 2) return true;
  return false;
}

// ── Prompts ─────────────────────────────────────────────────────────────────
// Reglas que cambian el resultado, en los tres: pedir cita textual, prohibir
// consejos y resúmenes, usar nombres propios, y dar permiso explícito de callarse.

const COMUN = `
Sos un agente que vive en un grupo de trabajo de Telegram y NO le habla a nadie
salvo cuando detecta un patrón concreto. Recibís los últimos mensajes con el
formato [id] Nombre: texto.

Reglas duras:
- Si no estás seguro, fire es false. Preferimos callarnos a equivocarnos.
- evidence tiene que citar TEXTUALMENTE los mensajes que prueban el patrón.
  Sin cita, no hay intervención.
- message va en español rioplatense con voseo, máximo 3 líneas, con los nombres
  propios de quienes hablaron. Señalá el patrón y nada más.
- Prohibido: dar consejos, moderar, resumir la conversación, saludar, presentarte.
`.trim();

const PROMPTS: Record<Patron, string> = {
  "tarea-sin-dueno": `${COMUN}

PATRÓN: una tarea sin dueño. Alguien dijo que hay que hacer algo, nadie la
agarró explícitamente, y la conversación siguió. No dispares si alguien ya dijo
que se encarga, ni si es una idea general sin acción concreta.

followup: describí en una línea la tarea que quedó sin dueño, para volver a
preguntar más tarde si sigue sin agarrar. null si alguien la agarró.`,

  "decision-no-anotada": `${COMUN}

PATRÓN: una decisión que el grupo tomó y nadie registró. Buscá un acuerdo
cerrado ("dale", "listo, hacemos X") seguido de cambio de tema. Vale doble si
contradice una decisión anterior que aparezca en los mensajes. No dispares si
alguien dijo que lo anota, ni si todavía están discutiendo.

followup: describí en una línea la decisión que quedó sin registrar, para
volver a preguntar más tarde si alguien la anotó. null si ya la anotaron.`,

  "deriva-definiciones": `${COMUN}

PATRÓN: dos personas usan la MISMA palabra con significados distintos y llevan
varios mensajes discutiendo cosas diferentes sin notarlo. Tenés que poder decir
qué significa la palabra para cada una, con la cita que lo respalda. No dispares
por un simple desacuerdo: el desacuerdo genuino sobre lo mismo no es deriva.

followup: null. Esto se resuelve en el momento o no se resuelve.`,
};

const FILTROS: Record<Patron, (v: Ventana, msg: Msg) => boolean> = {
  "tarea-sin-dueno": filtroTareaSinDueno,
  "decision-no-anotada": filtroDecisionNoAnotada,
  "deriva-definiciones": filtroDerivaDefiniciones,
};

export const detector: Detector = {
  name: PATRON,
  shouldRun(v: Ventana, msg: Msg): boolean {
    return FILTROS[PATRON](v, msg);
  },
  run(v: Ventana, _msg: Msg): Promise<Deteccion | null> {
    return evaluar(PROMPTS[PATRON], v);
  },
};
