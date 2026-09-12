// Guarda el entregable del seed con el cerebro real, para inspección.
import "./env.js";
import { writeFileSync } from "node:fs";
import { nuevoEstado } from "./pipeline.js";
import { correrReplay, leerJsonl } from "./replay.js";
import { DETECTOR } from "./detectores/index.js";
import { redactar } from "./redactor.js";

const estado = nuevoEstado(process.env.PERSONA ?? "lu");
await correrReplay(estado, leerJsonl("data/seed.jsonl"), {
  ms: 0,
  detector: DETECTOR,
  redactar,
  enviar: async () => {},
});
writeFileSync("data/seed.entregable.json", JSON.stringify(estado.entregable, null, 2));
console.log(`leídos ${estado.leidos} · anotó ${estado.anotados} · habló ${estado.intervenciones}`);
console.log(`→ data/seed.entregable.json`);
