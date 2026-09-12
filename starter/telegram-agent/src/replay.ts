// hackathon 12/09/2026
// Reproduce una conversación guionada por el MISMO pipeline que usa el bot, sin
// Telegram y sin Trigger.dev. Es el test y la herramienta para calibrar el umbral.
//
//   npm run replay -- ../../docs/test-conversations/caso1.json

import "./env.js";
import { readFileSync } from "node:fs";
import { procesar, UMBRAL } from "./detector.js";
import { detector, PATRON } from "./detectors/patron.js";
import type { Msg } from "./state.js";

type Guion = { from: string; text: string }[];

const GRIS = "\x1b[90m";
const AMARILLO = "\x1b[33m";
const FIN = "\x1b[0m";

async function main() {
  const ruta = process.argv[2];
  if (!ruta) {
    console.error("Uso: npm run replay -- ../../docs/test-conversations/caso1.json");
    process.exit(1);
  }

  const guion: Guion = JSON.parse(readFileSync(ruta, "utf8"));
  const chatId = -1; // chat falso, aislado del estado real

  console.log(`\n${ruta}`);
  console.log(`detector: ${PATRON} · ${guion.length} mensajes · umbral ${UMBRAL}\n`);

  let intervenciones = 0;
  const t0 = Date.now();

  for (let i = 0; i < guion.length; i++) {
    const msg: Msg = { id: i, from: guion[i].from, text: guion[i].text, ts: Date.now() + i };
    const r = await procesar(chatId, msg, detector);
    const n = String(i).padStart(3, " ");

    if (r.tipo === "intervencion") {
      intervenciones++;
      const { message, confidence, evidence } = r.intervencion;
      console.log(`${AMARILLO}${n} ${msg.from}: ${msg.text}${FIN}`);
      console.log(`    ┌ INTERVIENE · confianza ${confidence.toFixed(2)}`);
      console.log(`    │ ${message.replace(/\n/g, "\n    │ ")}`);
      for (const e of evidence) console.log(`    · cita: ${e}`);
      if (r.followup) console.log(`    └ agendaría seguimiento: ${r.followup}`);
      console.log();
    } else {
      // Los motivos del silencio son cómo se calibra el filtro barato.
      console.log(`${GRIS}${n} ${msg.from}: ${msg.text.slice(0, 66)}  (${r.motivo})${FIN}`);
    }
  }

  console.log(`\nIntervenciones: ${intervenciones} · ${((Date.now() - t0) / 1000).toFixed(1)}s\n`);
  console.log("Esperado: el caso CON patrón interviene 1 vez, en el mensaje correcto o uno después.");
  console.log("          el caso SIN patrón interviene 0 veces.\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
