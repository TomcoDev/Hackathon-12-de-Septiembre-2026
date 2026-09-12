// hackathon 12/09/2026 — EL TESTIGO
// Test de caminos de error del transporte Agents API (sin red):
// sesión failed, requires_action, timeout del poll, sin output, y degradación sin key.
// Uso: npx tsx src/test-agents-api-errores.ts  (sale 0 si todo ok)
import { chat, chatJSON } from "./llm.js";

let fallos = 0;
function check(nombre: string, cond: boolean, detalle = "") {
  if (cond) console.log(`  ✓ ${nombre}`);
  else {
    fallos++;
    console.log(`  ✗ ${nombre} ${detalle}`);
  }
}

async function escenario(nombre: string, mock: (url: any, init: any) => Promise<any>, fn: () => Promise<unknown>) {
  console.log(`→ ${nombre}`);
  globalThis.fetch = (async (url: any, init: any = {}) => mock(url, init)) as any;
  try {
    await fn();
    check(`${nombre}: debía lanzar`, false);
  } catch (e: any) {
    check(`${nombre}: lanza`, true);
    console.log(`    msg: ${String(e?.message ?? e).slice(0, 110)}`);
  }
}

function r(status: number, body: unknown) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  } as any);
}

const SCHEMA = {
  name: "p",
  schema: { type: "object", properties: {}, required: [], additionalProperties: false },
};

const MSGS = [
  { role: "system" as const, content: "sys" },
  { role: "user" as const, content: "hola" },
];

async function main() {
  process.env.OPENAI_API_KEY = "sk-test";
  process.env.OPENROUTER_API_KEY = "";

  await escenario(
    "sesión failed",
    (u, i) =>
      i.method === "POST"
        ? r(200, { id: "s1", status: "failed", error: "boom del modelo" })
        : i.method === "DELETE"
          ? r(200, { deleted: true })
          : r(404, {}),
    () => chat(MSGS, {}),
  );

  await escenario(
    "sesión requiere acción",
    (u, i) =>
      i.method === "POST"
        ? r(200, { id: "s2", status: "requires_action" })
        : i.method === "DELETE"
          ? r(200, { deleted: true })
          : r(404, {}),
    () => chat(MSGS, {}),
  );

  // poll que nunca llega a idle: el timeout tiene que cortar (timeoutMs corto para el test).
  let polls = 0;
  await escenario(
    "timeout del poll",
    (u, i) => {
      if (i.method === "POST") return r(200, { id: "s3", status: "in_progress" });
      if (i.method === "DELETE") return r(200, { deleted: true });
      if (String(u).includes("/items")) return r(200, { data: [] });
      polls++;
      return r(200, { id: "s3", status: "in_progress" });
    },
    () => chat(MSGS, { timeoutMs: 1200 }),
  );
  check("timeout corta con polls hechos", polls >= 1 && polls <= 40, `polls=${polls}`);

  // sesión idle pero sin output_text en items.
  await escenario(
    "idle sin texto",
    (u, i) => {
      if (i.method === "POST") return r(200, { id: "s4", status: "idle" });
      if (String(u).includes("/items")) return r(200, { data: [{ type: "reasoning" }] });
      return i.method === "DELETE" ? r(200, { deleted: true }) : r(404, {});
    },
    () => chat(MSGS, {}),
  );

  // 429 en el POST inicial: reintenta y luego estalla con el mensaje final.
  let intentos = 0;
  await escenario(
    "429 reintentado",
    async (u, i) => {
      if (i.method === "POST" && String(u).includes("/v1/agents/sessions")) {
        intentos++;
        if (intentos < 3) return r(429, { error: { message: "rate limit" } });
        return r(200, { id: "s5", status: "failed", error: "igual falló" });
      }
      return r(200, { deleted: true });
    },
    () => chat(MSGS, {}),
  );
  check("429 reintentó 3 veces", intentos === 3, `intentos=${intentos}`);

  // sin key: cae al error claro de chat() (y en el pipeline real, al heurístico).
  process.env.OPENAI_API_KEY = "";
  await escenario("sin key", () => r(200, {}), () => chatJSON(MSGS, { schema: SCHEMA }));

  if (fallos === 0) {
    console.log("\nTODO OK ✓");
    process.exit(0);
  }
  console.log(`\n${fallos} FALLO(S) ✗`);
  process.exit(1);
}

main().catch((e) => {
  console.error("💥", e);
  process.exit(1);
});
