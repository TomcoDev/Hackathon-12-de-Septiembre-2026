// Export de Telegram Desktop (result.json) -> data/<nombre>.jsonl con el contrato Msg.
//
//   npm run importar -- "C:\Users\...\ChatExport_2026-09-12\result.json" data/agosto.jsonl
//
// Telegram Desktop: abrir el grupo -> menu (⋮) -> Exportar historial de chat -> formato JSON,
// sin fotos ni media. Tarda un minuto. El archivo es result.json.
//
// Como se arma un hilo:
//   1. si el mensaje responde a otro (reply_to_message_id), va al hilo de ese otro
//   2. si no, y llego a menos de VENTANA_MIN del mensaje anterior, sigue el hilo del anterior
//   3. si no, abre un hilo nuevo
// En un grupo de Telegram casi nadie usa reply: la regla 2 es la que arma la mayoria.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { Msg } from "./tipos.js";

const VENTANA_MIN = Number(process.env.VENTANA_MIN ?? 20);

/** El texto viene como string o como lista de fragmentos (links, menciones, negritas). */
type Fragmento = string | { type: string; text: string };
type MsgExport = {
  id: number;
  type: string;
  date: string;
  from?: string;
  from_id?: string;
  reply_to_message_id?: number;
  text?: Fragmento | Fragmento[];
  forwarded_from?: string;
};
type Export = { name?: string; type?: string; id?: number; messages: MsgExport[] };

/**
 * "N\u00e9stor Mart\u00ednez" -> "nestor". "\ud83e\uddc9 Luis" -> "luis". "\u042e\u043b\u0438\u044f \u041a" -> "\u044e\u043b\u0438\u044f".
 * Prueba palabra por palabra hasta encontrar una con letras; si no hay, usa el fallback (el id).
 */
export function slug(s: string, fallback = "anon"): string {
  const palabras = s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().split(/\s+/);
  for (const p of palabras) {
    const limpio = p.replace(/[^\p{L}\p{N}_]/gu, "");
    if (limpio) return limpio;
  }
  return fallback;
}

function aplanar(t: MsgExport["text"]): string {
  if (!t) return "";
  if (typeof t === "string") return t;
  if (Array.isArray(t)) return t.map((f) => (typeof f === "string" ? f : f.text ?? "")).join("");
  return (t as { text?: string }).text ?? "";
}

export function convertir(exp: Export): { mensajes: Msg[]; autores: Map<string, number> } {
  const canal = "#" + slug(exp.name ?? "grupo");
  // t.me/c/<id>/<msg> funciona para supergrupos. El id del export ya viene sin el -100.
  const chatId = String(Math.abs(exp.id ?? 0));

  const hiloDe = new Map<number, string>();
  const autores = new Map<string, number>();
  const mensajes: Msg[] = [];
  let anterior: { id: number; ts: number; thread: string } | null = null;

  for (const m of exp.messages) {
    if (m.type !== "message") continue;
    const texto = aplanar(m.text).trim();
    if (!texto) continue;

    const ts = new Date(m.date);
    if (Number.isNaN(ts.getTime())) continue;

    let thread: string;
    if (m.reply_to_message_id && hiloDe.has(m.reply_to_message_id)) {
      thread = hiloDe.get(m.reply_to_message_id)!;
    } else if (anterior && ts.getTime() - anterior.ts < VENTANA_MIN * 60_000) {
      thread = anterior.thread;
    } else {
      thread = `t_${m.id}`;
    }
    hiloDe.set(m.id, thread);

    const autor = slug(m.from ?? "", m.from_id ? "u" + m.from_id.replace(/\D/g, "") : "anon");
    autores.set(autor, (autores.get(autor) ?? 0) + 1);

    mensajes.push({
      id: `m_${m.id}`,
      ts: ts.toISOString(),
      canal,
      autor,
      texto,
      thread_id: thread,
      link: `https://t.me/c/${chatId}/${m.id}`,
      ...(m.reply_to_message_id ? { reply_to: `m_${m.reply_to_message_id}` } : {}),
    });
    anterior = { id: m.id, ts: ts.getTime(), thread };
  }

  return { mensajes, autores };
}

// CLI
const [entrada, salida] = process.argv.slice(2);
if (entrada && import.meta.url === `file:///${process.argv[1].replace(/\\/g, "/")}`) {
  if (!existsSync(entrada)) {
    console.error(`No existe ${entrada}`);
    process.exit(1);
  }
  const exp = JSON.parse(readFileSync(entrada, "utf8")) as Export;
  const { mensajes, autores } = convertir(exp);
  const destino = salida ?? "data/mensajes.jsonl";
  mkdirSync(dirname(destino), { recursive: true });
  writeFileSync(destino, mensajes.map((m) => JSON.stringify(m)).join("\n") + "\n");

  const hilos = new Set(mensajes.map((m) => m.thread_id)).size;
  console.log(`\n${destino}: ${mensajes.length} mensajes, ${hilos} hilos`);
  console.log(`periodo: ${mensajes[0]?.ts.slice(0, 10)} a ${mensajes.at(-1)?.ts.slice(0, 10)}`);
  console.log("\nautores (usar uno de estos como PERSONA en .env):");
  for (const [a, n] of [...autores].sort((x, y) => y[1] - x[1])) console.log(`  ${a.padEnd(16)} ${n}`);
  console.log();
}
