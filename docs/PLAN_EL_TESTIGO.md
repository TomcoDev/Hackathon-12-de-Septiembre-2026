# EL TESTIGO — Plan de trabajo por persona

> Un agente que vive en tu grupo, no habla, y se acuerda de lo que hiciste.

**Equipo:** Tereré Driven Development
**Freeze de código:** 15:00. **Entrega al portal:** 15:30. **Deadline duro:** 16:00.
**Idea completa:** `EL-TESTIGO.md`. **Contratos de datos:** `starter/testigo/src/tipos.ts`.

---

## Lo que NO se hace (cerrado)

Login · base de datos · Slack real · CSS lindo · más de una persona (**solo `lu`**) · cruce con git · evaluación anual · traspaso de vacaciones · pedir aumento.

**Un solo momento: el 1:1.** Lo demás es roadmap para el pitch, no código.

Si alguien propone una feature nueva después de las 14:00, la respuesta es no.

---

## Reparto (ruleta, 12:55)

| Rol | Persona | Dueño de | Su pregunta del Juez |
|---|---|---|---|
| **P1 — Entorno + datos** | **Luis** | C1 Funcionalidad · C2 Innovación | *¿Quién le escribe al agente?* → nadie |
| **P2 — Cerebro** | **José** (+ Claude) | C3 Ejecución técnica | *¿Qué decide que un `if` no decidiría?* → a quién atribuir el trabajo cuando lo escribió otro |
| **P3 — Pantalla + entrega** | **Néstor** | C4 Utilidad/control · **los 5 entregables** | *¿Qué controla el usuario?* → borra, corrige, nada sale sin apretar |

---

## P1 — Luis — Entorno y datos

**Entrega:** `data/agosto.jsonl` · el bot que manda el DM · el replay · **el trigger del 1:1**

| Hora | Tarea | Listo cuando |
|---|---|---|
| **13:00** | Telegram Desktop → Configuración → Exportar historial del grupo del equipo → **JSON**. Convertir a `data/agosto.jsonl` con el contrato `Msg` de `tipos.ts`. `thread_id` = cadena de replies; si no hay reply, ventana de 15 minutos. `link` = `https://t.me/c/<chat_id>/<msg_id>`. | `wc -l data/agosto.jsonl` da más de 300 mensajes reales |
| **13:00** | Bot con `@BotFather`. `/setprivacy` → Disable. Token en `.env` de la raíz. **La persona del demo le da `/start` al bot en privado.** Sin eso el bot no puede escribirle primero: se descubre a las 15:10 si no se hace ahora. | `/ping` responde en el DM de la persona |
| **13:30** | `src/replay.ts`: lee el jsonl, pasa cada mensaje por `ingerir()`, evalúa cada hilo cerrado con `evaluarHilo()`, acelerado (50 ms por mensaje). Emite el estado a la pantalla de P3 (endpoint `/state` o archivo). | Corre de punta a punta con el detector mock de P2 |
| **14:00** | **El trigger.** Detector barato sobre cada mensaje del grupo: `/(1:1\|one[- ]on[- ]one\|evaluaci[oó]n\|reuni[oó]n con .*(jefe\|manager))/i`. Cuando dispara → llama al redactor de P2 → manda **un** DM a la persona. Nunca al grupo. | El DM llega **por un mensaje del grupo**, no por un botón ni un comando |
| **14:30** | Correr el replay dos veces seguidas sin tocar nada. | Mismo resultado las dos veces |

**Prueba de terminado:** `npm run replay -- data/agosto.jsonl` → el DM llega a Telegram, disparado por un mensaje del canal, y el agente **no dijo nada** antes de eso.

**Trampa:** el export de Telegram trae `text` como string o como array de fragmentos (links, menciones, negritas). Aplanar todo a string antes de nada.

---

## P2 — José — Cerebro

**Entrega:** `evidencias-mock.json` · `detectores/evidencia.ts` · `redactor.ts` · `plan.ts` · fixtures de calibración

| Hora | Tarea | Listo cuando |
|---|---|---|
| **13:00** | `data/evidencias-mock.json`: **10 evidencias escritas a mano**, específicas, con `cita` textual, con `persona` ≠ autor en al menos 3. **Esto desbloquea a Néstor.** | Néstor tiene bullets en pantalla |
| **13:30** | `src/detectores/evidencia.ts`: un hilo → `Evidencia[]`. Schema estricto (`strict: true`, todo en `required`, `additionalProperties: false`). El prompt: exige cita textual, prohíbe inferir sin cita, da **permiso explícito de devolver vacío** ("si no estás seguro, no anotes"). Ante la duda **atribuye a favor**. | Corre sobre 5 hilos reales y anota 1 o 2, no 5 |
| **14:00** | `src/redactor.ts`: evidencias + plan → 8 bullets ordenados por impacto. **Regla dura en código, después del modelo:** un bullet que no nombre una persona afectada o un artefacto concreto (archivo, feature, cliente, sistema) se descarta. Ejemplos negativos en el prompt: *"participaste en varias conversaciones"*, *"colaboraste activamente"*, *"tuviste una gran semana"* = prohibido. Sin emojis, sin signos de exclamación. | Cero bullets genéricos en 3 corridas seguidas |
| **14:30** | `src/plan.ts`: 1 llamada sobre los primeros 20 mensajes del período (o el mensaje fijado) → `PlanItem[]`. `no_estaba_en_plan` = evidencia que no mapea a ningún ítem. | El remate *"estas 4 no estaban en tu plan"* sale de datos, no de un hardcode |
| **14:45** | `fixtures/caso-positivo.json` (un hilo con trabajo hecho) y `fixtures/caso-negativo.json` (charla sin trabajo, misma longitud). Calibrar `UMBRAL` con el replay. | Positivo anota 1, negativo anota 0 |

