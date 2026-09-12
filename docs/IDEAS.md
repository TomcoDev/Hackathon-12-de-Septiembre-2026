# Ideas para cerrar. Sábado 12, mediodía

La arquitectura ya está commiteada y no se toca. Lo único que se decide en este
documento es **qué patrón detecta el agente**.

Todas las ideas de abajo corren sobre lo mismo que ya funciona en
`starter/telegram-agent`: escuchar el grupo sin que nadie le hable, filtro barato
por regex, una llamada al modelo con schema estricto, umbral de confianza,
intervención con citas textuales, vuelta diferida con Trigger.dev, y los comandos
`/why` `/mute` `/status` `/listo`.

Cambiar de idea cuesta una constante y un prompt. Cambiar de entorno cuesta el
hackathon. A las 12:00 esto ya no se discute.

---

## Tabla de decisión

| # | Idea | ¿Se vio antes? | Riesgo de falso positivo | Delta de código | Veredicto |
|---|---|---|---|---|---|
| 1 | Deriva de definiciones | No | Alto | 90 min | **Recomendada** |
| 2 | El número que no coincide | Poco | Muy bajo | 45 min | **Plan B** |
| 3 | El consenso que nadie dio | No | Medio | 60 min | Fuerte |
| 4 | Contradice una decisión anterior | Poco | Medio | 90 min | Buena, demo difícil |
| 5 | La pregunta que murió | Sí | Bajo | 30 min | Segura y chata |
| 6 | Jerga que no llega | Poco | Alto | 60 min | Riesgo criterio 4 |
| 7 | Tarea sin dueño | Sí | Bajo | 0 min | Última red |

---

## 1. Deriva de definiciones · recomendada

**Qué detecta.** Dos personas usan la misma palabra con significados distintos y
llevan varios mensajes discutiendo cosas diferentes sin notarlo.

**Lo que dice el agente.**

