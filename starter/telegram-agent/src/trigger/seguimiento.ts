// hackathon 12/09/2026
// La pieza que hace que el agente actúe cuando nadie está mirando.
//
// El bot dispara esta tarea, ella espera, y al despertar postea sola en el
// grupo. Nadie le escribió. Si mientras tanto la situación se resuelve, el bot
// cancela el run por su id y esto nunca llega a postear.
//
// Una espera de más de 5 segundos no consume cómputo en Trigger.dev, así que
// esperar media hora sale igual que esperar un minuto.

import { logger, task, wait } from "@trigger.dev/sdk";
import { enviarMensaje } from "../telegram.js";

export type PayloadSeguimiento = {
  chatId: number;
  /** Ya compuesto por el bot: el patrón es dueño de sus palabras, no esta tarea. */
  mensaje: string;
  minutos: number;
  /** Para rastrear en los logs qué seguimiento era. */
  seguimientoId: string;
};

export const seguimientoDiferido = task({
  id: "seguimiento-diferido",
  run: async (payload: PayloadSeguimiento) => {
    logger.info("esperando antes de volver al grupo", {
      seguimientoId: payload.seguimientoId,
      minutos: payload.minutos,
      chatId: payload.chatId,
    });

    await wait.for({ minutes: payload.minutos });

    // Si alguien lo resolvió, el bot canceló este run y no llegamos hasta acá.
    const messageId = await enviarMensaje(payload.chatId, payload.mensaje);

    logger.info("posteado", { seguimientoId: payload.seguimientoId, messageId });
    return { posteado: true, messageId };
  },
});
