import "dotenv/config";
import { Bot } from "grammy";
import { chat } from "./llm.js";

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) throw new Error("Falta TELEGRAM_BOT_TOKEN en .env. Crear el bot con @BotFather.");

const bot = new Bot(token);

// Verificación de que el bot está vivo.
bot.command("ping", (ctx) => ctx.reply("pong 🧉"));

// Verificación de que el modelo responde.
bot.command("llm", async (ctx) => {
  const out = await chat([{ role: "user", content: "Respondé solo con la palabra: listo" }]);
  await ctx.reply(`modelo dice: ${out}`);
});

// Escucha todos los mensajes de texto del grupo.
// IMPORTANTE: para que el bot vea los mensajes de un grupo sin que lo mencionen,
// hay que desactivar el "privacy mode" en @BotFather: /setprivacy -> Disable.
// Después, sacarlo y volverlo a agregar al grupo.
bot.on("message:text", async (ctx) => {
  const chatId = ctx.chat.id;
  const from = ctx.from?.first_name ?? "?";
  const text = ctx.message.text;
  console.log(`[${chatId}] ${from}: ${text}`);

  // TODO (durante el hackathon): acá va la lógica del agente.
  //   1. mantener estado por chat (últimos N mensajes, glosario, decisiones, tareas)
  //   2. correr el detector sobre el estado actualizado
  //   3. si el detector se enciende, intervenir con ctx.reply(...) explicando por qué
  //   4. si no, no hacer nada. El silencio es una feature.
});

bot.catch((err) => console.error("error del bot:", err));

console.log("telegram-agent arrancando (long polling)...");
bot.start();
