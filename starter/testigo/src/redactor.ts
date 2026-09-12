// El redactor: evidencias + plan -> 8 bullets que den ganas de leer.
//
// Version CON MODELO (P2/José, portado y verificado contra la API real el
// 12/09): una llamada chatJSON redacta los bullets; TODO lo demas es codigo.
// La regla anti-generico (esGenerico) se valida en codigo DESPUES del modelo,
// no se confia al prompt. Si el modelo falla, se cae a la version cruda.
//
// Tono: parcial y sereno. Sin emojis, sin signos de exclamacion, sin "buen trabajo".
// Cada bullet nombra a alguien afectado o un artefacto concreto, o no existe.

import type { Bullet, Entregable, Evidencia } from "./tipos.js";
import type { Estado } from "./pipeline.js";
import { entregableCrudo } from "./trigger.js";
import { chatJSON, type Schema } from "./llm.js";

/** Lo que mata al proyecto. Un bullet que matchea esto se descarta, venga de donde venga. */
const GENERICO =
  /\b(particip|colabor|activ[oa]|gran semana|varias conversaciones|estuviste presente|aport(aste|ó) valor|buen trabajo|excelente|increíble|incre[ií]ble)\b|[!¡]|\p{Extended_Pictographic}/iu;

export function esGenerico(texto: string): boolean {
  if (GENERICO.test(texto)) return true;
  if (texto.trim().split(/\s+/).length < 5) return true;
  return false;
}

const PESO: Record<Evidencia["tipo"], number> = { desbloqueo: 1.0, resolvio: 0.95, sostuvo: 0.85, decidio: 0.8 };

/** Dos evidencias que cuentan lo mismo: misma fecha y mismo arranque de texto. */
function clave(e: Evidencia): string {
  return e.cuando + "|" + e.que.toLowerCase().replace(/[^a-záéíóúñ ]/g, "").slice(0, 28);
}

/** "Arregló X" -> "Arreglaste X". Para el fallback cuando el modelo omite una evidencia. */
const VERBOS_2DA: [RegExp, string][] = [
  [/^Indic[oó] /, "Indicaste "],
  [/^Dej[oó] /, "Dejaste "],
  [/^Agreg[oó] /, "Agregaste "],
  [/^Arregl[oó] /, "Arreglaste "],
  [/^Resolvi[oó] /, "Resolviste "],
  [/^Desbloque[oó] /, "Desbloqueaste "],
  [/^Migr[oó] /, "Migraste "],
  [/^Sostuvo /, "Sostuviste "],
  [/^Salv[oó] /, "Salvaste "],
  [/^Decidi[oó] /, "Decidiste "],
  [/^Empuj[oó] /, "Empujaste "],
  [/^Le pas[oó] /, "Le pasaste "],
  [/^Le explic[oó] /, "Le explicaste "],
  [/^Se qued[oó] /, "Te quedaste "],
  [/^Subi[oó] /, "Subiste "],
  [/^Cerr[oó] /, "Cerraste "],
  [/^Rehizo /, "Rehiciste "],
  [/^Corrigi[oó] /, "Corregiste "],
  [/^Reinici[oó] /, "Reiniciaste "],
  [/^Devolvi[oó] /, "Devolviste "],
];

function aSegundaPersona(que: string): string {
  for (const [re, reemplazo] of VERBOS_2DA) {
    if (re.test(que)) return que.replace(re, reemplazo);
  }
  return que.charAt(0).toLowerCase() + que.slice(1);
}

const ESQUEMA_REDACCION: Schema = {
  name: "redaccion",
  schema: {
    type: "object",
    properties: {
      bullets: {
        type: "array",
        description:
          "UN bullet POR CADA evidencia listada: cada evidencia_id aparece exactamente una vez. " +
          "Ordenados por impacto (el mas fuerte primero).",
        items: {
          type: "object",
          properties: {
            texto: {
              type: "string",
              description:
                "Maximo 140 caracteres, una oracion, segunda persona rioplatense (Arreglaste, Le pasaste, " +
                "Sostuviste). Nombra el artefacto concreto del que habla la evidencia. Sin adjetivos de elogio.",
            },
            evidencia_id: { type: "string", description: "id de la evidencia que respalda el bullet." },
          },
          required: ["texto", "evidencia_id"],
          additionalProperties: false,
        },
      },
    },
    required: ["bullets"],
    additionalProperties: false,
  },
};

const SYSTEM = `Sos el Testigo. Escribis el entregable que una persona va a leer antes de su 1:1 con el jefe.

Segunda persona, para esa persona. Parcial (de su lado) y sereno (sin urgencia, sin elogio).

REGLAS DE VOZ:
- Segunda persona: "Arreglaste el timeout del login que tenia trabado a soporte."
- Sereno: cero signos de exclamacion, cero emojis, cero "gran", "increible", "excelente", "felicitaciones".
- Parcial: el trabajo invisible pesa igual que el visible. Desbloquear a otro es un logro, no un asterisco.
- Cada bullet nombra un artefacto CONCRETO: sistema, archivo, feature, cliente, informe.
- Una oracion por bullet. Maximo 140 caracteres.
- Fuera de plan NO se menciona en el texto: ya va marcado aparte.
- NO resumas varias evidencias en un bullet: una evidencia = un bullet.

PROHIBIDOS (bullets basura reales):
- "Participaste en varias conversaciones del canal"
- "Colaboraste activamente con el equipo"
- "Tuviste una gran semana"
Cualquier bullet en esa familia = falla.

Orden: por impacto. Resolviste algo que bloqueaba a otros > decision tecnica con efecto > sostuviste un criterio.

Respondé en el schema pedido.`;

