import "./env.js";
import express from "express";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { PORT } from "./env.js";
import { hablar, transcribir } from "./audio.js";
import { despachar, listarPendientes, registro, resolver } from "./actions.js";
import { getState, nuevaFrase, procesar, resetState, UMBRAL, type Detector } from "./pipeline.js";

// EL DETECTOR. Cambiar este import es lo unico que hay que tocar para cambiar de patron.
import { malentendido as DETECTOR } from "./detectors/malentendido.js";

const aqui = dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(express.json({ limit: "1mb" }));
app.use(express.static(resolve(aqui, "../public")));

const sala = (req: express.Request) => String(req.query.room ?? req.body?.room ?? "demo");

app.get("/health", (_req, res) => {
  res.json({ ok: true, detector: DETECTOR.name, umbral: UMBRAL, key: Boolean(process.env.OPENAI_API_KEY) });
});

/** Estado completo para la pantalla. La bitacora es lo que hace auditable al agente. */
app.get("/state", (req, res) => {
  const s = getState(sala(req));
  res.json({
    detector: DETECTOR.name,
    umbral: UMBRAL,
    muteado: s.muteado,
    hablantes: [...s.hablantes],
    frases: s.frases,
    bitacora: s.bitacora,
    pendientes: listarPendientes(),
    registro,
  });
});

/**
 * Entrada de voz: audio crudo en el body.
 * El browser manda el blob tal cual; sin multipart no hace falta multer.
 */
app.post(
  "/utterance",
  express.raw({ type: () => true, limit: "25mb" }),
  async (req, res) => {
    const room = sala(req);
    const speaker = String(req.query.speaker ?? "?");
    try {
      const audio = req.body as Buffer;
      if (!audio?.length) return res.status(400).json({ error: "body vacio" });

      const t = await transcribir(audio, {
        mime: req.headers["content-type"] ?? "audio/webm",
        idioma: req.query.lang ? String(req.query.lang) : undefined,
      });

      // Silencio o ruido: no ensucia el estado ni gasta una llamada al detector.
      if (t.text.length < 3) {
        return res.json({ transcripcion: t, resultado: { tipo: "descartada", motivo: "muy corta" } });
      }

      const u = nuevaFrase(speaker, t.text, t.ms);
      const resultado = await procesar(room, u, DETECTOR as Detector);
      res.json({ transcripcion: t, frase: u, resultado, ...(await efectos(resultado)) });
    } catch (e: unknown) {
      console.error("utterance:", e);
      res.status(500).json({ error: (e as Error).message });
    }
  },
);

/** Misma tuberia sin microfono. Sirve para probar el detector escribiendo. */
app.post("/text", async (req, res) => {
  try {
    const { speaker = "?", text = "" } = req.body ?? {};
    if (!text) return res.status(400).json({ error: "falta text" });
    const u = nuevaFrase(String(speaker), String(text));
    const resultado = await procesar(sala(req), u, DETECTOR as Detector);
    res.json({ frase: u, resultado, ...(await efectos(resultado)) });
  } catch (e: unknown) {
    res.status(500).json({ error: (e as Error).message });
  }
});

/** Si hubo intervencion: despacha la accion propuesta. El audio lo pide el browser aparte. */
async function efectos(resultado: Awaited<ReturnType<typeof procesar>>) {
  if (resultado.tipo !== "intervencion") return {};
  const a = resultado.intervencion.action;
  if (!a) return {};
  const accion = await despachar(a.name, a.params, resultado.intervencion.message);
  return { accion };
}

/** Texto -> mp3. El browser lo reproduce. */
app.post("/speak", async (req, res) => {
  try {
    const texto = String(req.body?.text ?? "");
    if (!texto) return res.status(400).json({ error: "falta text" });
    const mp3 = await hablar(texto);
    res.setHeader("Content-Type", "audio/mpeg");
    res.send(mp3);
  } catch (e: unknown) {
    res.status(500).json({ error: (e as Error).message });
  }
});

/** Control del usuario. Criterio 4 del rubro: si el agente se equivoca, esto es la salida. */
app.post("/control", (req, res) => {
  const room = sala(req);
  const s = getState(room);
  const cmd = String(req.body?.cmd ?? "");

  switch (cmd) {
    case "mute":
      s.muteado = true;
      return res.json({ ok: true, dice: "Listo, me callo." });
    case "unmute":
      s.muteado = false;
      return res.json({ ok: true, dice: "Vuelvo a escuchar." });
    case "reset":
      resetState(room);
      return res.json({ ok: true, dice: "Estado limpio." });
    case "status":
      return res.json({
        ok: true,
        dice: `${s.frases.length} frases, ${s.hablantes.size} hablantes, ${
          s.muteado ? "muteado" : "escuchando"
        }. Intervine ${s.bitacora.filter((b) => b.tipo === "intervencion").length} veces.`,
      });
    case "why": {
      const i = s.ultimaIntervencion;
      if (!i) return res.json({ ok: true, dice: "Todavia no intervine." });
      return res.json({
        ok: true,
        dice: `Dije: "${i.message}". Confianza ${i.confidence.toFixed(2)}.`,
        evidencia: i.evidence,
      });
    }
    default:
      return res.status(400).json({ error: `comando desconocido: ${cmd}` });
  }
});

/** Aprobar o descartar una accion con efecto afuera. */
app.post("/approve", async (req, res) => {
  const { id, ok } = req.body ?? {};
  res.json(await resolver(String(id), Boolean(ok)));
});

app.listen(PORT, () => {
  console.log(`voice-agent escuchando en http://localhost:${PORT}`);
  console.log(`  detector: ${DETECTOR.name}   umbral: ${UMBRAL}`);
  if (!process.env.OPENAI_API_KEY) console.log("  AVISO: falta OPENAI_API_KEY en el .env de la raiz.");
});
