// El plan sale del propio canal. No hay archivo de configuracion.
//
// JOSE: version heuristica para que "no estaba en tu plan" funcione HOY. Reemplazar
// extraerPlan() por una llamada al modelo sobre los primeros mensajes del periodo
// (schema estricto: lista de items). Mantener estaEnPlan() o mejorarla con el modelo.
// El remate del video depende de esto: "estas 4 no estaban en tu plan".

import type { Msg, PlanItem } from "./tipos.js";

const ES_PLAN = /(este mes|esta semana|este sprint|el mes que viene)[^.]{0,40}(vamos por|objetivos?|prioridades?|metas?|foco|cosas)|prioridad(es)? del mes|objetivos del mes/i;

export function esPlan(m: Msg): boolean {
  return ES_PLAN.test(m.texto);
}

/** "vamos por tres cosas: a, b, y c. lo demas espera" -> [a, b, c] */
export function extraerPlan(m: Msg): PlanItem[] {
  const despues = m.texto.split(/:/).slice(1).join(":") || m.texto;
  return despues
    .split(/\.|\n/)[0]
    .split(/,| y (?=[a-záéíóúñ])/i)
    .map((s) => s.trim().replace(/^(y|e)\s+/i, ""))
    .filter((s) => s.length > 3)
    .map((texto, i) => ({ id: `plan_${i + 1}`, texto, mensaje_id: m.id }));
}

const STOP = new Set(["para", "como", "pero", "este", "esta", "esto", "nuevo", "nueva", "bajar", "subir", "hacer", "tema", "cosa", "cosas"]);

function raices(s: string): Set<string> {
  return new Set(
    s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
      .match(/[a-z0-9]{4,}/g)?.map((w) => w.slice(0, 5)).filter((w) => !STOP.has(w)) ?? [],
  );
}

/** Solapamiento de raices de palabras. Tosco a proposito: prefiere decir "en plan" ante la duda. */
export function estaEnPlan(que: string, plan: PlanItem[]): boolean {
  if (!plan.length) return true;
  const q = raices(que);
  return plan.some((p) => [...raices(p.texto)].some((r) => q.has(r)));
}
