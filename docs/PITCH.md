# EL TESTIGO — pitch, alcance y preguntas

> Un agente que vive en el chat de tu equipo, decide en silencio qué de lo que hiciste importa y de quién fue el mérito, y aparece una sola vez — cuando estás por necesitarlo — del lado tuyo, no del de tu jefe.

**Para decir en un pasillo:** "Las herramientas que leen el chat del equipo hoy trabajan para la empresa. Esta lee el mismo chat y trabaja para el empleado." No es una cámara de seguridad, es un abogado.

---

## El problema

Hay una asimetría de evidencia. El jefe tiene sistemas de su lado — Jira, OKRs, RRHH — que registran lo que se asignó y lo que se entregó. El empleado no tiene nada que registre lo que hizo *entre* los tickets: destrabar a un compañero, calmar a un cliente, apagar un incendio a las 21:38. Ese trabajo pasa en el chat, y el chat no cuenta.

En la evaluación, el jefe evalúa contra el plan y el empleado reconstruye de memoria. La pregunta donde duele: **"¿por qué no llegaste a X?"** La respuesta verdadera — "porque hice A, B, C y D, que no estaban en el plan" — existe, pero sin evidencia suena a excusa.

**El trabajo que no estaba en el plan no existe para nadie. Ni para el que lo hizo, porque ya no se acuerda.**

## Para quién

Una sola persona: la que hace el trabajo. No el jefe, no RRHH.

Y dentro de eso, **la persona pegamento**: la que hace que los demás puedan trabajar. Su trabajo aparece en el Jira como tickets *de otros* que se cierran. Es a la que le escriben "gracias" en el chat. Es la que más pierde en cada evaluación y la primera que se va.

Quién paga: la empresa. Se le van los mejores por sentirse invisibles, y cada ciclo de evaluación le cuesta semanas de gente tratando de acordarse.

## Cuándo es un agente

**Mientras lee, decide en silencio.** Por cada conversación que termina: ¿es trabajo hecho o prometido? ¿de quién es? (cuando José escribe "salió, gracias Lu", el mérito es de Lu) ¿estaba en el plan? ¿la evidencia alcanza? Un log guarda todo; un testigo decide qué importa. 262 leídos, 15 anotados: descartó 247.

**Cuando habla, elige el momento.** Una sola vez: cuando detecta en el grupo que la persona está por necesitar la evidencia. Nadie apretó nada. Un mensaje, en privado.

**Lo que nunca hace también es diseño.** Nunca escribe en el grupo. Nunca le habla al jefe. Nunca manda nada sin que la persona apriete compartir.

---

## El área: dónde se implementa hoy

**Equipos de producto y desarrollo, de 4 a 10 personas, que coordinan por un grupo de Telegram y tienen 1:1 periódicos.**

Por qué acá: el trabajo invisible es enorme y concreto (builds, incidentes, deploys), el idioma de "hecho" es explícito ("listo, ya subí", "mergeado"), el plan se declara en el chat ("este mes vamos por…"), y Telegram es el canal real de los equipos chicos en Paraguay y LATAM.

| Dimensión | Hoy |
|---|---|
| Entorno | Un grupo de Telegram |
| Persona | Una por instancia; cada una da `/start` (ese es el consentimiento y el único setup) |
| Momento | El 1:1, detectado cuando alguien lo menciona en el grupo |
| Qué anota | Resolvió · destrabó a alguien · decidió · sostuvo |
| Evidencia | Solo con mensaje que lo pruebe, con link |
| Plan | Sale del primer mensaje del grupo que enumera objetivos |
| Salida | Un mensaje privado, ocho puntos, cuáles fuera del plan |
| Control | Borrar lo que no fue así. Compartir no manda nada a nadie |

Lo que nunca entra: puntuar, comparar o rankear personas. Esa es la línea entre un testigo y un monitor.

---

## Hacia dónde apunta

El agente tiene dos partes: **el núcleo** (leer hilos, decidir qué es trabajo hecho y de quién, redactar con evidencia) y **el adaptador** (de dónde lee, cómo arma hilos, a dónde escribe). Hoy construimos el núcleo completo y un adaptador: Telegram. Todo lo que sigue es el mismo núcleo con otro disparador u otro adaptador.

### 1. Otros momentos — mismo registro, otro disparador

