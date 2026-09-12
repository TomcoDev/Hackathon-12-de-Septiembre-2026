// Calibracion sin microfono. Pasa una conversacion guionada por LA MISMA tuberia
// que usa el micrófono, e imprime en que frase intervino, con que confianza y con que evidencia.
//
//   npm run replay -- fixtures/caso-positivo.json
//   npm run replay -- fixtures/caso-negativo.json
//
// Criterio de terminado, antes de tocar el micrófono:
//   - sobre el caso positivo interviene en la frase correcta o una despues
//   - sobre el caso negativo NO interviene ni una vez
//
// Si el positivo no dispara y el negativo si, casi nunca es el umbral: es que el
// prompt no exige evidencia, o que el filtro barato deja pasar lo que no debe.

import "./env.js";
import { readFileSync } from "node:fs";
import { nuevaFrase, procesar, resetState, UMBRAL, type Detector } from "./pipeline.js";
import { malentendido as DETECTOR } from "./detectors/malentendido.js";

type Guion = { nombre: string; esperado: "interviene" | "silencio"; frases: [string, string][] };

const archivo = process.argv[2];
if (!archivo) {
  console.error("uso: npm run replay -- fixtures/caso-positivo.json");
  process.exit(1);
}

const guion = JSON.parse(readFileSync(archivo, "utf8")) as Guion;
const room = `replay:${guion.nombre}`;
resetState(room);

console.log(`\n${guion.nombre}   detector=${DETECTOR.name}  umbral=${UMBRAL}  esperado=${guion.esperado}\n`);

let intervenciones = 0;

for (const [speaker, text] of guion.frases) {
  const r = await procesar(room, nuevaFrase(speaker, text), DETECTOR as Detector);

  if (r.tipo === "intervencion") {
    intervenciones++;
    console.log(`  ${speaker}: ${text}`);
    console.log(`  >> HABLA (${r.intervencion.confidence.toFixed(2)}, ${r.ms}ms)`);
    console.log(`     "${r.intervencion.message}"`);
    for (const e of r.intervencion.evidence) console.log(`     evidencia: "${e}"`);
    if (r.intervencion.action) console.log(`     accion: ${r.intervencion.action.name}`);
    console.log();
  } else {
    // El silencio tambien se imprime: es lo que se calibra.
    console.log(`  ${speaker}: ${text}`.padEnd(74) + `. ${r.motivo}`);
  }
}

const paso = guion.esperado === "interviene" ? intervenciones === 1 : intervenciones === 0;
console.log(`\n${paso ? "OK  " : "FALLA"}  ${intervenciones} intervencion(es), esperado ${guion.esperado}\n`);
process.exit(paso ? 0 : 1);
