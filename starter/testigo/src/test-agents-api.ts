// hackathon 12/09/2026 — EL TESTIGO
// Test del transporte Agents API sin red: mockea global.fetch y verifica
// el ciclo completo de chat(): create -> poll idle -> items -> DELETE.
// Uso: npx tsx src/test-agents-api.ts  (sale 0 si todo ok)
import { chat, chatJSON } from "./llm.js";

let fallos = 0;
function check(nombre: string, cond: boolean, detalle = "") {
  if (cond) console.log(`  ✓ ${nombre}`);
  else {
    fallos++;
    console.log(`  ✗ ${nombre} ${detalle}`);
  }
}

// --- mock de la Agents API ---
const sesiones = new Map<string, { status: string; ticks: number }>();
let ultimoBody: any = null;
let ultimoPostUrl = "";
let deleteLlamados: string[] = [];

const SCHEMA = {
  name: "prueba",
  schema: {
    type: "object",
    properties: { ok: { type: "boolean" }, n: { type: "number" } },
    required: ["ok", "n"],
    additionalProperties: false,
  },
};

globalThis.fetch = (async (url: any, init: any = {}) => {
  const u = String(url);
  const method = init.method ?? "GET";

  if (method === "POST" && u.endsWith("/v1/agents/sessions")) {
    ultimoPostUrl = u;
    ultimoBody = JSON.parse(init.body);
    check("header OpenAI-Beta", init.headers["OpenAI-Beta"] === "agents=v1");
    check("header Authorization Bearer", String(init.headers.Authorization).startsWith("Bearer "));
    const id = `sess_test_${sesiones.size + 1}`;
    sesiones.set(id, { status: "in_progress", ticks: 0 });
    return respuesta(200, { id, object: "agent.session", status: "in_progress" });
  }

  if (method === "GET" && /\/v1\/agents\/sessions\/([^/]+)$/.test(u)) {
    const id = u.split("/").pop()!;
    const s = sesiones.get(id)!;
    s.ticks++;
    if (s.ticks < 3) return respuesta(200, { id, status: "in_progress" }); // 2 polls en progreso
    return respuesta(200, { id, status: "idle" });
  }

  if (method === "GET" && u.includes("/items")) {
    return respuesta(200, {
      data: [
        { type: "reasoning", summary: [] },
        {
          type: "message",
          role: "assistant",
          phase: "commentary",
          content: [{ type: "output_text", text: '{"ok":false,' }],
        },
        {
          type: "message",
          role: "assistant",
          phase: "final_answer",
          content: [{ type: "output_text", text: '{"ok":true,"n":42}' }],
        },
      ],
    });
  }

  if (method === "DELETE") {
    deleteLlamados.push(u.split("/").pop()!);
    return respuesta(200, { id: u.split("/").pop()!, deleted: true });
  }

  return respuesta(404, { error: { message: `mock no sabe ${method} ${u}` } });
}) as any;

function respuesta(status: number, body: unknown) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  } as any);
}

async function main() {
  process.env.OPENAI_API_KEY = "sk-test-123";
  process.env.OPENROUTER_API_KEY = "";

  console.log("→ chat() con schema por la Agents API");
  const out = await chatJSON<{ ok: boolean; n: number }>(
    [
      { role: "system", content: "SISTEMA: respondé JSON." },
      { role: "user", content: "devolveme ok=true y n=42" },
    ],
    { schema: SCHEMA, effort: "low" },
  );
  check("json parseado", out.ok === true && out.n === 42, JSON.stringify(out));

  console.log("→ formato del body enviado");
  check("url es /v1/agents/sessions", ultimoPostUrl.endsWith("/v1/agents/sessions"));
  check("environment none (sin sandbox)", ultimoBody.environment?.type === "none");
  check("system va en agent.instructions", ultimoBody.agent?.instructions === "SISTEMA: respondé JSON.");
  check("input solo rol user", ultimoBody.input?.every((m: any) => m.role === "user"));
  check("input_text con contenido", ultimoBody.input?.[0]?.content?.[0]?.type === "input_text");
  check("schema via agent.text.format json_schema", ultimoBody.agent?.text?.format?.type === "json_schema");
  check("schema sin name/strict (formato Agents)", ultimoBody.agent?.text?.format?.name === undefined && ultimoBody.agent?.text?.format?.strict === undefined);
  check("schema contenido integro", JSON.stringify(ultimoBody.agent?.text?.format?.schema) === JSON.stringify(SCHEMA.schema));
  check("reasoning effort low para gpt-5.x", ultimoBody.agent?.reasoning?.effort === "low");

  console.log("→ ciclo de vida de la sesión");
  check("sesion borrada al final (DELETE)", deleteLlamados.length === 1 && deleteLlamados[0].startsWith("sess_test_"));

  console.log("→ sin system prompt no manda instructions");
  await chat([{ role: "user", content: "hola" }], {});
  check("instructions ausente", ultimoBody.agent?.instructions === undefined);

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
