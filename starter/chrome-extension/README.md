# chrome-extension

Extensión de Chrome (Manifest V3) mínima. Sin bundler, sin build: se carga directo.

Qué hace hoy:
- **content.js** corre dentro de la página, lee todos los campos de formulario (etiqueta, valor, selector) y manda un snapshot cada vez que el usuario edita algo. También sabe **escribir de vuelta** en un campo si el panel se lo pide.
- **sidepanel** muestra el snapshot y tiene un botón que lo manda al `agent-backend`. Si el modelo devuelve `{"action":"fill",...}`, escribe en el campo.
- **background.js** abre el panel al hacer click en el ícono y guarda el último snapshot.

Esto es la base del patrón "el agente ve lo que no podés pegar en un chat y actúa sobre el entorno".

## Cargar en Chrome (2 minutos)

1. Abrir `chrome://extensions`.
2. Activar **Modo de desarrollador** (arriba a la derecha).
3. **Cargar descomprimida** y elegir la carpeta `starter/chrome-extension`.
4. Abrir cualquier página con un formulario. Click en el ícono de la extensión: se abre el panel lateral con los campos leídos.
5. Con el `agent-backend` corriendo en `localhost:3000`, click en "Analizar con el agente".

Después de cada cambio en el código: botón de recargar en `chrome://extensions`, y recargar la pestaña de prueba (el content script solo se inyecta al cargar).

No hace falta pasar por la Chrome Web Store para demostrar. La revisión tarda días; cargar descomprimida es instantáneo.

## Qué hay que construir durante el hackathon

Todo lo marcado con `TODO`:
- Qué más tiene que ver el agente de la página (tablas, errores visibles, estado).
- El system prompt real y el formato de acción.
- El detector: cuándo intervenir y cuándo callarse.
- Confirmación del usuario antes de escribir en un campo (criterio 4: control).
- Restringir `matches` en el manifest al sitio real, en vez de `<all_urls>`.

## Para usar CopilotKit en el panel (categoría especial)

CopilotKit es React. Este starter es HTML plano a propósito, para no gastar tiempo en tooling. El camino corto para sumar CopilotKit sin bundlear la extensión:

1. Crear una app React aparte con Vite (`npm create vite@latest copilot-ui -- --template react-ts`) e instalar `@copilotkit/react-core` y `@copilotkit/react-ui`.
2. Cambiar `sidepanel.html` por un `<iframe src="http://localhost:5173">` a pantalla completa.
3. Pasar el snapshot al iframe con `postMessage` y recibir las acciones de vuelta.
4. El runtime de CopilotKit va en el `agent-backend` (tienen un adapter para Express).

Así la extensión sigue siendo una cáscara delgada y toda la UI del copiloto vive en una app React normal, que es donde CopilotKit se siente cómodo.
