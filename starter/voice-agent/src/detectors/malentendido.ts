// DETECTOR DE EJEMPLO. Es el que se reemplaza cuando el equipo cierre el problema.
// El resto del chasis no se toca: solo hay que cumplir la interfaz Detector.
//
// Patron: dos personas que no comparten idioma creen estar de acuerdo y no lo estan.
// No traduce todo (eso es Google Translate y es un contenedor). Solo abre la boca
// cuando detecta que lo que uno entendio no es lo que el otro dijo.

import type { Detector, Intervention, RoomState, Utterance } from "../pipeline.js";
import { chatJSON, type Schema } from "../llm.js";
import { catalogoParaPrompt } from "../actions.js";

/** Marcadores baratos de idioma. No es deteccion seria: es un filtro, y tiene que ser rapido. */
const MARCAS: Record<string, RegExp> = {
  es: /\b(que|para|pero|entonces|cuando|porque|tambien|nosotros|ustedes|esta|hacer)\b/i,
  en: /\b(the|and|but|then|because|we|you|this|that|should|need|make)\b/i,
  pt: /\b(que|para|mas|entao|porque|nos|voces|isso|fazer|precisa)\b/i,
};

function idioma(texto: string): string | null {
  let mejor: string | null = null;
  let max = 0;
  for (const [cod, re] of Object.entries(MARCAS)) {
    const n = (texto.match(new RegExp(re, "gi")) ?? []).length;
    if (n > max) {
      max = n;
      mejor = cod;
    }
  }
  return max >= 2 ? mejor : null;
}

const SCHEMA: Schema = {
  name: "malentendido",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["fire", "message", "evidence", "confidence", "action"],
    properties: {
      fire: {
        type: "boolean",
        description: "true SOLO si dos personas entendieron cosas distintas de lo mismo.",
      },
      message: {
        type: "string",
        description:
          "Lo que el agente dice en voz alta. Maximo dos frases. Nombra a las personas y la discrepancia concreta. Vacio si fire es false.",
      },
      evidence: {
        type: "array",
        description: "Citas TEXTUALES de las frases que prueban la discrepancia. Vacio si fire es false.",
        items: { type: "string" },
      },
      confidence: { type: "number", description: "0 a 1. Si dudas, por debajo de 0.8." },
      action: {
        type: ["object", "null"],
        description: "Accion a ejecutar, o null si solo hay que hablar.",
        additionalProperties: false,
        required: ["name", "params_json"],
        properties: {
          name: { type: "string", description: "Nombre exacto del catalogo de acciones." },
          params_json: { type: "string", description: "Los parametros como string JSON." },
        },
      },
    },
  },
};

const SISTEMA = `Escuchás una conversación entre varias personas. Nadie te habló y nadie espera que hables.

Tu única tarea: detectar cuando dos personas creen estar de acuerdo pero entendieron cosas distintas, normalmente porque no comparten idioma o porque usan la misma palabra con sentidos distintos.

Reglas que no se rompen:
1. No traducís. No resumís. No aconsejás. No moderás. Señalás una discrepancia concreta o te callás.
2. Toda afirmación va anclada en citas textuales de lo que se dijo. Sin cita, fire es false.
3. Usá los nombres de las personas. "Ana dijo X, Ben entendió Y."
4. Si no estás seguro, fire es false. Preferimos callarnos a equivocarnos. Un falso positivo es peor que perderse un caso.
5. Que haya dos idiomas en la sala NO es un malentendido. Que alguien no entienda NO es un malentendido. Solo cuenta cuando siguen adelante creyendo que acordaron.

Acciones disponibles (usá null si no hace falta ninguna):
`;

export const malentendido: Detector = {
  name: "malentendido",

  // Filtro barato: sin esto, cada frase de la sala es una llamada al modelo.
  shouldRun(state: RoomState, _u: Utterance): boolean {
    if (state.hablantes.size < 2) return false;

    const ventana = state.frases.slice(-8);
    if (ventana.length < 4) return false;

    // Señal 1: dos idiomas distintos en la ventana.
    const idiomas = new Set(ventana.map((f) => idioma(f.text)).filter(Boolean));
    if (idiomas.size >= 2) return true;

    // Señal 2: un sustantivo largo repetido por dos hablantes distintos.
    const porTermino = new Map<string, Set<string>>();
    for (const f of ventana) {
      for (const w of f.text.toLowerCase().match(/\b[a-záéíóúñ]{6,}\b/g) ?? []) {
        if (!porTermino.has(w)) porTermino.set(w, new Set());
        porTermino.get(w)!.add(f.speaker);
      }
    }
    return [...porTermino.values()].some((s) => s.size >= 2);
  },

  async run(state: RoomState, _u: Utterance): Promise<Intervention | null> {
    const transcripcion = state.frases
      .slice(-16)
      .map((f) => `${f.speaker}: ${f.text}`)
      .join("\n");

    const out = await chatJSON<{
      fire: boolean;
      message: string;
      evidence: string[];
      confidence: number;
      action: { name: string; params_json: string } | null;
    }>(
      [
        { role: "system", content: SISTEMA + catalogoParaPrompt() },
        { role: "user", content: `Conversación:\n${transcripcion}` },
      ],
      { schema: SCHEMA, effort: "low", maxOutputTokens: 700 },
    );

    if (!out.fire) return null;

    let action: Intervention["action"] = null;
    if (out.action) {
      try {
        action = { name: out.action.name, params: JSON.parse(out.action.params_json) };
      } catch {
        action = null; // params ilegibles: se habla igual, no se ejecuta nada a ciegas.
      }
    }

    return {
      message: out.message,
      evidence: out.evidence ?? [],
      confidence: out.confidence,
      action,
    };
  },
};
