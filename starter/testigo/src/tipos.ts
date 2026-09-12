// LOS CONTRATOS. Salen textuales de EL-TESTIGO.md seccion 7.
// Nadie los cambia sin avisar a los otros dos: es lo unico que nos desbloquea en paralelo.

/** mensajes.jsonl - produce P1 (importar.ts) */
export type Msg = {
  id: string;
  ts: string;          // ISO
  canal: string;
  autor: string;       // slug: minusculas, sin acentos. "lu", "nestor"
  texto: string;
  thread_id: string;
  link: string;
  reply_to?: string;
};

export type TipoEvidencia = "resolvio" | "desbloqueo" | "decidio" | "sostuvo";

/** evidencias.json - produce P2, consume el redactor. EL CONTRATO CRITICO. */
export type Evidencia = {
  id: string;
  /** Quien HIZO el trabajo. No necesariamente quien escribio el mensaje. */
  persona: string;
  tipo: TipoEvidencia;
  que: string;
  cuando: string;      // YYYY-MM-DD
  mensaje_id: string;
  link: string;
  /** Cita textual del mensaje que lo prueba. Sin cita no hay evidencia. */
  cita: string;
  confianza: number;
  no_estaba_en_plan: boolean;
};

/** El plan sale del propio canal, no de un archivo de config. */
export type PlanItem = { id: string; texto: string; mensaje_id: string };

export type Bullet = {
  texto: string;
  link: string;
  tipo: TipoEvidencia;
  evidencia_id: string;
  fuera_de_plan: boolean;
  /** Para ordenar. No se muestra. */
  impacto: number;
};

/** entregable.json - lo que ve la persona. Nadie mas. */
export type Entregable = {
  persona: string;
  periodo: string;
  leidos: number;
  anotados: number;
  intervenciones: number;
  bullets: Bullet[];
  fuera_de_plan: string[];
  /** Solo cambia cuando la persona aprieta compartir. No manda nada a nadie. */
  compartido: boolean;
};
