// EL DETECTOR REAL (P2/José): hilo cerrado -> Evidencia[] con una llamada al
// modelo (Responses API + structured outputs estrictos) y reglas duras en
// codigo DESPUES del modelo. Reemplaza al heuristico cuando la API esta
// disponible; el heuristico queda como fallback si el modelo falla o no hay key.
//
// Reglas duras (verificadas contra la API real el 12/09):
//  1. cita que no es substring EXACTO del mensaje citado -> descarta
//  2. persona desconocida (no participo del hilo ni fue nombrada) -> descarta
//  3. maximo 2 evidencias por hilo: 1 solida vale mas que 2 flojas
//
// Si no hay API key o el modelo falla, cae al heuristico: el agente nunca se
// queda sin cerebro y el replay nunca se tumba (C3).

import { chatJSON, type Schema } from "../llm.js";
import type { Evidencia, Msg, TipoEvidencia } from "../tipos.js";
import type { Estado } from "../pipeline.js";
import { heuristico } from "./heuristico.js";

type Salida = {
  persona: string;
  tipo: TipoEvidencia;
  que: string;
  mensaje_id: string;
  cita: string;
  confianza: number;
};

const ESQUEMA_EVIDENCIAS: Schema = {
  name: "evidencias",
  schema: {
    type: "object",
    properties: {
      evidencias: {
        type: "array",
        description:
          "Trabajo HECHO probado por un mensaje del hilo. Vacio si no hay nada solido. " +
          "Devolver vacio es la respuesta correcta la mayoria de las veces.",
        items: {
          type: "object",
          properties: {
            persona: {
              type: "string",
              description:
                "Quien HIZO el trabajo. Si otro se lo reconoce en el hilo, va esa persona, no el que escribe.",
            },
            tipo: {
              type: "string",
              description: "resolvio | desbloqueo | decidio | sostuvo.",
            },
            que: {
              type: "string",
              description:
                "QUE hizo, especifico: artefacto concreto (archivo, sistema, feature, cliente) y que paso. Una oracion, sin adjetivos.",
            },
            mensaje_id: { type: "string", description: "id del mensaje que prueba el hecho." },
            cita: {
              type: "string",
              description:
                "Substring EXACTO del texto del mensaje citado (max 200 chars). Si no esta literal, se descarta.",
            },
            confianza: {
              type: "number",
              description: "0 a 1. Ante la duda, mas bajo o vacio: un falso positivo cuesta mas que un silencio.",
            },
          },
          required: ["persona", "tipo", "que", "mensaje_id", "cita", "confianza"],
          additionalProperties: false,
        },
      },
    },
    required: ["evidencias"],
    additionalProperties: false,
  },
};

const SYSTEM = `Sos el Testigo. Vivas en un grupo de trabajo y vas anotando el trabajo que la gente HACE, no lo que promete.

Extrae evidencia de trabajo hecho de este hilo, con cita textual.

REGLAS:
1. SOLO trabajo HECHO: subido, cerrado, arreglado, explicado que sirvio. "Voy a hacer X" NO es evidencia.
2. La cita es un substring EXACTO del mensaje citado. Si no esta literal, no la uses.
3. Si no estas seguro, NO anotes. Devolver vacio es correcto la mayoria de las veces.
4. Atribucion: "gracias X, con eso salio" -> persona X, tipo desbloqueo. El merito es de X, no del que escribe.
5. Especifico: artefacto concreto y que paso con el. Nada de "varias cosas", "ayudo al equipo".
6. Maximo 2 evidencias por hilo. Una solida vale mas que 2 flojas.
7. Nada de humor, no comentes el contenido, no evalues personas.
8. La persona tiene que ser un participante del hilo o alguien que fue nombrado en el.

Si el hilo es charla, memes o coordinacion sin trabajo concluido: devolve {"evidencias":[]}.`;

function transcribir(hilo: Msg[]): string {
  return hilo.map((m) => `[${m.id}] ${m.autor}: ${m.texto}`).join("\n");
}

let n = 0;
const idEv = () => `ev_${Date.now().toString(36)}_${String(++n).padStart(2, "0")}`;

/** Regla dura: la cita es substring exacto de SU mensaje. */
function citaValida(hilo: Msg[], mensajeId: string, cita: string): boolean {
  const m = hilo.find((x) => x.id === mensajeId);
  return !!m && typeof cita === "string" && cita.length > 3 && m.texto.includes(cita);
}

/**
 * El detector con modelo. Mismo contrato que el heuristico:
 *   (hilo, estado) -> Evidencia[]
 * Sin key o con el modelo caido: heuristico (el pipeline registra el motivo).
 */
export const evidencia = async (hilo: Msg[], estado: Estado): Promise<Evidencia[]> => {
  if (!process.env.OPENAI_API_KEY && !process.env.OPENROUTER_API_KEY) {
    return heuristico(hilo, estado);
  }

  let out: { evidencias: Salida[] };
  try {
    out = await chatJSON<{ evidencias: Salida[] }>(
      [
        { role: "system", content: SYSTEM },
        { role: "user", content: transcribir(hilo) },
      ],
      { schema: ESQUEMA_EVIDENCIAS, effort: "low" },
    );
  } catch {
    // Plan B del plan: el heuristico nunca deja al agente sin cerebro.
    return heuristico(hilo, estado);
  }

  const autores = new Set(hilo.map((m) => m.autor));
  const resultado: Evidencia[] = [];
  for (const e of (out.evidencias ?? []).slice(0, 2)) {
    if (!citaValida(hilo, e.mensaje_id, e.cita)) continue; // regla dura 1
    const mencionado =
      autores.has(e.persona) ||
      hilo.some((m) => m.autor !== "" && m.texto.toLowerCase().includes(e.persona.toLowerCase()));
    if (!mencionado) continue; // regla dura 2
    const fuente = hilo.find((m) => m.id === e.mensaje_id);
    resultado.push({
      id: idEv(),
      persona: e.persona,
      tipo: e.tipo,
      que: e.que,
      cuando: (fuente?.ts ?? "").slice(0, 10),
      mensaje_id: e.mensaje_id,
      link: fuente?.link ?? "",
      cita: e.cita,
      confianza: e.confianza,
      no_estaba_en_plan: false, // lo decide el pipeline contra el plan del canal
    });
  }
  return resultado;
};
