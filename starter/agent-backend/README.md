# agent-backend

Servidor Express mínimo con un endpoint `POST /agent` que llama al modelo vía OpenRouter. Sirve para que la extensión de Chrome (que no puede guardar keys) tenga un backend, o para cualquier cliente.

## Correr

```bash
cd starter/agent-backend
npm install
cp ../../.env.example ../../.env   # si no existe todavía; completar OPENROUTER_API_KEY
npm run dev
```

Se levanta en `http://localhost:3000`. Probar:

```bash
curl http://localhost:3000/health
curl -X POST http://localhost:3000/agent -H "Content-Type: application/json" \
  -d '{"input":"Decí hola en JSON"}'
```

Lee el `.env` de la raíz del repo si lo corrés desde ahí, o creá uno acá.

## Qué hay que construir durante el hackathon

Todo lo que está marcado con `TODO` en `src/index.ts`. Este archivo hoy es un passthrough al modelo. La lógica del agente (detector, decisión, acción) no existe todavía. Eso es a propósito: las reglas piden que la funcionalidad central se construya durante el evento.

## Para publicarlo (si hace falta URL pública)

Google Cloud Run es sponsor. Con `gcloud run deploy --source .` se sube desde este directorio. Antes, agregar un `Dockerfile` o dejar que Cloud Run use buildpacks.
