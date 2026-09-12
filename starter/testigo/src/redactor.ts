// El redactor: evidencias + plan -> 8 bullets que den ganas de leer.
//
// JOSE: este archivo es tuyo. Lo que hay ahora es la version SIN modelo para que el
// circuito corra de punta a punta. Reemplazar el cuerpo de redactar() por la llamada
// a chatJSON con schema estricto. Mantener la firma y mantener esGenerico(): la regla
// anti-generico se valida en codigo DESPUES del modelo, no se confia al prompt.
//
// Tono: parcial y sereno. Sin emojis, sin signos de exclamacion, sin "buen trabajo".
// Cada bullet nombra a alguien afectado o un artefacto concreto, o no existe.

import type { Bullet, Entregable, Evidencia } from "./tipos.js";
import type { Estado } from "./pipeline.js";
import { entregableCrudo } from "./trigger.js";

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

export async function redactar(estado: Estado): Promise<Entregable> {
  const propias = estado.evidencias.filter((e) => e.persona === estado.persona);
  if (!propias.length) return entregableCrudo(estado);

  // Deduplicar: lo mismo contado tres veces es un bullet, no tres.
  const vistas = new Map<string, Evidencia>();
  for (const e of propias) {
    const k = clave(e);
    if (!vistas.has(k) || vistas.get(k)!.confianza < e.confianza) vistas.set(k, e);
  }

  const bullets: Bullet[] = [...vistas.values()]
    .map((e) => ({
      texto: e.que,
      link: e.link,
      tipo: e.tipo,
      evidencia_id: e.id,
      fuera_de_plan: e.no_estaba_en_plan,
      impacto: PESO[e.tipo] * e.confianza + (e.no_estaba_en_plan ? 0.1 : 0),
    }))
    .filter((b) => !esGenerico(b.texto))
    .sort((a, b) => b.impacto - a.impacto)
    .slice(0, 8);

  return {
    persona: estado.persona,
    periodo: `${estado.primerTs?.slice(0, 10)} a ${estado.ultimoTs?.slice(0, 10)}`,
    leidos: estado.leidos,
    anotados: propias.length,
    intervenciones: estado.intervenciones,
    bullets,
    fuera_de_plan: bullets.filter((b) => b.fuera_de_plan).map((b) => b.evidencia_id),
    compartido: false,
  };
}