**Prueba de terminado:** con `OPENAI_API_KEY` rota, el replay **sigue corriendo** y la bitácora dice `error del modelo: ...` en cada hilo, sin caerse. Eso es el "manejo de fallos bien pensado" de C3 = 5.

**Trampa:** el modelo va a escribir genérico y motivacional. No se arregla pidiéndole que sea específico: se arregla con la regla dura en código. Vas a querer anotar todo. No. El 80% del trabajo es descartar.

---

## P3 — Néstor — Pantalla y entrega

**Entrega:** la pantalla del demo · el video · el post · el README · el portal

| Hora | Tarea | Listo cuando |
|---|---|---|
| **13:00** | Pantalla mínima, dos columnas. Izquierda: el canal reproduciéndose. Derecha: la bitácora (qué descartó y por qué, qué anotó). Arriba, **el contador**: `leídos 1.400 · anotó en silencio 47 · habló 1`. **Tres números, no dos:** el del medio prueba que el silencio no es inactividad. | Se ve con el mock de José |
| **13:30** | El entregable en pantalla: 8 bullets, cada uno con link clickeable al mensaje, los fuera-de-plan marcados. **Botón borrar** por bullet. Botón compartir que **solo muestra "listo para compartir"**: no manda nada a nadie. | Borrar un bullet cambia el entregable |
| **14:00** | **Sale del código. Fijo. Sin excepción.** Guion del video (abajo) impreso. README con la sección "por qué el entorno es esencial". Post con handles verificados. `BUILD_LOG.md` al día. | Guion impreso, README listo |
| **14:30** | Primera toma del video con lo que haya. Notificaciones apagadas, zoom 125 %. | Hay un video, aunque sea feo |
| **15:15** | Toma final. Repo público verificado desde incógnito. `git log -p \| grep -i "api_key\|token\|secret"` limpio. | Los 5 entregables en el portal |

**Prueba de terminado:** en cámara, alguien borra un bullet y el entregable cambia. Eso es el control del usuario de C4.

**Trampa:** no tocar CSS hasta que la demo corra de punta a punta.

---

## Puntos de corte (se aplican sin debate)

| Hora | Si a esta hora NO… | Entonces… |
|---|---|---|
| **13:30** | …el export real está en jsonl | Luis arma 60 mensajes a mano del grupo de hoy. Se dice en cámara que es real. |
| **14:00** | …el detector real anota algo sobre hilos reales | Se filma con el mock de José. El video no espera. |
| **14:30** | …el plan sale del canal | `no_estaba_en_plan` se hardcodea en el mock y el remate se mantiene. |
| **15:00** | Freeze. | Solo se arregla lo roto. Nada nuevo. |

---

## Guion del video (2:00, no 3:00)

| Tiempo | Pantalla | Voz en off (inglés) |
|---|---|---|
| 0:00–0:12 | Pantalla negra o cara | *"Your manager has HR. You have nobody. Real work happens in chat, and it evaporates."* |
| 0:12–0:50 | Replay acelerado. **Contador corriendo.** | *"This is our team's real group, one month. The Witness reads everything. It says nothing. Watch the counter: 1,400 read, 47 noted in silence, zero spoken."* |
| 0:50–1:05 | Alguien escribe *"mañana tengo el 1:1"* en el grupo | *"Nobody talks to it. Someone just mentions the 1:1 — and for the first time in a month, it speaks. In private."* |
| 1:05–1:35 | El DM: 8 bullets con link | *"Eight things you did. With the message that proves each one. Three you'd forgotten. Four weren't in your plan — which is why you didn't get to the fifth."* |
| 1:35–1:48 | Borrar un bullet. Botón compartir. | *"You delete what's wrong. Nothing leaves without you pressing share. It works for you, not for them."* |
| 1:48–2:00 | Repo | *"We started building HR's tool. We flipped it. Built in four hours in San Lorenzo, Paraguay, with OpenAI."* |

---

## Las 5 preguntas del Juez, respondidas

1. **¿Qué decide que un `if` no decidiría?** A quién atribuir el trabajo cuando lo escribió otro (*"gracias lu, con eso salió"* es evidencia sobre lu), y qué cuenta como hecho vs. prometido.
2. **¿Qué pasa si le sacás el entorno?** No hay evento. No hay hilos. No hay mensaje del 1:1 que lo despierte.
3. **¿Quién le escribe?** Nadie. Lee el grupo, habla al DM. **Lee en público, habla en privado, nunca al revés.**
4. **¿Qué controla el usuario?** Borra, corrige, y nada sale sin apretar compartir.
5. **¿Qué existía ayer?** Starter de Telegram con `/ping`. Todo lo demás está en `BUILD_LOG.md` con hora.

---

## Cómo se ve un 5 en cada criterio

| Criterio | Qué tiene que verse |
|---|---|
| **C1** | Corre dos veces igual, con datos reales, y degrada cuando el modelo falla en vez de morirse. |
| **C2** | En todo el video **nadie le tipea al agente**. El trigger es un mensaje del canal que no era para él. El mérito se lo atribuye a alguien que no escribió el mensaje. |
| **C3** | Schema estricto, umbral calibrado con replay, bitácora que muestra por qué **no** anotó, falla manejada. |
| **C4** | Privado. La persona borra lo que no le cierra. Nada sale sin que apriete. |

**La métrica que presentamos no es accuracy. Es cuántas veces se calló.**