| Momento | Qué lo dispara en el chat | Qué entrega |
|---|---|---|
| **El 1:1** (hoy) | "mañana tengo el 1:1" | Ocho cosas del mes, con evidencia y fuera de plan |
| **Evaluación anual** | "arrancan las evaluaciones" | El año entero, ordenado por trimestre e impacto |
| **Vacaciones** | "el lunes me voy de vacaciones" | El traspaso escrito solo: qué está abierto, a quién preguntarle |
| **Pedir aumento** | "voy a pedir un aumento" | Argumentos con fecha y link, no sensaciones |
| **"¿Por qué no llegaste a X?"** | Cuando alguien lo pregunta en el grupo | "Porque hiciste A, B, C y D, y no estaban en tu plan" — ese es el que más vale |

Cada fila es un patrón de disparo nuevo y un prompt de redacción nuevo. El registro es el mismo.

### 2. Otros canales — mismo patrón, otro adaptador

El patrón se traslada a cualquier equipo que trabaje por chat. Lo interesante es que **cada entorno le da al agente sentidos distintos**:

- **Slack**: los hilos son nativos, así que la agrupación es exacta y no por ventana de tiempo. Las reacciones (✅, 🙏) son evidencia de corroboración sin que nadie escriba.
- **Teams**: hay transcripciones de reuniones. Lo que se decidió en voz alta entra al registro.
- **WhatsApp**: audios. Un "gracias Lu" dicho en un audio también cuenta, transcripto.
- **Discord**: canales por proyecto; el plan vive en el canal fijado.

En todos, la lógica de "quién lo hizo y si estaba en el plan" es la misma. Cambia de dónde salen las señales.

### 3. Verificar contra la fuente

"Ya subí el fix del timeout" cruzado contra el commit real en el repo. El bullet deja de ser una inferencia sobre un mensaje y pasa a tener dos pruebas: la cita y el hash. Es la respuesta definitiva a "lo van a usar para inflar".

### 4. La versión para la empresa — sin dar vuelta la idea

La empresa no lee el registro. Recibe lo que la gente **decide compartir**. Si diez personas comparten su mes, RRHH ve por primera vez el trabajo invisible del equipo — sin vigilancia, porque cada dato salió por decisión de su dueño. Ese es el modelo: **la empresa paga, la persona es dueña de los datos.** Es un agente para RRHH que RRHH no controla.

---

## Speech (~90 segundos)

> En la evaluación de desempeño gana el que mejor se vende, no el que más hizo. Y el trabajo real no está en el Jira — está en el chat, y se evapora.
>
> Construimos **El Testigo**: un agente que vive en el grupo de Telegram donde el equipo ya trabaja. Nadie le habla. No responde, no resume, no interrumpe. Lee el grupo todo el mes y anota en silencio lo que **hiciste** — no lo que prometiste — con link al mensaje que lo prueba.
>
> Y hace algo que un `if` no puede: cuando alguien escribe "gracias Lu, con eso salió", entiende que el mérito es de Lu, aunque lo haya escrito otro. El trabajo invisible lo registra un tercero.
>
> La única vez que habla es cuando alguien menciona tu 1:1 en el grupo. Un mensaje privado, a vos y a nadie más: ocho cosas que hiciste, con evidencia, y cuáles no estaban en tu plan.
>
> Es tu registro: borrás lo que no fue así, y nada sale sin que apretes compartir. **Lee en público, habla en privado. Nunca al revés.**
>
> Nuestra métrica no es cuántas veces acertó. Es cuántas veces se calló: 262 mensajes leídos, 15 anotados en silencio, una sola vez que habló.
>
> Empezamos construyendo la herramienta de RRHH que le dice al jefe a quién apretar. La dimos vuelta: la misma información, del lado del que labura.

---

## Preguntas que van a hacer, y qué responder

### Sobre la idea

**¿En qué se diferencia de pegar el chat en ChatGPT y pedir un resumen?**
En tres cosas que un chat no puede hacer: estuvo ahí todo el mes sin que nadie le pegara nada; decidió *cuándo* hablar, porque vio el "mañana tengo el 1:1" en el grupo; y atribuyó el mérito a la persona correcta aunque lo escribiera otro. Un resumen te dice qué pasó. Un testigo te dice qué hiciste vos.

**¿Por qué es un agente y no un script con un cron?**
Un cron corre a una hora. Esto actúa por un evento que ve en el entorno, que nadie programó. Y entre el evento y el mensaje hay decisiones: qué es trabajo hecho, de quién, si estaba en el plan, si la evidencia alcanza. Un `if` busca texto; esto atribuye.

