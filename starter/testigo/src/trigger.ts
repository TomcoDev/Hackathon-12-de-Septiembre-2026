// Lo unico que hace hablar al agente: alguien menciona el 1:1 EN EL GRUPO.
// No hay boton. No hay comando. Nadie le escribe. Ese es el criterio 2.
//
// Habla una vez y se calla. Maximo una intervencion por periodo.

import type { Msg } from "./tipos.js";
import type { Estado } from "./pipeline.js";
import type { Entregable } from "./tipos.js";

export const TRIGGER =
  /(\b1:1\b|\b1 a 1\b|\buno a uno\b|\bone[- ]on[- ]one\b|evaluaci[oó]n( de desempe[nñ]o)?|reuni[oó]n con (mi |el |la )?(jefe|jefa|manager|lead|l[ií]der)|\bperformance review\b)/i;

/** Dispara si el mensaje habla del 1:1 y es de la persona o la nombra. */
export function esDisparador(m: Msg, estado: Estado): boolean {
  if (estado.intervenciones > 0) return false;
  if (!TRIGGER.test(m.texto)) return false;
  const nombraALaPersona = new RegExp(`\\b@?${estado.persona}\\b`, "i").test(m.texto);
  return m.autor === estado.persona || nombraALaPersona;
}

export type Redactor = (estado: Estado) => Promise<Entregable>;
export type Enviar = (entregable: Entregable, estado: Estado) => Promise<void>;

/** La unica vez que abre la boca. Redacta, registra, manda UN mensaje privado. */
export async function hablar(estado: Estado, m: Msg, redactar: Redactor, enviar: Enviar): Promise<void> {
  estado.disparador = m;
  estado.intervenciones++;
  estado.bitacora.push({
    ts: m.ts,
    hilo: m.thread_id,
    tipo: "hablo",
    motivo: `${m.autor} mencionó el 1:1: "${m.texto.slice(0, 80)}"`,
  });

  try {
    estado.entregable = await redactar(estado);
  } catch (e: unknown) {
    // Si el redactor falla, se manda lo crudo antes que no mandar nada.
    estado.bitacora.push({
      ts: m.ts,
      hilo: m.thread_id,
      tipo: "descartado",
      motivo: `redactor fallo, se usa el crudo: ${(e as Error).message}`.slice(0, 140),
    });
    estado.entregable = entregableCrudo(estado);
  }
  await enviar(estado.entregable, estado);
}

/** Sin modelo: las evidencias tal cual, ordenadas por confianza. Plan B del redactor. */
export function entregableCrudo(estado: Estado): Entregable {
  const propias = estado.evidencias
    .filter((e) => e.persona === estado.persona)
    .sort((a, b) => b.confianza - a.confianza)
    .slice(0, 8);
  return {
    persona: estado.persona,
    periodo: `${estado.primerTs?.slice(0, 10)} a ${estado.ultimoTs?.slice(0, 10)}`,
    leidos: estado.leidos,
    anotados: estado.anotados,
    intervenciones: estado.intervenciones,
    bullets: propias.map((e) => ({
      texto: e.que,
      link: e.link,
      tipo: e.tipo,
      evidencia_id: e.id,
      fuera_de_plan: e.no_estaba_en_plan,
      impacto: e.confianza,
    })),
    fuera_de_plan: propias.filter((e) => e.no_estaba_en_plan).map((e) => e.id),
    compartido: false,
  };
}
