// Telegram. Dos cosas y nada mas:
//   1. escuchar el grupo (nadie le habla: solo lee)
//   2. mandar UN mensaje privado a la persona cuando toca
//
// Lee en publico, habla en privado. Nunca al reves.
//
// Trampa conocida: un bot NO puede escribirle primero a alguien. La persona tiene que
// haberle mandado /start en privado. Aca se guarda ese chat id en data/chats.json.

import { Bot } from "grammy";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import type { Entregable } from "./tipos.js";

const CHATS = "data/chats.json";

function leerChats(): Record<string, number> {
  try {
    return existsSync(CHATS) ? JSON.parse(readFileSync(CHATS, "utf8")) : {};
  } catch {
    return {};
  }
}

export function chatIdDe(persona: string): number | null {
  return leerChats()[persona] ?? null;
}

/**
 * Si una sola persona le dio /start, es ella. Sirve para el demo: la persona del
 * dataset ("lu") no es un usuario real de Telegram, y el DM tiene que llegar igual.
 */
export function unicoChat(): { persona: string; chatId: number } | null {
  const chats = leerChats();
  const ids = [...new Set(Object.values(chats))];
  if (ids.length !== 1) return null;
  return { persona: Object.keys(chats).find((k) => chats[k] === ids[0])!, chatId: ids[0] };
}

/** A quien le llega el DM de esta persona, o null si no hay forma de escribirle. */
export function destinoDe(persona: string): { chatId: number; nota: string } | null {
  const directo = chatIdDe(persona);
  if (directo) return { chatId: directo, nota: "" };
  const u = unicoChat();
  return u ? { chatId: u.chatId, nota: ` (a ${u.persona}, la única persona que dio /start)` } : null;
}

function guardarChat(persona: string, chatId: number): void {
  const chats = leerChats();
  chats[persona] = chatId;
  mkdirSync("data", { recursive: true });
  writeFileSync(CHATS, JSON.stringify(chats, null, 2));
}

const slug = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim().split(/\s+/)[0].replace(/[^a-z0-9_]/g, "");

export function crearBot(token: string): Bot {
  const bot = new Bot(token);

  // /start en privado: la persona le da permiso al agente para escribirle. Se guarda el chat.
  bot.command("start", async (ctx) => {
    if (ctx.chat.type !== "private") return;
    const persona = slug(ctx.from?.username ?? ctx.from?.first_name ?? "");
    guardarChat(persona, ctx.chat.id);
    if (ctx.from?.first_name) guardarChat(slug(ctx.from.first_name), ctx.chat.id);
    await ctx.reply(
      `Listo. Voy a leer el grupo y no voy a decir nada.\nCuando menciones tu 1:1, te escribo acá. Solo a vos.\n(registrado como "${persona}")`,
    );
  });

  bot.command("ping", (ctx) => ctx.reply("pong 🧉"));
  bot.catch((err) => console.error("error del bot:", err));
  return bot;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** El unico mensaje. Parcial y sereno: sin emojis, sin exclamaciones, sin felicitar. */
export function formatearDM(e: Entregable): string {
  const lineas = [`Esto es lo que hiciste entre el ${e.periodo.replace(" a ", " y el ")}.`, ""];

  e.bullets.forEach((b, i) => {
    const marca = b.fuera_de_plan ? " · no estaba en tu plan" : "";
    lineas.push(`${i + 1}. ${esc(b.texto)}${marca}\n   <a href="${b.link}">ver mensaje</a>`);
  });

  if (e.fuera_de_plan.length) {
    lineas.push("", `${numero(e.fuera_de_plan.length)} de estas no estaban en tu plan.`);
  }
  lineas.push("", `Leí ${e.leidos} mensajes. Anoté ${e.anotados}. Hablé una vez: esta.`);
  lineas.push("Si algo no fue así, borralo. Nada sale de acá sin que vos lo compartas.");
  return lineas.join("\n");
}

function numero(n: number): string {
  return ["Ninguna", "Una", "Dos", "Tres", "Cuatro", "Cinco", "Seis", "Siete", "Ocho"][n] ?? String(n);
}

export async function enviarDM(bot: Bot, chatId: number, e: Entregable): Promise<void> {
  await bot.api.sendMessage(chatId, formatearDM(e), {
    parse_mode: "HTML",
    link_preview_options: { is_disabled: true },
  });
}
