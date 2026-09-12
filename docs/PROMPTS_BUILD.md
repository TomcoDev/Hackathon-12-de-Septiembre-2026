# Prompts para construir la base

Para pegar en Claude Code, Codex, Cursor o el agente de código que usen, con el repo abierto.

## Cómo usarlos

- Elegir el prompt según la idea. A y B son excluyentes. C se puede correr esta noche (es data de prueba, no funcionalidad).
- Rellenar todo lo que está entre corchetes antes de pegar. Un prompt con corchetes sin rellenar produce código genérico.
- A y B se pegan a las 11:15, no antes. Todo lo que generan es funcionalidad central y tiene que nacer durante el evento.
- Una persona maneja el agente de código. Las otras no le pegan prompts al mismo repo en paralelo o se pisan.

---

## Prompt A: agente ambiental en un grupo de Telegram

Sirve para las ideas 11, 13 y 16 del documento de ideas. Misma arquitectura, cambia el detector.

```
Estás en el repo Hackathon-12-de-Septiembre-2026. Antes de escribir código leé
README.md, docs/CRONOGRAMA.md y todo starter/telegram-agent/.

CONTEXTO
Hackathon "Agents, Everywhere". Deadline de código: 15:00. Construimos un agente
ambiental que vive en un grupo de Telegram: no responde a nadie, escucha todos
los mensajes, mantiene estado por chat y SOLO interviene cuando detecta un
patrón. El silencio es una feature. Si en el video alguien le escribe al
agente, perdimos.

EL PATRÓN A DETECTAR
[ELEGIR UNO Y BORRAR LOS OTROS DOS]
- Deriva de definiciones: dos personas usan la misma palabra con significados
  distintos y llevan varios mensajes discutiendo cosas diferentes sin notarlo.
- Decisión no anotada: el grupo llegó a un acuerdo ("ok dale", "listo, hacemos
  X") y nadie lo registró. Mejor aún: la decisión contradice una anterior.
- Tarea sin dueño: alguien dijo que hay que hacer algo, nadie lo agarró, y
  pasaron N mensajes.

CONSTRUÍ, EN ESTE ORDEN, DENTRO DE starter/telegram-agent/

1. src/state.ts
   Estado por chat en memoria: Map<chatId, ChatState>. ChatState guarda los
   últimos 40 mensajes {id, from, text, ts}, la lista de participantes, y el
   estado propio del detector (glosario / decisiones / tareas, según el
   patrón). Sin base de datos. Función update(chatId, msg) que devuelve el
   estado nuevo.

2. src/detector.ts
   Interfaz:
     type Intervention = { message: string; evidence: string[]; confidence: number }
     type Detector = {
       name: string
       shouldRun(state, msg): boolean            // filtro barato, SIN llamar al modelo
       run(state, msg): Promise<Intervention|null> // llama al modelo, devuelve null si no hay nada
     }
   shouldRun existe para no gastar una llamada al modelo en cada mensaje: usá
   heurísticas (palabras repetidas por distintas personas, frases de acuerdo,
   verbos de tarea sin sujeto asignado, conteo de mensajes desde el último
   chequeo). run usa src/llm.ts con opts.schema (json_schema estricto) y el
   modelo devuelve { fire, confidence, message, evidence }. Umbral: solo
   intervenir si confidence >= 0.8. Preferir callarse a equivocarse.

3. src/detectors/[nombre-del-patron].ts
   Implementación del patrón elegido. El prompt al modelo tiene que:
   - recibir los últimos mensajes con quién dijo qué,
   - pedir evidencia textual (citar los mensajes exactos),
   - devolver un mensaje de intervención en español, máximo 3 líneas, que diga
     QUÉ detectó y POR QUÉ, con nombres. Ejemplo del tono: "Ojo: cuando Juan
     dice 'cliente' habla del usuario final y cuando María lo dice habla de la
     empresa que paga. Llevan 8 mensajes hablando de cosas distintas."
   - nunca dar consejos ni resúmenes; solo señalar el patrón.

4. src/index.ts
   Conectar todo. En cada message:text: update estado, shouldRun, si pasa run,
   si fire hacer ctx.reply con el mensaje y guardar la intervención como
   "última". Comandos de control (criterio 4 del jurado, controlable):
     /mute     el agente deja de intervenir en este chat
     /unmute   vuelve
     /status   muestra qué tiene en el estado (resumido)
     /why      repite la última intervención con la evidencia completa
   Mantener /ping y /llm.

5. src/replay.ts
   Script que lee docs/test-conversations/<caso>.json (formato [{from, text}])
   y lo reproduce mensaje a mensaje por el mismo pipeline, SIN Telegram,
   imprimiendo en qué mensaje intervino, con qué confianza y por qué.
   Agregar al package.json: "replay": "tsx src/replay.ts".
   Uso: npm run replay -- docs/test-conversations/caso1.json
   Esto es nuestro test y nuestra herramienta de calibración del umbral.

RESTRICCIONES
- Usar src/llm.ts tal como está (Responses API, gpt-5.6-luna). Si creés que
  hace falta otro modelo, decímelo, no lo cambies.
- Sin dependencias nuevas salvo que sea imprescindible, y avisame antes.
  Nada de bases de datos, colas ni frameworks.
- Todo archivo nuevo empieza con el comentario: // hackathon 12/09/2026
- Commit al terminar cada uno de los 5 pasos, con mensaje descriptivo. El
  historial es nuestra prueba de elegibilidad.
- Después de cada paso corré `npx tsc --noEmit`. No avances con errores.
- No toques starter/agent-backend ni starter/chrome-extension.
- Si algo del plan no cierra, preguntá antes de improvisar.

CRITERIO DE TERMINADO
`npm run replay` sobre caso1.json (el patrón existe) interviene en el mensaje
correcto o uno después. Sobre caso2.json (el patrón NO existe) no interviene.
Recién cuando eso pasa, probamos en el grupo real.

Empezá mostrándome el plan de archivos y las firmas de funciones. No escribas
código hasta que te diga que sí.
```

