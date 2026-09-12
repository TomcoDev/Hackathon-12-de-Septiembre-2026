// La prueba de terminado de P1, en un comando:
//
//   npm run verificar
//
//   1. el replay corre dos veces seguidas sobre el mismo archivo y da exactamente lo mismo
//   2. habla exactamente una vez, disparado por un mensaje del grupo
//   3. si el server esta corriendo: el bot esta conectado y puede mandar el DM
//
// Sale con 0 si todo pasa. Es lo que se corre antes de grabar.

import "./env.js";
import { existsSync } from "node:fs";
import { nuevoEstado } from "./pipeline.js";
import { correrReplay, leerJsonl } from "./replay.js";
import { DETECTOR } from "./detectores/index.js";
import { redactar } from "./redactor.js";

const PERSONA = process.env.PERSONA ?? "lu";
const archivo = process.argv[2] ?? ["data/agosto.jsonl", "data/seed.jsonl", "data/ejemplo.jsonl"].find(existsSync);
if (!archivo) {
  console.error("no hay ningún jsonl en data/. Correr `npm run seed` o `npm run importar`.");
  process.exit(1);
}

const ok = (b: boolean, texto: string) => console.log(`  ${b ? "OK   " : "FALLA"} ${texto}`);
let fallas = 0;
const check = (b: boolean, texto: string) => { ok(b, texto); if (!b) fallas++; };

async function corrida() {
  const estado = nuevoEstado(PERSONA);
  await correrReplay(estado, leerJsonl(archivo!), { ms: 0, detector: DETECTOR, redactar, enviar: async () => {} });
  return {
    leidos: estado.leidos,
    anotados: estado.anotados,
    hablo: estado.intervenciones,
    bullets: estado.entregable?.bullets.length ?? 0,
    disparador: estado.disparador ? `${estado.disparador.autor}: "${estado.disparador.texto.slice(0, 50)}"` : null,
    firma: estado.bitacora.map((d) => d.tipo + (d.tipo === "anotado" ? d.evidencia.mensaje_id : "")).join(","),
  };
}

console.log(`\nverificando ${archivo} · persona=${PERSONA}\n`);
const a = await corrida();
const b = await corrida();

check(a.firma === b.firma && a.leidos === b.leidos && a.anotados === b.anotados, `determinista: dos corridas iguales (${a.leidos} leídos · ${a.anotados} anotados · ${a.hablo} habló)`);
check(a.hablo === 1, `habló exactamente una vez${a.disparador ? `, por ${a.disparador}` : " — NADIE mencionó el 1:1 en el archivo"}`);
check(a.bullets >= 3, `el DM tiene bullets (${a.bullets})`);
check(a.anotados < a.leidos * 0.15, `descarta la mayoría (anotó ${a.anotados} de ${a.leidos})`);

// En CI no hay bot ni server: los dos ultimos chequeos son de entorno, no de
// codigo, y marcarlos en rojo esconderia una falla de verdad. GitHub Actions
// define CI=true solo. En la maquina de cualquiera del equipo no cambia nada.
if (process.env.CI) {
  console.log("  --    CI: se omiten los chequeos de bot y /start (son de entorno)");
} else try {
  const h = (await (await fetch("http://localhost:3000/health")).json()) as { bot: boolean; dmPosible: boolean; persona: string };
  check(h.bot, "bot conectado a Telegram (server en :3000)");
  check(h.dmPosible, h.dmPosible ? "alguien le dio /start: el DM llega a Telegram" : "NADIE le dio /start al bot: el DM solo se imprime en consola");
  if (h.persona !== PERSONA) ok(false, `el server corre con PERSONA=${h.persona} y este comando con ${PERSONA}: reiniciar npm run dev`);
} catch {
  ok(false, "server no está corriendo (npm run dev): no se pudo chequear el bot");
}

console.log(fallas ? `\n${fallas} cosa(s) por arreglar antes de grabar.\n` : "\nlisto para grabar.\n");
process.exit(fallas ? 1 : 0);
