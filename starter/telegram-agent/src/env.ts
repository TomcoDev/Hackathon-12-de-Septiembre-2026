// hackathon 12/09/2026
// Carga el .env de la RAÍZ del repo, no el del directorio donde se corre.
//
// `import "dotenv/config"` resuelve ./.env contra el cwd, así que arrancar el
// bot desde starter/telegram-agent no encontraba las keys de la raíz. Importar
// este módulo primero, antes que cualquier cosa que lea process.env.

import { config } from "dotenv";
import { fileURLToPath } from "node:url";

// src/ -> telegram-agent/ -> starter/ -> raíz del repo
config({ path: fileURLToPath(new URL("../../../.env", import.meta.url)) });

// Un .env propio del starter puede agregar variables, pero no pisa las de la raíz.
// Trigger.dev lee este archivo local, así que ahí conviene tener una copia.
config();
