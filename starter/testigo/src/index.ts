// EL TESTIGO. Un proceso, dos entradas, una salida.
//
//   entradas: el grupo de Telegram en vivo  (si hay TELEGRAM_BOT_TOKEN)
//             el replay de un jsonl          (POST /replay, para la demo)
//   salida:   UN mensaje privado a la persona, cuando alguien menciona el 1:1
//
// La pantalla (public/) solo lee /state. No decide nada.

import "./env.js";
import express from "express";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { PORT } from "./env.js";
import type { Msg } from "./tipos.js";
import { evaluarHilo, ingerir, nuevoEstado, pendientes, UMBRAL, type Estado } from "./pipeline.js";
import { esDisparador, hablar, type Enviar } from "./trigger.js";
import { DETECTOR } from "./detectores/index.js";
import { redactar } from "./redactor.js";
import { chatIdDe, crearBot, enviarDM, formatearDM } from "./bot.js";
import { correrReplay, leerJsonl } from "./replay.js";
import { slug } from "./importar.js";

const PERSONA = process.env.PERSONA ?? "lu";
/** El replay usa el export real si existe; si no, el seed; si no, el ejemplo chico. */
const ARCHIVO_DEFAULT = ["data/agosto.jsonl", "data/seed.jsonl", "data/ejemplo.jsonl"].find(existsSync) ?? "data/ejemplo.jsonl";
const aqui = dirname(fileURLToPath(import.meta.url));

let estado: Estado = nuevoEstado(PERSONA);
let replayEnCurso = false;
let cancelarReplay = false;
let totalReplay = 0;
let archivoReplay = "";

// ---------------------------------------------------------------- salida
const token = process.env.TELEGRAM_BOT_TOKEN;
const bot = token ? crearBot(token) : null;

/** Manda el DM si puede. Si no puede, lo dice en la bitacora en vez de fallar en silencio. */
const enviar: Enviar = async (e, s) => {
  const chatId = chatIdDe(s.persona);
  if (bot && chatId) {
    try {
      await enviarDM(bot, chatId, e);
      console.log(`DM enviado a ${s.persona} (chat ${chatId})`);
      return;
    } catch (err: unknown) {
      s.bitacora.push({ ts: new Date().toISOString(), hilo: "-", tipo: "descartado", motivo: `no pude mandar el DM: ${(err as Error).message}`.slice(0, 140) });
    }
  } else {
    const por = !bot ? "sin TELEGRAM_BOT_TOKEN" : `"${s.persona}" nunca le dio /start al bot`;
    s.bitacora.push({ ts: new Date().toISOString(), hilo: "-", tipo: "descartado", motivo: `DM no enviado (${por}); queda en pantalla` });
  }
  console.log("\n" + formatearDM(e).replace(/<[^>]+>/g, "") + "\n");
};

// ---------------------------------------------------------------- entrada 1: el grupo en vivo
const VENTANA_MS = Number(process.env.VENTANA_MIN ?? 20) * 60_000;
let anteriorVivo: { ts: number; thread: string } | null = null;
if (bot) {
  bot.on("message:text", async (ctx) => {
    if (ctx.chat.type === "private") return; // en privado solo /start y /ping
    // Admin anonimo: Telegram esconde quien escribio. No hay forma de atribuirlo.
    if (ctx.message.sender_chat) {
      console.log(`[grupo] mensaje de un admin ANONIMO, no se puede atribuir. Desactivar "Permanecer anonimo" en los permisos de admin del grupo.`);
      return;
    }
    // Misma regla de hilos que importar.ts: reply, o ventana de 20 min, o hilo nuevo.
    const ts = ctx.message.date * 1000;
    const thread = ctx.message.reply_to_message ? `t_${ctx.message.reply_to_message.message_id}`
      : anteriorVivo && ts - anteriorVivo.ts < VENTANA_MS ? anteriorVivo.thread : `t_${ctx.message.message_id}`;
    anteriorVivo = { ts, thread };
    const m: Msg = {
      id: `m_${ctx.message.message_id}`,
      ts: new Date(ts).toISOString(),
      canal: "#" + slug(ctx.chat.title ?? "grupo"),
      // Nombre -> apellido -> @username -> id. Un nombre de puros emojis cae al siguiente, no al id.
      autor: slug(ctx.from.first_name ?? "", slug(ctx.from.last_name ?? "", slug(ctx.from.username ?? "", "u" + ctx.from.id))),
      texto: ctx.message.text,
      thread_id: thread,
      link: `https://t.me/c/${String(ctx.chat.id).replace(/^-100/, "")}/${ctx.message.message_id}`,
    };
    console.log(`[grupo] ${m.autor}: ${m.texto.slice(0, 80)}`);
    // Mismo camino que el replay. Ni una linea distinta.
    const cerrados = ingerir(estado, m);
    for (const id of cerrados) await evaluarHilo(estado, id, DETECTOR);
    if (esDisparador(m, estado)) {
      for (const id of pendientes(estado)) await evaluarHilo(estado, id, DETECTOR);
      await hablar(estado, m, redactar, enviar);
    }
  });
  bot.start({ onStart: (me) => console.log(`bot @${me.username} escuchando el grupo (long polling)`) });

  // En vivo un hilo tambien se cierra por tiempo: QUIETUD_MIN minutos sin actividad.
  // Sin esto, en un grupo real "anoto en silencio" recien aparece cuando llegan 6 mensajes mas.
  const QUIETUD_MS = Number(process.env.QUIETUD_MIN ?? 1) * 60_000;
  setInterval(async () => {
    if (replayEnCurso) return;
    const limite = Date.now() - QUIETUD_MS;
    for (const id of pendientes(estado)) {
      const ultimo = estado.hilos.get(id)?.at(-1);
      if (ultimo && new Date(ultimo.ts).getTime() < limite) await evaluarHilo(estado, id, DETECTOR);
    }
  }, 10_000);
}

