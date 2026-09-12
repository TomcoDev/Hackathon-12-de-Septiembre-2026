// hackathon 12/09/2026
// El detector como tarea durable: reintentos y trazas si la llamada al modelo
// falla. Corre el MISMO detector y el MISMO umbral que el camino inline.
//
// Cuándo conviene cada camino:
//   inline (index.ts)  → el demo. Sub-segundo, el agente contesta mientras la
//                        conversación pasa.
//   esta tarea         → cuando no importa un par de segundos y sí importa que
//                        no se pierda: barridos, reprocesos, casos difíciles.
//
// No comparte memoria con el bot: todo lo que necesita viaja en el payload.

import { logger, task } from "@trigger.dev/sdk";
import { validar } from "../detector.js";
import { detector } from "../detectors/patron.js";
import type { Msg, Ventana } from "../state.js";
import { enviarMensaje } from "../telegram.js";

export type PayloadDeteccion = {
  chatId: number;
  ventana: Ventana;
  msg: Msg;
  /** false para barridos de prueba: evalúa y loguea, pero no habla en el grupo. */
  postear: boolean;
};

export const correrDeteccion = task({
  id: "correr-deteccion",
  retry: { maxAttempts: 3, minTimeoutInMs: 1_000, maxTimeoutInMs: 10_000, factor: 2 },
  run: async (payload: PayloadDeteccion) => {
    const { ventana, msg, chatId } = payload;

    if (!detector.shouldRun(ventana, msg)) {
      logger.info("filtro barato: no se gasta llamada", { detector: detector.name });
      return { intervino: false, motivo: "filtro barato" };
    }

    const r = validar(await detector.run(ventana, msg));

    if (r.tipo === "silencio") {
      logger.info("silencio", { motivo: r.motivo });
      return { intervino: false, motivo: r.motivo };
    }

    logger.info("patrón detectado", {
      confianza: r.intervencion.confidence,
      evidencia: r.intervencion.evidence,
    });

    if (!payload.postear) return { intervino: false, motivo: "modo evaluación", deteccion: r.intervencion };

    await enviarMensaje(chatId, r.intervencion.message);
    return { intervino: true, deteccion: r.intervencion, followup: r.followup };
  },
});
