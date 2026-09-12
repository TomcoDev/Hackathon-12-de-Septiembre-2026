// Reproduce un mes de canal, mensaje por mensaje, por LA MISMA tuberia que el bot en vivo.
//
//   npm run replay -- data/agosto.jsonl            # acelerado, imprime la bitacora
//   npm run replay -- data/agosto.jsonl --ms 0     # sin pausa, para calibrar
//   npm run replay -- data/agosto.jsonl --ms 80    # ritmo de demo
//
// Es la demo y es la herramienta de calibracion. Criterio de terminado: corre dos veces
// seguidas sin tocar nada y da lo mismo.

import "./env.js";
import { readFileSync } from "node:fs";
import type { Msg } from "./tipos.js";
import { evaluarHilo, ingerir, nuevoEstado, pendientes, UMBRAL, type DetectorEvidencia, type Estado } from "./pipeline.js";
import { esDisparador, hablar, type Enviar, type Redactor } from "./trigger.js";

export type OpcionesReplay = {
  ms: number;
  detector: DetectorEvidencia;
  redactar: Redactor;
  enviar: Enviar;
  /** Se llama en cada mensaje. La pantalla se cuelga de aca. */
  onMensaje?: (m: Msg, estado: Estado) => void;
  /** Para abortar desde afuera (reset en la pantalla). */
  cancelado?: () => boolean;
  /** Mientras devuelva true, el bucle espera sin consumir mensajes. */
  pausado?: () => boolean;
};

export function leerJsonl(archivo: string): Msg[] {
  return readFileSync(archivo, "utf8")
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l) as Msg);
}

const pausa = (ms: number) => (ms > 0 ? new Promise((r) => setTimeout(r, ms)) : Promise.resolve());

export async function correrReplay(estado: Estado, mensajes: Msg[], o: OpcionesReplay): Promise<Estado> {
  for (const m of mensajes) {
    if (o.cancelado?.()) break;

    // Pausa: para explicar la pantalla en camara sin que el mes siga corriendo.
    while (o.pausado?.() && !o.cancelado?.()) await pausa(150);
    if (o.cancelado?.()) break;

    const cerrados = ingerir(estado, m);
    o.onMensaje?.(m, estado);

    for (const id of cerrados) await evaluarHilo(estado, id, o.detector);

    // El unico momento en que abre la boca. Y es porque alguien dijo algo en el grupo.
    if (esDisparador(m, estado)) {
      // Antes de hablar, evalua lo que quedo abierto: que no se pierda lo de esta semana.
      for (const id of pendientes(estado)) await evaluarHilo(estado, id, o.detector);
      await hablar(estado, m, o.redactar, o.enviar);
    }

    await pausa(o.ms);
  }

  for (const id of pendientes(estado)) await evaluarHilo(estado, id, o.detector);
  return estado;
}

// ---------------------------------------------------------------- CLI
const esCli = import.meta.url === `file:///${process.argv[1].replace(/\\/g, "/")}`;
if (esCli) {
  const args = process.argv.slice(2);
  const archivo = args.find((a) => !a.startsWith("--"));
  const ms = Number(args[args.indexOf("--ms") + 1] ?? 0) || 0;
  if (!archivo) {
    console.error("uso: npm run replay -- data/agosto.jsonl [--ms 80]");
    process.exit(1);
  }

  const { DETECTOR } = await import("./detectores/index.js");
  const { redactar } = await import("./redactor.js");
  const { formatearDM } = await import("./bot.js");

  const persona = process.env.PERSONA ?? "lu";
  const estado = nuevoEstado(persona);
  const mensajes = leerJsonl(archivo);
  console.log(`\n${archivo}: ${mensajes.length} mensajes · persona=${persona} · umbral=${UMBRAL}\n`);

  let bitacoraVista = 0;
  await correrReplay(estado, mensajes, {
    ms,
    detector: DETECTOR,
    redactar,
    enviar: async (e) => {
      console.log("\n" + "─".repeat(70));
      console.log("DM PRIVADO A " + persona.toUpperCase() + " (disparado por: " + estado.disparador?.autor + ": \"" + estado.disparador?.texto + "\")");
      console.log("─".repeat(70));
      console.log(formatearDM(e).replace(/<[^>]+>/g, ""));
      console.log("─".repeat(70) + "\n");
    },
    onMensaje: (m, s) => {
      // La bitacora se imprime a medida que se decide, incluido el silencio.
      for (; bitacoraVista < s.bitacora.length; bitacoraVista++) {
        const d = s.bitacora[bitacoraVista];
        if (d.tipo === "anotado") console.log(`  ✓ anotó   [${d.evidencia.tipo}] ${d.evidencia.persona}: ${d.evidencia.que.slice(0, 70)}`);
        else if (d.tipo === "hablo") console.log(`  ▶ HABLÓ   ${d.motivo}`);
        else console.log(`  · calló   ${d.motivo}`);
      }
    },
  });

  // Lo que quedo despues del ultimo mensaje.
  for (; bitacoraVista < estado.bitacora.length; bitacoraVista++) {
    const d = estado.bitacora[bitacoraVista];
    if (d.tipo === "anotado") console.log(`  ✓ anotó   [${d.evidencia.tipo}] ${d.evidencia.persona}: ${d.evidencia.que.slice(0, 70)}`);
    else if (d.tipo === "descartado") console.log(`  · calló   ${d.motivo}`);
  }

  const motivos = new Map<string, number>();
  for (const d of estado.bitacora) if (d.tipo === "descartado") motivos.set(d.motivo.split(":")[0], (motivos.get(d.motivo.split(":")[0]) ?? 0) + 1);

  console.log(`\nleídos ${estado.leidos} · anotó en silencio ${estado.anotados} · habló ${estado.intervenciones}`);
  console.log(`hilos ${estado.hilos.size} · descartes: ${[...motivos].map(([k, v]) => `${k} ${v}`).join(", ")}\n`);
  process.exit(estado.intervenciones === 1 ? 0 : 2);
}