export async function redactar(estado: Estado): Promise<Entregable> {
  const propias = estado.evidencias.filter((e) => e.persona === estado.persona);
  if (!propias.length) return entregableCrudo(estado);

  // Deduplicar: lo mismo contado tres veces es un bullet, no tres.
  const vistas = new Map<string, Evidencia>();
  for (const e of propias) {
    const k = clave(e);
    if (!vistas.has(k) || vistas.get(k)!.confianza < e.confianza) vistas.set(k, e);
  }
  const unicas = [...vistas.values()];

  const crudo = (): Bullet[] =>
    unicas.map((e) => ({
      texto: e.que,
      link: e.link,
      tipo: e.tipo,
      evidencia_id: e.id,
      fuera_de_plan: e.no_estaba_en_plan,
      impacto: PESO[e.tipo] * e.confianza + (e.no_estaba_en_plan ? 0.1 : 0),
    }));

  // Sin key: version cruda (sin modelo), igual que antes.
  if (!process.env.OPENAI_API_KEY && !process.env.OPENROUTER_API_KEY) {
    return cerrar(estado, unicas, crudo());
  }

  const porId = new Map(unicas.map((e) => [e.id, e]));
  const user = [
    `Persona: ${estado.persona}`,
    "",
    "Evidencias:",
    ...unicas.map(
      (e) =>
        `- id=${e.id} tipo=${e.tipo}${e.no_estaba_en_plan ? " [FUERA_DE_PLAN]" : ""} ` +
        `${e.cuando}: ${e.que} (confianza ${e.confianza.toFixed(2)})`,
    ),
    "",
    estado.plan.length
      ? "Plan del periodo:"
      : "Plan del periodo: (vacio - no hay nada marcado como fuera de plan)",
    ...estado.plan.map((p) => `- ${p.texto}`),
  ].join("\n");

  let bullets: Bullet[] = [];
  try {
    const out = await chatJSON<{ bullets: { texto: string; evidencia_id: string }[] }>(
      [
        { role: "system", content: SYSTEM },
        { role: "user", content: user },
      ],
      { schema: ESQUEMA_REDACCION, effort: "low" },
    );

    for (const b of out.bullets ?? []) {
      const ev = porId.get(b.evidencia_id);
      if (!ev) continue; // evidencia desconocida
      if (esGenerico(b.texto)) continue; // regla dura anti-generico
      if (bullets.some((x) => x.evidencia_id === ev.id)) continue; // una por evidencia
      bullets.push({
        texto: b.texto.trim(),
        link: ev.link,
        tipo: ev.tipo,
        evidencia_id: ev.id,
        fuera_de_plan: ev.no_estaba_en_plan,
        impacto: PESO[ev.tipo] * ev.confianza + (ev.no_estaba_en_plan ? 0.1 : 0),
      });
    }
  } catch {
    // Modelo caido: bullets crudos del `que`. El entregable existe igual.
    return cerrar(estado, unicas, crudo());
  }

  // Fallback determinista: evidencia sin bullet del modelo -> bullet directo
  // del `que` en 2a persona. Nunca menos bullets que evidencias validas.
  const cubiertas = new Set(bullets.map((b) => b.evidencia_id));
  for (const ev of unicas) {
    if (bullets.length >= 8) break;
    if (cubiertas.has(ev.id)) continue;
    bullets.push({
      texto: aSegundaPersona(ev.que),
      link: ev.link,
      tipo: ev.tipo,
      evidencia_id: ev.id,
      fuera_de_plan: ev.no_estaba_en_plan,
      impacto: PESO[ev.tipo] * ev.confianza + (ev.no_estaba_en_plan ? 0.1 : 0),
    });
  }

  return cerrar(estado, unicas, bullets);
}

function cerrar(estado: Estado, unicas: Evidencia[], bullets: Bullet[]): Entregable {
  const finales = bullets
    .filter((b) => !esGenerico(b.texto))
    .sort((a, b) => b.impacto - a.impacto)
    .slice(0, 8);

  return {
    persona: estado.persona,
    periodo: `${estado.primerTs?.slice(0, 10)} a ${estado.ultimoTs?.slice(0, 10)}`,
    leidos: estado.leidos,
    anotados: unicas.length,
    intervenciones: estado.intervenciones,
    bullets: finales,
    fuera_de_plan: finales.filter((b) => b.fuera_de_plan).map((b) => b.evidencia_id),
    compartido: false,
  };
}