**¿Quién le escribe al agente?**
Nadie. Se activa por lo que ve. Si alguien le tipea, no pasa nada.

**¿Qué pasa si le sacás Telegram?**
No hay evento. No hay hilos. No hay "mañana tengo el 1:1" que lo despierte. El entorno no es un contenedor: es la única entrada.

**¿Qué decide que un `if` no decidiría?**
"Salió, gracias Lu" escrito por José es evidencia sobre Lu. Un `if` ve el autor: José. El agente ve el mérito: Lu. Y también decide qué es trabajo hecho versus prometido: "ya subí el fix" cuenta; "mañana lo miro" no.

### Sobre la confianza

**¿Y si se equivoca?**
Habla en privado y pregunta en vez de afirmar. El costo de un falso positivo es que la persona lea "eso no fue así" y lo borre. Está diseñado para que equivocarse sea barato. Y ante la duda se calla: 247 de 262 descartados.

**¿Lo van a usar para inflar su trabajo?**
Cada punto tiene link al mensaje original. Es evidencia, no relato. La persona puede borrar, pero no puede agregar: solo existe lo que está en el chat. Es más difícil mentir con esto que sin esto.

**¿Y si borra lo malo para quedar bien?**
No anota lo malo: no busca culpa, busca contexto. Y es su registro, no un expediente. Borrar es curar, no fabricar.

**¿Cómo miden que funciona? ¿Precisión?**
La métrica es el silencio. En un mes de 262 mensajes habló una vez. Y el replay: pasamos el mismo mes dos veces por la misma tubería y da exactamente lo mismo. La bitácora muestra cada decisión de callarse y por qué. Nada es magia.

### Sobre la privacidad

**¿Lee mensajes de gente que no dio consentimiento?**
Lee un grupo donde la persona ya está, exactamente lo que ella puede leer scrolleando. Solo guarda evidencia sobre quien dio `/start`. Los mensajes de otros se citan únicamente como prueba del trabajo de ella, y nada sale sin que ella lo comparta.

**¿El jefe puede pedirle el reporte al bot?**
No. El bot le escribe a una sola persona, la que dio `/start`, y a nadie más. No tiene comando para pedir el reporte de otro. No existe esa puerta.

**¿Y si la empresa lo instala para vigilar?**
Entonces instaló la herramienta equivocada: esta no reporta hacia arriba. La versión para la empresa recibe solo lo que la gente decide compartir.

### Sobre la técnica

**¿Cuánto cuesta por mensaje? ¿Escala?**
El detector corre por hilo, no por mensaje, y solo en hilos que pasan un filtro barato sin modelo. 262 mensajes fueron 149 hilos, y 112 se descartaron por triviales antes de tocar el modelo. Cuesta centavos por mes por persona.

**¿Qué pasa si el modelo falla?**
El agente sigue leyendo. La falla queda en la bitácora y hay un detector heurístico sin modelo como plan B. Una llamada rota no tumba al testigo.

**¿Cómo sabe qué era el plan?**
Lo lee del propio grupo: el primer mensaje del período que enumera objetivos. No hay archivo de configuración. Si nadie declaró un plan, nada se marca fuera de plan.

**¿Por qué Telegram? ¿Y Slack?**
Telegram es donde trabajan los equipos chicos en Paraguay y LATAM, y se configura en minutos. El núcleo no sabe de Telegram: cambia el adaptador y corre en Slack, donde además los hilos son nativos.

**¿Funciona en otros idiomas?**
El plan B heurístico está calibrado en español. El detector con modelo es multilingüe.

### Sobre el hackathon

**¿Qué existía antes de hoy?**
Un bot que respondía `/ping`. Todo lo demás — importador, tubería, detector, disparador, mensaje privado, replay, pantalla — se construyó hoy. Está en `docs/BUILD_LOG.md` con hora y en el historial de commits.

**¿Los datos del demo son reales?**
El bot en vivo es real: está corriendo en un server, leyendo nuestro grupo, y el mensaje llega a un Telegram de verdad. El mes del replay es un dataset sintético, y lo decimos. Un dataset declarado no es un problema; uno disimulado sí.

**¿Qué harían con más tiempo?**
Los otros momentos (evaluación, vacaciones, aumento: mismo registro, otro disparador), Slack y Teams (mismo núcleo, otro adaptador), y cruzar cada "ya subí el fix" con el commit real.

**¿Qué sponsors usaron?**
OpenAI, Responses API con salida estructurada. Solo ese.