---

## Prompt B: agente de navegador dentro de un portal o formulario

Sirve para la idea 3 (corrección antes del rechazo) o cualquier variante donde el agente vive dentro de un sitio.

```
Estás en el repo Hackathon-12-de-Septiembre-2026. Antes de escribir código leé
README.md, docs/CRONOGRAMA.md, starter/chrome-extension/ y starter/agent-backend/.

CONTEXTO
Hackathon "Agents, Everywhere". Deadline de código: 15:00. Construimos un agente
que vive DENTRO de [NOMBRE DEL PORTAL O FORMULARIO, URL] como extensión de
Chrome. Mientras la persona carga [UNA FACTURA / UN FORMULARIO DE X], el agente
ve los campos en vivo, detecta lo que va a ser rechazado, propone la corrección
y, solo con confirmación, la escribe en el campo. Nadie le tipea nada al agente.

CONSTRUÍ, EN ESTE ORDEN

1. starter/agent-backend/src/padron.ts + docs/padron-mock.json
   Padrón mock: 20 entradas { ruc, razonSocial, estado }. Función lookup(ruc).
   Incluir 3 casos con razón social parecida pero no igual, para que el demo
   tenga con qué fallar.

2. starter/agent-backend/src/rules.ts
   Validaciones deterministas SIN modelo sobre el snapshot que manda la
   extensión (ver la forma en content.js). Reglas:
   [LISTAR LAS REGLAS. Ejemplo para facturación:
    - RUC: formato y dígito verificador módulo 11
    - Razón social del receptor debe coincidir con el padrón para ese RUC
    - Campos obligatorios vacíos: [lista]
    - Formatos: fecha, montos numéricos, moneda]
   Devuelve Issue[] = { field, selector, problem, severity: "error"|"warn" }.

3. starter/agent-backend/src/index.ts
   Reemplazar el passthrough de POST /agent por el flujo real:
   snapshot -> rules() -> si no hay issues, devolver { issues: [] } sin llamar
   al modelo -> si hay, llamar a chat() con opts.schema para que devuelva por
   cada issue { field, selector, problem, proposed_value, reason } donde
   reason es una frase en español que explica la regla que se rompería.
   El modelo NO inventa valores: para razón social usa lookup(); para formato
   normaliza. Si no puede proponer, proposed_value = null.

4. starter/chrome-extension/sidepanel.js + sidepanel.html
   Mostrar cada issue como tarjeta: campo, problema, valor propuesto, razón, y
   dos botones: Aplicar / Ignorar. Aplicar manda FILL al content script.
   NUNCA escribir en un campo sin click. Después de Aplicar, re-analizar solo.
   Mostrar un estado "Todo en orden" cuando issues está vacío.

5. starter/chrome-extension/content.js
   Además del snapshot con debounce (ya está), resaltar en rojo (outline) los
   campos con issue y en verde durante 1.5s al corregirse. El panel pide
   análisis automático cada vez que llega un snapshot nuevo, con debounce de
   800ms, para que el agente reaccione mientras la persona escribe.

6. starter/chrome-extension/manifest.json
   Restringir "matches" y "host_permissions" al dominio de [PORTAL]. Si es un
   formulario local para el demo, usar http://localhost/*.

RESTRICCIONES
- Usar src/llm.ts tal como está. Si creés que hace falta otro modelo, decímelo.
- Sin dependencias nuevas salvo imprescindibles, y avisame antes.
- Todo archivo nuevo empieza con: // hackathon 12/09/2026
- Commit al terminar cada paso. El historial es nuestra prueba de elegibilidad.
- `npx tsc --noEmit` en agent-backend después de cada paso. En la extensión,
  `node --check` sobre cada .js.
- No toques starter/telegram-agent.
- Si algo no cierra, preguntá antes de improvisar.

CRITERIO DE TERMINADO
Abrir el formulario, escribir mal la razón social, ver la tarjeta con la
corrección y la razón en menos de 3 segundos, click en Aplicar, ver el campo
corregido y el resaltado verde. Todo sin tipear nada en un chat.

Empezá mostrándome el plan de archivos y las firmas. No escribas código hasta
que te diga que sí.
```