// ---------------------------------------------------------------- entrada 2: el replay
const app = express();
app.use(express.json());
app.use(express.static(resolve(aqui, "../public")));

app.get("/health", (_req, res) => {
  res.json({ ok: true, persona: PERSONA, umbral: UMBRAL, archivo: ARCHIVO_DEFAULT, bot: Boolean(bot), dmPosible: Boolean(bot && chatIdDe(PERSONA)), key: Boolean(process.env.OPENAI_API_KEY) });
});

/** Todo lo que la pantalla necesita. Se pollea cada 300ms durante el replay. */
app.get("/state", (_req, res) => {
  res.json({
    persona: estado.persona,
    umbral: UMBRAL,
    leidos: estado.leidos,
    anotados: estado.anotados,
    intervenciones: estado.intervenciones,
    hilos: estado.hilos.size,
    ultimos: estado.ultimos,
    bitacora: estado.bitacora.slice(-80),
    evidencias: estado.evidencias,
    plan: estado.plan,
    disparador: estado.disparador,
    entregable: estado.entregable,
    replayEnCurso,
    total: totalReplay,
    archivo: archivoReplay,
    dmPosible: Boolean(bot && chatIdDe(PERSONA)),
  });
});

/** Arranca el replay en background. La pantalla ve avanzar el contador por /state. */
app.post("/replay", async (req, res) => {
  if (replayEnCurso) return res.status(409).json({ error: "ya hay un replay corriendo; hacé reset" });
  const archivo = String(req.body?.archivo ?? ARCHIVO_DEFAULT);
  const ms = Number(req.body?.ms ?? 80);
  if (!existsSync(archivo)) return res.status(400).json({ error: `no existe ${archivo}` });

  estado = nuevoEstado(PERSONA);
  replayEnCurso = true;
  cancelarReplay = false;
  const mensajes = leerJsonl(archivo);
  totalReplay = mensajes.length;
  archivoReplay = archivo;
  res.json({ ok: true, mensajes: mensajes.length, ms });

  correrReplay(estado, mensajes, { ms, detector: DETECTOR, redactar, enviar, cancelado: () => cancelarReplay })
    .catch((e) => console.error("replay:", e))
    .finally(() => (replayEnCurso = false));
});

app.post("/reset", (_req, res) => {
  cancelarReplay = true;
  estado = nuevoEstado(PERSONA);
  totalReplay = 0;
  archivoReplay = "";
  res.json({ ok: true });
});

// ---------------------------------------------------------------- control de la persona (criterio 4)
/** Borrar un bullet. Es su registro: lo que no fue asi, se va. */
app.delete("/entregable/:evidencia_id", (req, res) => {
  const e = estado.entregable;
  if (!e) return res.status(404).json({ error: "todavía no hay entregable" });
  e.bullets = e.bullets.filter((b) => b.evidencia_id !== req.params.evidencia_id);
  e.fuera_de_plan = e.fuera_de_plan.filter((id) => id !== req.params.evidencia_id);
  res.json(e);
});

/** Compartir NO manda nada a nadie. Solo marca que la persona decidio. Es el boton que existe para que se vea que existe. */
app.post("/entregable/compartir", (_req, res) => {
  const e = estado.entregable;
  if (!e) return res.status(404).json({ error: "todavía no hay entregable" });
  e.compartido = true;
  res.json(e);
});

app.listen(PORT, () => {
  console.log(`EL TESTIGO en http://localhost:${PORT}  persona=${PERSONA}  umbral=${UMBRAL}`);
  if (!bot) console.log("  sin TELEGRAM_BOT_TOKEN: el DM se imprime en consola y queda en /state");
  else if (!chatIdDe(PERSONA)) console.log(`  AVISO: "${PERSONA}" todavía no le dio /start al bot. Sin eso no puedo escribirle.`);
});