> Están usando "cliente" con dos sentidos. Para Juan es el usuario final ("el
> cliente abre la app y no entiende"), para María es la empresa que paga ("el
> cliente nos firmó por doce meses"). Van doce mensajes.

**Por qué no es un resumidor.** La intervención nombra la palabra y las dos
acepciones, cada una con su cita. Un resumen no puede producir eso porque no está
discriminando entre hablantes.

**El beat del video.** La conversación arranca normal. El agente se calla durante
un desacuerdo genuino, que es la prueba de precisión. Después aparece solo cuando
la palabra se bifurca. Nadie le escribió nada en todo el video.

**Delta de código.** El detector ya está escrito. Falta el glosario por chat, un
comando `/glosario`, y corregir un hueco real: hoy el prompt de este patrón
devuelve `followup: null`, así que nunca dispara la tarea diferida. El follow-up
tiene que ser volver a los dos minutos a confirmar qué definición quedó. Con eso
el agente aparece dos veces sin que nadie le hable.

**Riesgo.** Es el más alto de la lista. Necesita una conversación de prueba real y
una hora de calibración con el replay. Si el umbral queda flojo, interrumpe cuando
la gente sí está de acuerdo, y eso es peor que no tener agente.

**Por qué igual es la recomendada.** Es el único patrón de toda la investigación
que un jurado global no vio hoy. El criterio que decide premia exactamente eso.

---

## 2. El número que no coincide · plan B

**Qué detecta.** Dos personas afirman cifras o fechas distintas para la misma
cosa, y la conversación sigue sin que nadie lo note.

**Lo que dice el agente.**

> Ojo con la fecha de entrega. Nico dijo "cerramos el 15", Sofi está planificando
> sobre "tenemos hasta el 20". No es la misma semana.

**Por qué no es un resumidor.** Detecta una contradicción factual entre dos
hablantes, no el tema de la charla.

**El beat del video.** Igual de fuerte que el 1, y mucho más fácil de provocar en
vivo sin que parezca guionado.

**Delta de código.** Filtro barato nuevo: mensajes que contengan números o fechas.
Prompt nuevo. Nada más.

**Riesgo.** El más bajo de toda la lista. Es verificable: o los números son
distintos o no. Casi no hay zona gris.

**Cuándo se activa este plan.** Si a las 14:15 el detector de definiciones no
llega a una precisión que se pueda mostrar, se graba este. Es el primo verificable
de la misma familia: dos personas que no están hablando de lo mismo.

---

## 3. El consenso que nadie dio

**Qué detecta.** El grupo cierra un tema, pero la persona que había objetado nunca
contestó. Se detecta una ausencia, no un mensaje.

**Lo que dice el agente.**

> Cerraron con "dale, vamos con Postgres", pero Cami había objetado el costo y no
> volvió a escribir desde entonces.

**Por qué no es un resumidor.** El valor está en lo que falta. Requiere saber quién
habló, cuándo, y quién dejó de hablar. Eso no se pega en un chat.

**El beat del video.** Muy bueno. El agente señala a alguien que no dijo nada, que
es lo último que espera el jurado de un bot de grupo.

**Delta de código.** Hay que rastrear por participante el último mensaje y si tenía
carga de objeción. El estado ya guarda participantes, falta el índice por persona.

**Riesgo.** Medio. Hay que distinguir "objetó y se fue" de "objetó y se convenció
en silencio".

---

## 4. Contradice una decisión anterior

**Qué detecta.** El grupo decide algo hoy que contradice algo que decidió antes, y
nadie se acuerda.

**Lo que dice el agente.**

> Esto contradice lo del martes. Ahí quedaron en "no tocamos el schema hasta el
> release", y recién dijeron "le agregamos la columna y listo".

**Por qué no es un resumidor.** Necesita memoria longitudinal. El agente estuvo
presente cuando se tomó la primera decisión y nadie se lo pidió.

**El beat del video.** Es el más impactante de la lista si se cree. Ese es el
problema.

**Riesgo.** El jurado va a sospechar que la decisión anterior la sembramos esta
mañana, porque la sembramos esta mañana. Se mitiga usando el historial real del
grupo del equipo, no uno inventado.

---

## 5. La pregunta que murió

**Qué detecta.** Alguien hizo una pregunta directa, la conversación siguió tres
mensajes, nadie contestó.

**Lo que dice el agente.**

> Quedó sin contestar: "¿el deploy de staging sigue roto?". Lo preguntó Ale hace
> ocho mensajes.

**Delta de código.** Casi nada. Un filtro por signo de pregunta y un prompt.

**Riesgo.** Bajo. Y el techo también es bajo: es lo más parecido a lo que el
jurado ya vio. Sirve si a las 13:00 no hay nada más funcionando.

---

## 6. Jerga que no llega

**Qué detecta.** En un grupo mixto, alguien manda un mensaje técnico que la persona
no técnica del grupo no va a entender. El agente decide quién no lo entiende según
cómo escribe cada uno, y traduce.

**Por qué es interesante.** El agente elige el destinatario. Ahí hay una decisión,
no una regla.

**Riesgo.** Alto y de otro tipo: puede resultar condescendiente. Un agente molesto
pierde el criterio de utilidad aunque acierte.

---

## 7. Tarea sin dueño · última red

Ya está codeada y andando. Alguien dijo que hay que hacer algo, nadie lo agarró, la
conversación siguió. Tiene follow-up diferido funcionando.

Es lo que se graba si a las 15:00 se rompió todo lo demás. Puntaje techo bajo: el
jurado lo va a leer como Asana con un modelo adentro.

---

## Lo que no hacemos

- **No cambiamos de entorno.** La extensión de Chrome está scaffoldeada pero
  empezar a leer el DOM de un portal ajeno a las 12:00 no llega a las 15:30.
- **No mostramos tres detectores a medias.** Se graba uno funcionando de verdad.
- **No sumamos sponsors nuevos.** Trigger.dev ya está integrado y es el que le da
  sentido a la vuelta diferida. Ambiguous AI tiene el premio especial más grande,
  pero aprender su plataforma hoy cuesta la hora que necesitamos para calibrar.
- **No dejamos que nadie le escriba al agente en el video.** Un solo mensaje
  dirigido al bot y el proyecto se lee como chatbot.

---

## Las cinco respuestas del Juez, con la idea 1

1. **¿Qué decide que un `if` no decidiría?** Que dos personas le están dando
   sentidos distintos a la misma palabra. Depende del significado, no del texto.
2. **¿Qué pasa si le sacás el entorno?** No hay dos hablantes ni historial, y el
   patrón desaparece. No queda nada que copiar y pegar.
3. **¿Quién le escribe?** Nadie. Se dispara por el flujo del grupo.
4. **¿Qué controla el usuario?** `/why` muestra la evidencia y la confianza,
   `/mute` lo apaga, y el umbral está puesto para preferir el silencio al error.
5. **¿Qué existía ayer?** Solo el scaffolding del 11. Está en `BUILD_LOG.md` y en
   los commits de hoy.

---

## Qué tiene que pasar ahora

| Hora | Qué |
|---|---|
| 12:00 | Patrón elegido. Se escribe acá cuál y no se vuelve a discutir. |
| 12:15 | Alguien empieza el dataset de conversaciones de prueba. Es una hora de trabajo y es lo que decide la precisión. |
| 13:00 | El detector elegido dispara al menos una vez en el grupo real. |
| 14:15 | Punto de corte: si la precisión no se puede mostrar, se pasa a la idea 2. |
| 14:30 | Primera toma del video. |

**Patrón elegido:** ______________________
