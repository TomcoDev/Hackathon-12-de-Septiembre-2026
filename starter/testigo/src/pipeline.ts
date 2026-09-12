// La tuberia de EL TESTIGO. El comportamiento por defecto es NO anotar y NO hablar.
//
//   mensaje -> hilo -> (el hilo se callo?) -> detector de evidencia -> umbral -> anotar EN SILENCIO
//                   -> (alguien menciono el 1:1?) -> redactor -> UN mensaje privado
//
// La bitacora registra TODO, incluido lo que descarto y por que. Es lo que hace
// auditable al agente y es lo que se muestra en pantalla.
//
// Un solo camino, compartido por el replay y por el bot en vivo. Que los dos pasen
// por aca es lo que hace que calibrar con archivos sirva para el grupo real.

import type { Entregable, Evidencia, Msg, PlanItem } from "./tipos.js";
import { esPlan, estaEnPlan, extraerPlan } from "./plan.js";

export type Decision =
  | { ts: string; hilo: string; tipo: "descartado"; motivo: string }
  | { ts: string; hilo: string; tipo: "anotado"; evidencia: Evidencia }
  | { ts: string; hilo: string; tipo: "hablo"; motivo: string };

export type Estado = {
  persona: string;
  leidos: number;
  anotados: number;
  intervenciones: number;
  hilos: Map<string, Msg[]>;
  autores: Set<string>;
  /** Cuantos mensajes globales pasaron desde el ultimo de cada hilo. */
  quietud: Map<string, number>;
  cerrados: Set<string>;
  evidencias: Evidencia[];
  plan: PlanItem[];
  bitacora: Decision[];
  /** Ultimos mensajes, para la pantalla. */
  ultimos: Msg[];
  entregable: Entregable | null;
  /** El mensaje del grupo que lo hizo hablar. Se muestra: es el trigger visible. */
  disparador: Msg | null;
  primerTs: string | null;
  ultimoTs: string | null;
};

/** Un hilo se considera cerrado cuando pasaron esta cantidad de mensajes sin que nadie lo toque. */
export const QUIETUD = Number(process.env.QUIETUD ?? 6);
/** Debajo de esto no se anota. Calibrar con replay, no a ojo. */
export const UMBRAL = Number(process.env.UMBRAL ?? 0.75);
/** Un hilo con menos texto util que esto no se manda al modelo. */
const MIN_TEXTO = 40;
const ULTIMOS = 40;

export function nuevoEstado(persona: string): Estado {
  return {
    persona,
    leidos: 0,
    anotados: 0,
    intervenciones: 0,
    hilos: new Map(),
    autores: new Set(),
    quietud: new Map(),
    cerrados: new Set(),
    evidencias: [],
    plan: [],
    bitacora: [],
    ultimos: [],
    entregable: null,
    disparador: null,
    primerTs: null,
    ultimoTs: null,
  };
}

/** Detector de evidencia: mira un hilo entero y decide si ahi hay trabajo hecho, y de quien. */
export type DetectorEvidencia = (hilo: Msg[], estado: Estado) => Promise<Evidencia[]>;

/**
 * Ingesta un mensaje. Devuelve los hilos que quedaron cerrados por este mensaje.
 * El filtro barato vive aca: sin esto son 1400 llamadas al modelo en vez de 150.
 */
export function ingerir(estado: Estado, m: Msg): string[] {
  estado.leidos++;
  estado.primerTs ??= m.ts;
  estado.ultimoTs = m.ts;
  estado.autores.add(m.autor);

  estado.ultimos.push(m);
  if (estado.ultimos.length > ULTIMOS) estado.ultimos.shift();

  // El plan sale del canal: el primer mensaje que enumera objetivos del periodo.
  if (!estado.plan.length && esPlan(m)) estado.plan = extraerPlan(m);

  const hilo = estado.hilos.get(m.thread_id) ?? [];
  hilo.push(m);
  estado.hilos.set(m.thread_id, hilo);
  estado.quietud.set(m.thread_id, 0);

  const cerrados: string[] = [];
  for (const [id, q] of estado.quietud) {
    if (id === m.thread_id || estado.cerrados.has(id)) continue;
    const n = q + 1;
    estado.quietud.set(id, n);
    if (n >= QUIETUD) cerrados.push(id);
  }
  return cerrados;
}

/** Todo lo que quedo abierto al final del periodo. */
export function pendientes(estado: Estado): string[] {
  return [...estado.hilos.keys()].filter((id) => !estado.cerrados.has(id));
}

/**
 * Evalua un hilo cerrado. El 80% del trabajo es descartar: cada salida temprana
 * de aca abajo es plata y latencia que no se gastan.
 */
export async function evaluarHilo(
  estado: Estado,
  thread_id: string,
  detector: DetectorEvidencia,
): Promise<Decision[]> {
  estado.cerrados.add(thread_id);
  const hilo = estado.hilos.get(thread_id) ?? [];
  const ts = hilo.at(-1)?.ts ?? new Date().toISOString();
  const decisiones: Decision[] = [];
  const registrar = (d: Decision) => {
    estado.bitacora.push(d);
    decisiones.push(d);
    return decisiones;
  };
  const no = (motivo: string) => registrar({ ts, hilo: thread_id, tipo: "descartado", motivo });

  // Filtro barato 1: hilos de puro "dale", "ok", stickers.
  const texto = hilo.map((m) => m.texto).join(" ").trim();
  if (texto.length < MIN_TEXTO) return no("hilo trivial");

  // Filtro barato 2: sin marca de trabajo terminado no vale una llamada.
  if (!MARCAS_DE_HECHO.test(texto)) return no("sin marca de trabajo hecho");

  let evidencias: Evidencia[];
  try {
    evidencias = await detector(hilo, estado);
  } catch (e: unknown) {
    // Que falle el modelo no puede tumbar el replay: se registra y se sigue leyendo.
    return no(`error del modelo: ${(e as Error).message}`.slice(0, 140));
  }

  if (!evidencias.length) return no("el detector no vio trabajo hecho");

  for (const ev of evidencias) {
    if (ev.confianza < UMBRAL) {
      no(`confianza ${ev.confianza.toFixed(2)} < ${UMBRAL}`);
      continue;
    }
    if (!ev.cita?.trim()) {
      no("sin cita textual");
      continue;
    }
    // Fuera de plan se decide aca, contra el plan que salio del canal. El detector no lo sabe.
    ev.no_estaba_en_plan = estado.plan.length ? !estaEnPlan(ev.que, estado.plan) : false;
    estado.evidencias.push(ev);
    estado.anotados++;
    registrar({ ts, hilo: thread_id, tipo: "anotado", evidencia: ev });
  }
  return decisiones;
}

/**
 * Marcas de trabajo terminado. Es un filtro, no una clasificacion: tiene que sobre-incluir.
 * Ante la duda deja pasar, que para descartar esta el detector.
 */
export const MARCAS_DE_HECHO =
  /\b(list[oa]|ya (sub[ií]|est[aá]|qued[oó]|mand[eé]|lo hice|anda)|arregl|resolv|solucion|cerr[eé]|deploy|mergi|push|termin|dej[eé] andando|te pas[eé]|habl[eé] con|me encargu|lo tom|gracias|sali[oó]|funcion|banc|cubr|revis|ayud|destrab|desbloq|decidimos|hacemos|vamos con|prob[aá])\w*/i;