---

## Prompt C: conversaciones de prueba guionadas (se puede correr esta noche)

Solo para el prompt A. Es data de prueba, no funcionalidad, así que está permitido prepararlo antes.

```
Generá 3 conversaciones de un grupo de trabajo en español rioplatense con
voseo, formato JSON: [{ "from": "Nombre", "text": "..." }]. Entre 4 personas:
Juan, María, Carla y Pedro. Tema: [EL TEMA DEL EQUIPO, ej: lanzamiento de una
app de pedidos para una cadena de farmacias]. Mensajes cortos, como en un chat
real, con typos ocasionales, algo de humor, y desacuerdos genuinos.

- caso1.json: 30 mensajes. Contiene el patrón [EL PATRÓN ELEGIDO] de forma
  clara, desarrollándose entre los mensajes 15 y 22. En un archivo aparte
  caso1.expected.md decí en qué mensaje debería intervenir el agente y por qué.
- caso2.json: 30 mensajes. NO contiene el patrón. Tiene desacuerdos reales y
  discusión intensa, pero todos hablan de lo mismo / todo tiene dueño / no hay
  decisiones sin registrar (según el patrón). Este es el caso para verificar
  que el agente se calla.
- caso3.json: 40 mensajes. Contiene el patrón de forma sutil, entre los
  mensajes 28 y 36. caso3.expected.md igual que el 1.

Guardalos en docs/test-conversations/. No agregues comentarios dentro del JSON.
```

---

## Reglas para trabajar con el agente de código durante el build

Estas son las que más tiempo ahorran.

1. **Una persona al teclado del agente.** Los demás leen el diff y prueban. Dos personas mandando prompts al mismo repo se pisan los archivos.
2. **Plan antes que código.** Los prompts terminan con "mostrame el plan". Revisar el plan lleva un minuto; deshacer código mal encaminado lleva veinte.
3. **Si propone agregar una base de datos, una cola, un framework o "refactorizar el starter": no.** Cuatro horas. Todo en memoria.
4. **Un detector. Uno.** Si el primero funciona a las 13:00 y sobra tiempo, recién ahí el segundo. Nunca dos a medias.
5. **Commit después de cada paso aunque esté feo.** Un commit cada 20 minutos es la mejor defensa ante "qué parte hicieron hoy".
6. **Cuando algo falla tres veces seguidas, cambiá de enfoque, no de prompt.** Reformular la misma petición por cuarta vez rara vez funciona.
7. **A las 14:00 se le deja de pedir features y se le pide solo: "arreglá esto".** A las 15:00 se cierra la laptop del agente de código.
