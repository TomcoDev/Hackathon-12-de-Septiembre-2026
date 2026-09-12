# starter

Tres piezas mínimas, independientes entre sí, que corren sin lógica de agente. Elegir la que corresponda a la idea y borrar el resto antes de entregar, o dejarlas y explicar en el README cuál se usó.

| Carpeta | Qué es | Para qué idea |
|---|---|---|
| `agent-backend` | Express + endpoint que llama a OpenRouter | Cualquiera que necesite un servidor con la key |
| `telegram-agent` | Bot de Telegram (grammY) que escucha un grupo | Agentes ambientales en grupo: deriva de definiciones, decisión no anotada, tarea sin dueño |
| `chrome-extension` | MV3 que lee y escribe el DOM, con panel lateral | Agentes que viven dentro de un sitio: corrección de formularios, sesión de navegación |

Todos leen el `.env` de la raíz. Copiar `.env.example` a `.env` y completar.

Verificado el 11 de septiembre: los dos proyectos Node instalan y pasan `typecheck`; el backend responde `/health`. La extensión carga descomprimida.
