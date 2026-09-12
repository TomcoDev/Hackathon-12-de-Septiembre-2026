// hackathon 12/09/2026
// El bot. Escucha el grupo, corre el detector, interviene, y programa la
// revisión diferida. Nadie le escribe: todo arranca en message:text.

import "./env.js";
import { Bot } from "grammy";
import { runs, tasks } from "@trigger.dev/sdk";
import { chat } from "./llm.js";
import { procesar } from "./detector.js";
import { detector, PATRON } from "./detectors/patron.js";
import {
  abrirSeguimiento,
  getState,
  resumen,
  seguimientosAbiertos,
  type Msg,
} from "./state.js";
import type { seguimientoDiferido } from "./trigger/seguimiento.js";

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) throw new Error("Falta TELEGRAM_BOT_TOKEN en .env. Crear el bot con @BotFather.");

const bot = new Bot(token);

/** Bajarlo a 1 para grabar el video: nadie espera media hora en cámara. */
const MINUTOS_SEGUIMIENTO = Number(process.env.SEGUIMIENTO_MINUTOS ?? 30);

// ── Comandos de control ─────────────────────────────────────────────────────
// Criterio 4 del jurado: el agente tiene que ser claro y controlable.

bot.command("ping", (ctx) => ctx.reply("pong 🧉"));

bot.command("llm", async (ctx) => {
  try {
    const out = await chat([{ role: "user", content: "Respondé solo con la palabra: listo" }]);
    await ctx.reply(`modelo dice: ${out}`);
  } catch (e: any) {
    await ctx.reply(`el modelo no responde: ${e.message}`);
  }
});

bot.command("mute", async (ctx) => {
  getState(ctx.chat.id).muteado = true;
  await ctx.reply("Listo, me callo. /unmute para que vuelva.");
});

bot.command("unmute", async (ctx) => {
  getState(ctx.chat.id).muteado = false;
  await ctx.reply("Volví a escuchar.");
});

bot.command("status", async (ctx) => {
  await ctx.reply(`detector: ${PATRON}\n${resumen(getState(ctx.chat.id))}`);
});

/** Repite la última intervención con la evidencia completa. Auditable. */
bot.command("why", async (ctx) => {
  const ultima = getState(ctx.chat.id).ultimaIntervencion;
  if (!ultima) {
    await ctx.reply("Todavía no intervine en este chat.");
    return;
  }
  const citas = ultima.evidence.map((e) => `· ${e}`).join("\n");
  await ctx.reply(
    `Dije:\n${ultima.message}\n\nConfianza: ${ultima.confidence.toFixed(2)}\n\nMe basé en:\n${citas}`,
  );
});

/** Cierra el seguimiento abierto y cancela la tarea diferida antes de que despierte. */
bot.command("listo", async (ctx) => {
  const s = getState(ctx.chat.id);
  const abiertos = seguimientosAbiertos(s);
  if (!abiertos.length) {
    await ctx.reply("No tengo nada pendiente por acá.");
    return;
  }

  const seg = abiertos[abiertos.length - 1];
  seg.resuelto = true;

  if (!seg.runId) {
    await ctx.reply(`Anotado, no vuelvo a preguntar por: ${seg.texto}`);
    return;
  }

  try {
    await runs.cancel(seg.runId);
    await ctx.reply(`Anotado. Cancelé el recordatorio de: ${seg.texto}`);
  } catch (e: any) {
    // No romper el chat porque Trigger.dev no contestó.
    console.error("no se pudo cancelar el run", seg.runId, e.message);
    await ctx.reply(`Lo anoté como resuelto, pero no pude cancelar el recordatorio: ${e.message}`);
  }
});

// ── El agente ───────────────────────────────────────────────────────────────

bot.on("message:text", async (ctx) => {
  const text = ctx.message.text;
  if (text.startsWith("/")) return; // los comandos ya los manejaron los handlers de arriba

  const chatId = ctx.chat.id;
  const msg: Msg = {
    id: ctx.message.message_id,
    from: ctx.from?.first_name ?? "?",
    text,
    ts: ctx.message.date * 1000,
  };

  let r;
  try {
    r = await procesar(chatId, msg, detector);
  } catch (e: any) {
    // El agente se calla si el modelo falla. Nunca escupe un stack al grupo.
    console.error(`[${chatId}] detector falló:`, e.message);
    return;
  }

  if (r.tipo === "silencio") {
    console.log(`[${chatId}] ${msg.from}: ${text.slice(0, 60)}  (silencio: ${r.motivo})`);
    return;
  }

  console.log(`[${chatId}] INTERVIENE (${r.intervencion.confidence.toFixed(2)}): ${r.intervencion.message}`);
  await ctx.reply(r.intervencion.message, { reply_to_message_id: msg.id });

  if (!r.followup) return;

  // Acá empieza la parte que ningún chatbot puede hacer: el agente se agenda
  // volver solo, cuando la conversación ya siguió de largo.
  const s = getState(chatId);
  const seg = abrirSeguimiento(s, { texto: r.followup, abiertoPor: msg.from, msgId: msg.id });

  try {
    const handle = await tasks.trigger<typeof seguimientoDiferido>("seguimiento-diferido", {
      chatId,
      mensaje:
        `Pasaron ${MINUTOS_SEGUIMIENTO} min y esto sigue sin resolverse:\n\n"${seg.texto}"\n\n` +
        `¿Quién lo toma? Si ya está, mandá /listo y no vuelvo a preguntar.`,
      minutos: MINUTOS_SEGUIMIENTO,
      seguimientoId: seg.id,
    });
    seg.runId = handle.id;
    console.log(`[${chatId}] seguimiento agendado en ${MINUTOS_SEGUIMIENTO} min · run ${handle.id}`);
  } catch (e: any) {
    // Sin Trigger.dev el agente sigue funcionando, solo pierde la vuelta diferida.
    console.error(`[${chatId}] no se pudo agendar el seguimiento:`, e.message);
  }
});

bot.catch((err) => console.error("error del bot:", err));

console.log(`telegram-agent arrancando · detector: ${PATRON} · seguimiento: ${MINUTOS_SEGUIMIENTO} min`);
bot.start();
