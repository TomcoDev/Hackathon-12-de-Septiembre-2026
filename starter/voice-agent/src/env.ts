// Carga el .env de la raiz del repo, no el del cwd.
// Sin esto, arrancar con `npm run dev` desde esta carpeta no ve las keys y da un 401 opaco.
import { config } from "dotenv";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const aqui = dirname(fileURLToPath(import.meta.url));

for (const candidato of [
  resolve(aqui, "../../../.env"), // raiz del repo
  resolve(aqui, "../.env"),       // local, por si alguien lo pone aca
]) {
  if (existsSync(candidato)) config({ path: candidato });
}

export const MODEL = process.env.OPENAI_MODEL ?? "gpt-5.6-luna";
export const TRANSCRIBE_MODEL = process.env.OPENAI_TRANSCRIBE_MODEL ?? "gpt-4o-transcribe";
export const TTS_MODEL = process.env.OPENAI_TTS_MODEL ?? "gpt-4o-mini-tts";
export const TTS_VOICE = process.env.OPENAI_TTS_VOICE ?? "alloy";
export const PORT = Number(process.env.PORT ?? 3000);

export function exigirKey(): string {
  const k = process.env.OPENAI_API_KEY;
  if (!k) {
    throw new Error(
      "Falta OPENAI_API_KEY. Ponela en el .env de la raiz del repo (no en starter/voice-agent/.env).",
    );
  }
  return k;
}
