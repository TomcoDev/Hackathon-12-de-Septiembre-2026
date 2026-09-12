# EL TESTIGO

> Un agente que vive en el grupo de tu equipo, no habla nunca, y se acuerda de lo que hiciste.

**Equipo:** Tereré Driven Development (TDD, pero el otro)
**Hackathon:** Agents, Everywhere · AI Tinkerers × OpenAI · 12 de septiembre de 2026 · sede San Lorenzo, Paraguay

[![Ver demo](https://img.shields.io/badge/demo-video%202%20min-red)](https://www.youtube.com/watch?v=fBRx-2QU_4U)

---

## El problema

Llega tu 1:1 y no te acordás de lo que hiciste. Abrís el chat del equipo y scrolleás
un mes para atrás buscando pruebas, y lo que encontrás son cuarenta conversaciones
donde el trabajo está mencionado al pasar.

Lo peor no es olvidarte. Es que el trabajo que hiciste quedó registrado a nombre de
otro. Alguien escribió "listo, ya está arreglado" y el que lo arregló fuiste vos.
Nadie mintió: así habla un grupo.

La gente que documenta lo suyo llega con una lista. La gente que no, llega con la
memoria. Y el 1:1 lo gana la lista.

## El agente

EL TESTIGO está en el grupo desde el primer día y **no dice una palabra**. Lee todo,
arma hilos, y cuando un hilo se cierra decide si adentro hay trabajo hecho y de
quién es. Lo anota en silencio, con la cita textual que lo prueba.

Habla una sola vez, y no en el grupo: **cuando alguien menciona en el chat que
tiene su 1:1**, el agente le manda un privado a esa persona con lo que vio. Ocho
puntos ordenados por impacto, cada uno con el link al mensaje exacto donde pasó, y
marcados los que no estaban en el plan del mes.

Nadie le escribe. Nadie le pide nada. El disparador es una frase del grupo que no
iba dirigida a él.

## Por qué el entorno es esencial

- **Ve lo que no podés pegar en un chat.** La evidencia es un mes de conversación
  de varias personas, con hilos, respuestas y agradecimientos cruzados. No es un
  texto que copiás: es una estructura que hay que haber estado presente para tener.
- **Nadie le escribe: se activa por una frase del grupo.** El disparador es que
  alguien mencione su 1:1 hablando con otro. El agente no es parte de esa
  conversación.
- **Decide algo que un `if` no decide.** A quién se le atribuye el trabajo cuando
  el mensaje lo escribió otra persona. "Gracias Lu por bancar el deploy" es
  evidencia sobre Lu, y Lu no escribió ese mensaje.
- **Si lo sacás del grupo, no queda nada.** Sin las otras personas no hay
  atribución cruzada, sin el historial no hay período, y sin el 1:1 mencionado al
  pasar no hay disparador. Queda un chatbot al que le pedís un resumen.

## Demo

**En vivo: [https://eltestigo.lat](https://eltestigo.lat)** · Video de dos minutos: **[ver en YouTube](https://www.youtube.com/watch?v=fBRx-2QU_4U)**

Lo que se ve: el grupo corriendo un mes acelerado mientras el contador sube y el
agente no dice nada. Alguien menciona su 1:1. Llega un privado con ocho puntos
linkeados. La persona borra uno que no quiere llevar.

La pantalla en vivo se puede mirar sin instalar nada. Reproducir el mes y
resetear están cerrados desde afuera, para que nadie corte el demo a mitad de
camino; el equipo los habilita entrando una vez a `/desbloquear`.

## Cómo correrlo

```bash
git clone https://github.com/TomcoDev/Hackathon-12-de-Septiembre-2026.git
cd Hackathon-12-de-Septiembre-2026
cp .env.example .env      # TELEGRAM_BOT_TOKEN, PERSONA=lu, OPENAI_API_KEY
cd starter/testigo
npm install
npm run dev               # servidor en :3000, y el bot en vivo si hay token
```

Abrir `http://localhost:3000` y apretar **Reproducir el mes**. Con el dataset de
ejemplo que viene en el repo se ve la tubería entera sin configurar nada más.

Para correrlo sobre un grupo propio, exportar el historial desde Telegram Desktop
en JSON y pasarlo por el importador:

```bash
npm run importar -- "ruta/al/result.json" data/agosto.jsonl
npm run replay -- data/agosto.jsonl --ms 80
```

El replay usa exactamente la misma tubería que el bot en vivo, así que calibrar
contra un archivo sirve para el grupo real. Termina con código 0 si el agente
habló exactamente una vez.

El export del grupo es privado y está en `.gitignore`. Lo único que se sube es
`data/ejemplo.jsonl`, que es sintético.

Para el bot en vivo hacen falta dos cosas que se olvidan y se descubren tarde: el
modo privacidad **desactivado** en [@BotFather](https://t.me/BotFather), y que la
persona del demo le haya mandado `/start` en privado al bot. Sin ese `/start`,
Telegram no permite que un bot escriba primero.

Detalle de cada archivo y de los endpoints: `starter/testigo/README.md`.

## Arquitectura

```
grupo de Telegram
      ↓
   ingerir()        arma hilos: cadena de replies, o ventana de 15 minutos
      ↓
  evaluarHilo()     ¿hay trabajo hecho acá? ¿de quién? → Evidencia[] con cita textual
      ↓
   en silencio      se anota, no se dice nada
      ↓
   el trigger       alguien menciona su 1:1 en el grupo
      ↓
   redactor()       evidencias + plan del mes → 8 puntos ordenados por impacto
      ↓
   un privado       a esa persona. Nunca al grupo.
```

| Componente | Herramienta | Para qué |
|---|---|---|
| Modelo | OpenAI, Responses API con structured outputs estrictos | Decidir si un hilo contiene trabajo, de quién es, y redactar los puntos |
| Entorno | Telegram, grammY | El grupo donde pasa todo, y el privado donde el agente habla una vez |
| Datos | `data/seed.jsonl`, sintético, y opcionalmente el export real de un grupo | El repo trae un mes sintético para que cualquiera lo corra sin datos privados. El importador acepta el export real de Telegram, que queda fuera de git |

El schema estricto no es decorativo: la salida del modelo está garantizada por
construcción, y encima corre una regla dura en código que descarta todo punto que
no nombre una persona o un artefacto concreto. El modelo tiende a escribir
"colaboraste activamente", y eso se tira.

## Control del usuario

El criterio de utilidad pide que sea claro y controlable. Acá:

- **Nada sale sin que la persona apriete.** El botón de compartir dice "listo para
  compartir" y no manda nada a ningún lado.
- **Se borra punto por punto.** Si no querés llevar algo a tu 1:1, lo sacás y el
  entregable cambia.
- **Cada punto tiene el link al mensaje.** No hay que creerle: se verifica en un
  click contra el mensaje original.
- **El agente prefiere callarse.** Ante la duda no anota, y ante la duda en la
  atribución, atribuye a favor de la persona.

## Qué se construyó durante el hackathon

Por las reglas de elegibilidad esto tiene que estar claro. Ver `docs/BUILD_LOG.md`
y el historial de commits.

**Antes del evento (permitido: scaffolding y plantillas):** estructura del repo,
`.env.example`, starters mínimos que solo conectan y responden `/ping`, plantillas
de video, post y entrega.

**Durante el evento:** todo lo que decide algo. La ingesta y el armado de hilos, el
detector de evidencia con su schema y su umbral, la regla dura contra los puntos
genéricos, el plan del mes, el disparador del 1:1, el privado, la pantalla del demo
y el replay.

## Equipo

| Nombre | Rol en el build |
|---|---|
| Luis Calabro | Entorno y datos: export del grupo, bot, replay, el disparador del 1:1 |
| José Ascurra | Cerebro: detector de evidencia, redactor, umbral, plan del mes |
| Néstor Martínez | Pantalla y entrega: la pantalla del demo, video, post, README |

## Licencia

MIT
