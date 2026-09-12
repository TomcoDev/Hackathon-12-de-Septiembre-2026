import "dotenv/config";
import express from "express";
import cors from "cors";
import { chat, type Message } from "./llm.js";

const app = express();
app.use(cors());              // la extensión llama desde otro origen
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => res.json({ ok: true, ts: Date.now() }));

// Endpoint genérico. La extensión o el bot mandan contexto y reciben la salida del modelo.
// TODO (durante el hackathon): reemplazar este passthrough por la lógica real del agente:
//   1. recibir el contexto del entorno (snapshot del DOM, mensajes del grupo, evento)
//   2. decidir si hay que intervenir (detector)
//   3. si sí, generar la acción concreta y devolverla estructurada
app.post("/agent", async (req, res) => {
  try {
    const { system, input } = req.body as { system?: string; input: string };
    const messages: Message[] = [
      { role: "system", content: system ?? "Sos un agente útil. Respondé en JSON con la forma {\"action\": string, \"reason\": string}." },
      { role: "user", content: input },
    ];
    const out = await chat(messages, { json: true });
    res.json({ output: out });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => console.log(`agent-backend escuchando en http://localhost:${port}`));
