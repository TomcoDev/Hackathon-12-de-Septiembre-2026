// hackathon 12/09/2026
// Reproduce una conversación guionada por el MISMO pipeline que usa el bot, sin Telegram.
// Es el test y la herramienta para calibrar el umbral.
//
//   npm run replay -- docs/test-conversations/caso1.json
//
// En package.json:  "replay": "tsx src/replay.ts"

import "dotenv/config";
import { readFileSync } from "node:fs";
import { procesar, UMBRAL, type Msg, type Detector } from "./pipeline.js";
// import { detector } from "./detectors/<patron>.js";

type Guion = { from: string; text: string }[];

async function main() {
  const ruta = process.argv[2];
  if (!ruta) {
    console.error("Uso: npm run replay -- docs/test-conversations/caso1.json");
    process.exit(1);
  }

  const guion: Guion = JSON.parse(readFileSync(ruta, "utf8"));
  const chatId = -1; // chat falso, aislado del estado real
  const detector: Detector = null as any; // ← enchufar el detector real acá

  console.log(`\n${ruta}  ·  ${guion.length} mensajes  ·  umbral ${UMBRAL}\n`);

  let intervenciones = 0;
  const t0 = Date.now();

  for (let i = 0; i < guion.length; i++) {
    const msg: Msg = { id: i, from: guion[i].from, text: guion[i].text, ts: Date.now() + i };
    const r = await procesar(chatId, msg, detector);

    const n = String(i).padStart(3, " ");
    if (r.tipo === "intervencion") {
      intervenciones++;
      const { message, confidence, evidence } = r.intervencion;
      console.log(`\x1b[33m${n} ${msg.from}: ${msg.text}\x1b[0m`);
      console.log(`    ┌ INTERVIENE  confianza ${confidence.toFixed(2)}`);
      console.log(`    │ ${message.replace(/\n/g, "\n    │ ")}`);
      for (const e of evidence) console.log(`    └ cita: ${e}`);
      console.log();
    } else {
      // Silencios: en gris. Mirar los motivos es cómo se calibra el filtro barato.
      console.log(`\x1b[90m${n} ${msg.from}: ${msg.text.slice(0, 70)}  (${r.motivo})\x1b[0m`);
    }
  }

  const seg = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`\nIntervenciones: ${intervenciones}  ·  ${seg}s\n`);
  console.log("Esperado: caso con patrón interviene 1 vez, en el mensaje correcto o uno después.");
  console.log("          caso sin patrón interviene 0 veces.\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
