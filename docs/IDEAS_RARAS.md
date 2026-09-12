# Ideas raras. Segunda vuelta

El documento anterior varía **qué detecta** el agente. Todas las ideas tienen la
misma forma: escucha, detecta, contesta en el grupo. Por eso suenan parecidas.

Acá se varían los otros tres ejes, que es donde está lo que no se vio antes:

- **Dónde está parado.** En cuántas salas vive y a quién le habla.
- **Con qué voz.** No todo agente tiene que mandar mensajes.
- **En qué entorno.** Salir de Telegram tiene precio, y acá está el precio.

Numeración continúa desde `IDEAS.md`.

---

# A. Cambiar dónde está parado

## 8. El agente que vive entre dos salas · la mejor de las raras

**Qué es.** El mismo bot está en el grupo del cliente y en el grupo interno del
equipo. Nadie más está en los dos con atención completa. Detecta cuando lo que se
prometió afuera no coincide con lo que se está haciendo adentro.

**Lo que dice el agente, en el grupo interno.**

> En el grupo de Vortex, Nico dijo hace 40 minutos "el viernes lo tenés andando".
> Acá están planificando el login para la semana que viene.

**Por qué ningún chat puede hacer esto.** No existe una persona que tenga las dos
conversaciones en la cabeza al mismo tiempo. No hay nada que copiar y pegar porque
el dato está repartido entre dos salas y dos momentos. Esta es la respuesta más
fuerte de todo el documento a la pregunta "¿qué se rompe si le sacás el entorno?".

**El beat del video.** Dos celulares, uno al lado del otro. En el de la izquierda
alguien promete una fecha al cliente. En el de la derecha, sin que nadie escriba
nada, aparece el agente avisando que adentro se está planificando otra. Diez
segundos de video y el jurado entendió todo.

**Delta de código.** El estado ya es por chat. Falta un mapa de pares de salas
(`interno ← cliente`) y un detector que reciba dos ventanas en vez de una. El
contrato del detector aguanta: se transcriben las dos con un encabezado por sala.
Entre 60 y 90 minutos.

**Riesgo.** Bajo. Hay que tener las dos conversaciones vivas durante el demo, y
son cuatro personas, así que dos y dos. El único riesgo real es olvidarse de
sumar el bot al segundo grupo.

**Qué lo hace no básico.** Todos los equipos del mundo van a poner un agente en
una sala. El patrón nuevo no es el detector, es la posición.

---

## 9. Detecta en público, interviene en privado

**Qué es.** El agente ve el patrón en el grupo, pero no escribe en el grupo. Le
manda un privado a la persona que tiene que actuar, y decide quién es.

**Por qué es bueno.** Nunca deja mal a nadie delante del equipo, que es la razón
principal por la que estos agentes terminan muteados en la vida real. Que el
agente elija el destinatario es una decisión, no una regla.

**Lo que muestra el video.** El grupo sigue como si nada. El teléfono de una sola
persona vibra. Eso es una experiencia diseñada para ese entorno, no un bot
pegado encima.

**Delta de código.** Dos líneas: en vez de `ctx.reply`, un `bot.api.sendMessage`
al id de la persona. Lo caro es el prompt que elige a quién.

**Detalle que muerde.** Un bot solo puede escribirle por privado a alguien que
antes le haya hecho `/start`. En el demo se resuelve en treinta segundos, pero hay
que acordarse antes de grabar.

---

## 10. El agente que cruza el grupo con el calendario

**Qué es.** Vive en el grupo y mira una sola fuente más: el calendario. Interviene
cuando le están pidiendo algo a alguien para un momento en el que esa persona no
puede.

> Le están pidiendo a Sofi para mañana a la mañana. Sofi tiene el día entero
> bloqueado desde la semana pasada.

**Riesgo.** Medio. OAuth de Google come tiempo y hoy el tiempo es el único recurso
que no se compra. Dos fuentes es el máximo, tres es suicidio.

---

# B. Cambiar la voz

Estas tres no son ideas sueltas: son formas de intervenir que se le pueden poner
encima a cualquier detector del otro documento, incluida la 8.

## 11. El agente que nunca habla, solo reacciona

**Qué es.** No manda un solo mensaje. Su único idioma son las reacciones emoji
sobre mensajes concretos del grupo.

- 👀 sobre la pregunta que quedó sin contestar.
- ⚠️ sobre el mensaje que contradice algo de antes.
- 📌 sobre la frase donde el grupo tomó una decisión sin registrarla.

**Por qué no es un adorno.** Cambia la ecuación del ruido. Un agente que escribe
tiene que acertar mucho para que lo banquen. Un agente que solo reacciona puede
equivocarse y no molesta a nadie, así que puede intervenir diez veces más seguido.
Eso es diseño nativo del entorno, que es exactamente lo que pide el criterio de
utilidad.

**Cómo se explica.** El emoji marca el lugar. `/why` cuenta la razón. La reacción
es el titular y el comando es la nota al pie.

**Delta de código.** `ctx.react("👀")` y nada más. grammY 1.46 ya lo soporta.
Quince minutos.

## 12. El agente cuyo único output es el mensaje fijado

