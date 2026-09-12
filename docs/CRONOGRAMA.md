# Cronograma del build con puntos de corte

Los puntos de corte son decisiones tomadas de antemano para no discutir bajo presión. Si a esa hora no se cumplió la condición, se aplica la contingencia sin debate.

| Hora | Qué tiene que estar pasando |
|---|---|
| 10:00 | Llegar. Resolver wifi, hotspot de respaldo, enchufes. |
| 10:30 | Transmisión global. Anotar dónde están las keys y el starter kit de los sponsors. |
| 11:00 | Cerrar la idea. Responder las cinco preguntas del Juez por escrito. |
| 11:15 | Build. Repo clonado, `.env` completo en las cuatro máquinas, `/ping` respondiendo. |
| 12:00 | **Corte 1.** El "hola mundo" del entorno anda: el bot lee el grupo, o la extensión lee el DOM. Si no anda, cambiar de entorno ahora. |
| 13:00 | **Corte 2.** El flujo central conectado de punta a punta, aunque sea feo y con datos falsos. Si no está, recortar features hasta que esté. |
| 14:00 | P4 sale del código y arranca video, descripción y post. Los otros tres pulen. |
| 14:30 | Primera toma del video, con lo que haya. Nunca quedarse sin video. |
| 15:00 | **Congelamiento.** No se agregan features. Solo se arregla lo roto. |
| 15:15 | Toma final del video. Verificar el repo público desde incógnito. |
| 15:30 | Subir los cinco entregables al portal. |
| 16:00 | Entregado. |
| 16:00 - 16:45 | Show and tell local, opcional. |

## Las cinco preguntas del Juez (responder a las 11:00)

1. ¿Qué decide el agente que un `if` no decidiría?
2. ¿Qué pasa con el video si le sacás el entorno? Si el mismo demo se puede hacer en ChatGPT, el entorno es un contenedor.
3. ¿Quién le escribe al agente? Si alguien le tipea, es un chatbot.
4. ¿Qué controla el usuario si el agente se equivoca?
5. ¿Qué parte del repo existía ayer?

Respuestas:

1.
2.
3.
4.
5. Ver `BUILD_LOG.md`.
