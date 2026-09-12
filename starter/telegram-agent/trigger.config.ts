// hackathon 12/09/2026
import { defineConfig } from "@trigger.dev/sdk";

export default defineConfig({
  // El ref del proyecto sale de `npx trigger.dev@latest init` o del dashboard.
  // Se lee del entorno para no hardcodear nada de la cuenta en el repo público.
  project: process.env.TRIGGER_PROJECT_REF ?? "proj_FALTA_COMPLETAR",
  dirs: ["./src/trigger"],
  // Una espera diferida puede durar más que el default. Techo generoso.
  maxDuration: 3600,
  retries: {
    enabledInDev: true,
    default: { maxAttempts: 3, factor: 2, minTimeoutInMs: 1_000, maxTimeoutInMs: 10_000, randomize: true },
  },
});