**Qué es.** Hay un solo mensaje fijado arriba del grupo y el agente lo reescribe
mientras la conversación avanza. Decisiones tomadas, cosas sin dueño,
contradicciones abiertas. Nunca manda un mensaje nuevo.

**Por qué es raro y bueno.** El agente no participa de la conversación: mantiene un
objeto vivo dentro del entorno. En el video se ve el pin cambiando solo mientras
la gente habla de otra cosa. Cero spam, cero riesgo de interrumpir mal.

**Delta de código.** `pinChatMessage` una vez y `editMessageText` cada vez que el
estado cambia. Necesita que el bot sea admin del grupo. Treinta minutos.

## 13. El agente que habla una vez por día

**Qué es.** Acumula todo el día y manda un solo mensaje, el más importante que vio.
La escasez es la funcionalidad.

**Por qué suma.** Le da sentido real al cron de Trigger.dev y convierte el umbral
de confianza en una decisión visible: de nueve cosas que detecté, esta es la que
vale interrumpirlos.

**Riesgo para hoy.** Un agente que habla una vez por día es difícil de mostrar en
un video de dos minutos. Sirve como garnish del pitch, no como plato principal.

---

# C. Cambiar el entorno entero

Estas tres son apuestas. Significan dejar el código de Telegram donde está y
empezar otra cosa. Si el equipo las quiere, se decide antes de las 12:30 y no
después.

## 14. El agente que vive en el portapapeles

**Qué es.** Un proceso chico que mira lo que copiás. Cuando detecta que copiaste
tres veces el mismo tipo de dato entre dos aplicaciones, entiende que estás
haciendo una transferencia manual y termina el resto solo.

> Copiaste tres RUCs del PDF al formulario. Quedan diecisiete. ¿Los hago?

**Por qué es fuerte.** El tema del hackathon es sacar al agente de la caja de
chat. Esto vive literalmente en el mecanismo de copiar y pegar, que es el gesto
que la gente hace justamente porque el agente no está ahí. Es la interpretación
más literal y más graciosa del tema.

**Viabilidad.** Dos horas desde cero en Windows, leyendo el portapapeles cada
medio segundo. Sin permisos raros, sin extensión, sin OAuth.

**Riesgo.** Un proceso que mira todo lo que copiás asusta, y con razón. Hay que
mostrar que solo se activa por repetición y que el usuario ve qué está mirando.

## 15. El agente que vive en la carpeta de Descargas

**Qué es.** Mira la carpeta donde ya cae todo. Renombra, ordena, y sobre todo
decide qué no encaja: el archivo duplicado, el que viene con otro nombre pero es la
misma factura, el que vence en tres días.

**Riesgo.** Se lee como automatización si el agente no decide nada. La parte
agéntica tiene que ser lo que escala al humano, no lo que archiva.

## 16. El agente que vive adentro de ChatGPT

**Qué es.** Una extensión que vive dentro de la caja de chat y mira cómo
preguntás. Cuando detecta que estás reformulando lo mismo por cuarta vez,
interviene sobre vos, no sobre el modelo.

> Le preguntaste lo mismo de cuatro maneras. No es el prompt: no le diste el
> archivo.

**Por qué es memorable.** Es el único proyecto del hackathon que pone al agente
adentro de la caja de chat para sacarte a vos de ahí. Es una frase que un jurado
se acuerda a las nueve de la noche después de ver cuarenta proyectos.

**Riesgo.** Enorme y evidente: si el jurado lo lee como un chatbot sobre un
chatbot, es 1 en el criterio que decide. Es la apuesta más alta del documento.

---

# La combinación que yo llevaría

**La 8, con la voz de la 11 y la 9.**

Un agente que vive en el grupo del cliente y en el interno al mismo tiempo. En el
grupo del cliente no dice nada nunca: solo deja un ⚠️ sobre la promesa que no
coincide. En el interno le escribe por privado a la persona que la hizo. Nadie
queda mal delante del cliente, y nadie le escribió al agente en todo el video.

Las tres piezas ya tienen casi todo el código hecho. Lo nuevo es el detector de
dos ventanas, y son noventa minutos.

---

# Tabla

| # | Idea | Eje | Viable hoy | Techo |
|---|---|---|---|---|
| 8 | Entre dos salas | Posición | Alta | Muy alto |
| 9 | Público detecta, privado interviene | Posición | Alta | Alto |
| 10 | Grupo más calendario | Posición | Media | Medio |
| 11 | Solo reacciones emoji | Voz | Muy alta | Alto |
| 12 | Solo el mensaje fijado | Voz | Alta | Alto |
| 13 | Una vez por día | Voz | Alta | Bajo en video |
| 14 | El portapapeles | Entorno | Media | Muy alto |
| 15 | La carpeta de Descargas | Entorno | Media | Medio |
| 16 | Adentro de ChatGPT | Entorno | Media | Todo o nada |

---

# Detalles que muerden

- El bot necesita el modo privacidad desactivado en BotFather para ver todos los
  mensajes del grupo. Si ya funciona, esto está hecho.
- Para reaccionar con emoji y para fijar mensajes el bot tiene que ser admin.
- Para escribir por privado, la persona tiene que haberle hecho `/start` antes.
- Sumar la segunda sala es agregar el bot al segundo grupo. No hay más que eso: el
  mismo proceso recibe los dos flujos y el estado ya está indexado por chat.
