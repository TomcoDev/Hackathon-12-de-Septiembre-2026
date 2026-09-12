// Genera un mes sintetico de grupo en FORMATO EXPORT DE TELEGRAM DESKTOP (result.json),
// asi el seed recorre exactamente el mismo camino que el export real: importar -> replay.
//
//   npm run seed        -> fixtures/telegram-export-seed.json + data/seed.jsonl
//
// Las escenas de trabajo estan escritas a mano (eso es lo que se ve en el video).
// El ruido se genera: saludos, almuerzos, memes, "dale". Determinista: siempre sale igual.

import { mkdirSync, writeFileSync } from "node:fs";
import { convertir } from "./importar.js";

// PRNG determinista: el seed es siempre el mismo mes.
let semilla = 20260912;
const rnd = () => { semilla = (semilla + 0x6d2b79f5) | 0; let t = Math.imul(semilla ^ (semilla >>> 15), 1 | semilla); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)];
const entre = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1));

type Linea = { d: string; h: string; de: string; t: string; re?: number };
const escena = (d: string, ...ls: [string, string, string, number?][]): Linea[] =>
  ls.map(([h, de, t, re]) => ({ d, h, de, t, ...(re !== undefined ? { re } : {}) }));

// Persona del demo: Lu. Los demas: Marta (jefa), Nestor, Jose, Caro (soporte), Diego (ventas).
const ESCENAS: Linea[][] = [
  escena("2026-08-03",
    ["09:02", "Marta", "buen lunes. este mes vamos por tres cosas: onboarding nuevo, migrar pagos a v2, y bajar la deuda de soporte. lo demás espera"],
    ["09:05", "Lu", "dale"], ["09:06", "Jose", "ok"], ["09:07", "Nestor", "va"], ["09:09", "Caro", "👍"],
    ["11:40", "Caro", "alguien vio el ticket del login? hay 6 clientes que no pueden entrar desde ayer, me están matando"],
    ["11:41", "Lu", "lo miro ahora, dejo lo de onboarding un rato"],
    ["14:22", "Lu", "listo, ya subí el fix del timeout del login. era el pool de conexiones que se quedaba sin slots"],
    ["14:25", "Caro", "gracias lu, con eso les aviso a los 6. te debo una", 7],
    ["14:26", "Jose", "👏"]),
  escena("2026-08-05",
    ["10:10", "Diego", "mañana tengo demo con Nuevo Banco a las 9. hay algún ambiente con datos que no sean los de prueba rotos?"],
    ["10:12", "Nestor", "staging está roto desde la semana pasada"],
    ["16:48", "Lu", "listo, ya dejé andando el staging con datos de prueba coherentes para la demo de mañana. usuario demo@nb, clave la de siempre"],
    ["16:50", "Diego", "gracias lu, me salvaste la demo", 2]),
  escena("2026-08-06",
    ["15:30", "Lu", "subí la primera versión del flujo de onboarding, falta el paso de verificación de identidad. pueden probar en staging"],
    ["15:45", "Nestor", "lo vi, el paso 2 tiene el botón muy chico en mobile"],
    ["15:47", "Lu", "cierto, lo cambio"]),
  escena("2026-08-07",
    ["11:00", "Nestor", "subí el diseño nuevo del onboarding a figma, miren cuando puedan"],
    ["11:30", "Marta", "me gusta. el paso 3 lo simplificaría"]),
  escena("2026-08-10",
    ["10:15", "Jose", "no me anda el build de la extensión desde que actualicé node, tira un error de esbuild que no entiendo"],
    ["10:22", "Lu", "probá borrando node_modules y el lockfile, a mí me pasó lo mismo la semana pasada con la 22"],
    ["10:41", "Jose", "salió, gracias lu. dos horas perdidas por eso", 1],
    ["10:42", "Lu", "tranqui"]),
  escena("2026-08-11",
    ["16:03", "Marta", "cómo vamos con pagos v2? el viernes tengo reunión con finanzas"],
    ["16:10", "Lu", "armé el comparativo postgres vs dynamo para pagos v2, está en el drive. yo iría por postgres por los reportes"],
    ["16:15", "Marta", "decidimos ir con postgres entonces. lu, mandame el doc", 1],
    ["16:16", "Lu", "va"]),
  escena("2026-08-12",
    ["09:20", "Caro", "un cliente dice que le cobramos dos veces el mismo pedido. es el tercero esta semana"],
    ["12:05", "Lu", "lo miré, fue un reintento del webhook de pagos. ya devolví los cobros duplicados y agregué idempotencia para que no pase más"],
    ["12:08", "Caro", "gracias lu, les aviso a los tres", 1],
    ["12:30", "Marta", "bien"]),
  escena("2026-08-14",
    ["17:00", "Marta", "quién puede cubrir el on-call del finde?"],
    ["17:05", "Lu", "yo lo tomo"],
    ["17:06", "Marta", "gracias"]),
  escena("2026-08-17",
    ["08:45", "Lu", "el finde saltaron 2 alertas, las dos falsas por el disco lleno del server de logs. agregué rotación de logs, no va a pasar más"],
    ["08:50", "Nestor", "uf, gracias lu. yo el finde pasado lo apagué y prendí nomás", 0]),
  escena("2026-08-18",
    ["09:30", "Diego", "los de Tigo están enojados por el retraso del reporte mensual, escribieron 3 veces"],
    ["09:31", "Marta", "alguien que los llame hoy"],
    ["11:05", "Lu", "hablé con los de Tigo, les expliqué que el retraso es por la migración y quedaron tranquilos hasta el jueves. les prometí el reporte parcial mañana"],
    ["11:07", "Diego", "gracias lu, me sacaste un peso", 2],
    ["11:08", "Marta", "gracias"]),
  escena("2026-08-19",
    ["14:00", "Nestor", "alguien sabe por qué el pipeline de CI tarda 40 minutos? no puedo mergear nada"],
    ["17:20", "Lu", "era el paso de tests e2e que corría serial. lo paralelicé en 4 workers, ahora tarda 12 minutos"],
    ["17:25", "Nestor", "gracias lu, eso nos cambia el día a todos", 1],
    ["17:26", "Jose", "🙌"]),
  escena("2026-08-20",
    ["10:00", "Jose", "arreglé el bug del scroll en mobile, estaba desde junio"],
    ["10:05", "Nestor", "al fin"]),
  escena("2026-08-21",
    ["15:00", "Marta", "pagos v2, cómo vamos"],
    ["15:10", "Lu", "la migración de la tabla de transacciones ya está en staging, faltan los reportes. calculo dos semanas"],
    ["15:12", "Marta", "ok"]),
  escena("2026-08-24",
    ["11:00", "Diego", "Nuevo Banco pregunta si pueden exportar a excel. lo necesitan para el cierre"],
    ["16:30", "Lu", "hablé con ellos, les expliqué que el export sale en septiembre con pagos v2 y quedaron conformes. no hace falta hacer nada ahora"],
    ["16:35", "Diego", "perfecto, gracias"]),
  escena("2026-08-25",
    ["17:45", "Marta", "se cayó el cron de facturación, hay 40 facturas sin emitir y mañana es el vencimiento"],
    ["18:02", "Lu", "lo tomo yo"],
    ["21:38", "Lu", "arreglé el cron de facturación, era la zona horaria después del cambio de servidor. corrí las 40 a mano, ya están emitidas"],
    ["21:45", "Marta", "gracias lu, mañana hablamos", 2]),
  escena("2026-08-26",
    ["10:00", "Jose", "alguien me da una mano con el deploy de la extensión? nunca lo hice y me da miedo romper algo"],
    ["10:10", "Lu", "te paso el runbook y lo hacemos juntos a las 3"],
    ["16:20", "Jose", "listo, deployada. gracias lu por la paciencia", 1]),
  escena("2026-08-27",
    ["14:00", "Marta", "el onboarding nuevo queda para septiembre, no llegamos"],
    ["14:02", "Lu", "ok"],
    ["14:03", "Nestor", "una pena, estaba casi"]),
  escena("2026-08-28",
    ["16:30", "Lu", "mañana tengo el 1:1 con marta, si alguien necesita algo de mí que sea hoy"],
    ["16:31", "Nestor", "todo bien acá"],
    ["16:32", "Caro", "nada, gracias"]),
];

// Ruido: lo que un grupo de trabajo tiene todos los dias. No es trabajo y el agente lo tiene que descartar.
const GENTE = ["Lu", "Marta", "Nestor", "Jose", "Caro", "Diego"];
const RUIDO = {
  manana: ["buen día", "buenas", "buen día gente", "hola hola", "buenass", "buen día, hoy trabajo desde casa", "llego 10 min tarde, tráfico"],
  almuerzo: ["almuerzo?", "el de siempre?", "voy en 10", "pedimos?", "yo paso hoy", "tereré en la terraza?", "hay empanadas en la cocina"],
  corto: ["dale", "ok", "va", "👍", "jaja", "jajaja", "buenísimo", "uf", "😂", "ahí voy", "listo", "sí", "no sé", "mm", "puede ser"],
  varios: ["reunión en 5", "se cayó el wifi de la oficina?", "el aire está roto otra vez", "alguien tiene el link de la daily?", "me desconecto un rato, vuelvo a las 4",
    "alguien vio el cargador de la sala?", "quién tiene la llave del depósito?", "meme del día 😂", "miren esto https://x.com/i/status/1893", "mañana feriado? alguien sabe",
    "el café se terminó", "la impresora no anda", "quién dejó la puerta abierta", "hoy hay asado en lo de diego, anótense", "feliz cumple caro! 🎂"],
};

type MsgExport = { id: number; type: "message"; date: string; from: string; from_id: string; text: string; reply_to_message_id?: number };

function generar(): MsgExport[] {
  const lineas: (Linea & { ord: number; idx?: number; esc?: number })[] = [];
  ESCENAS.forEach((esc, ei) => esc.forEach((l, li) => lineas.push({ ...l, ord: 0, idx: li, esc: ei })));

  // Ruido por dia habil: 6 a 14 mensajes, en horario de oficina.
  const inicio = new Date("2026-08-03T00:00:00"), fin = new Date("2026-08-28T23:59:59");
  for (let d = new Date(inicio); d <= fin; d.setDate(d.getDate() + 1)) {
    if (d.getDay() === 0 || d.getDay() === 6) continue;
    const dia = d.toISOString().slice(0, 10);
    const n = entre(6, 14);
    for (let i = 0; i < n; i++) {
      const r = rnd();
      const [h, t] = r < 0.2 ? [entre(8, 9) + ":" + String(entre(10, 59)).padStart(2, "0"), pick(RUIDO.manana)]
        : r < 0.4 ? [entre(12, 13) + ":" + String(entre(0, 59)).padStart(2, "0"), pick(RUIDO.almuerzo)]
        : r < 0.75 ? [entre(9, 19) + ":" + String(entre(0, 59)).padStart(2, "0"), pick(RUIDO.corto)]
        : [entre(9, 19) + ":" + String(entre(0, 59)).padStart(2, "0"), pick(RUIDO.varios)];
      lineas.push({ d: dia, h: h.padStart(5, "0"), de: pick(GENTE), t, ord: 0 });
    }
  }

  lineas.sort((a, b) => (a.d + "T" + a.h).localeCompare(b.d + "T" + b.h) || (a.esc ?? 99) - (b.esc ?? 99) || (a.idx ?? 0) - (b.idx ?? 0));

  // Ids secuenciales y replies resueltos dentro de cada escena.
  const idDe = new Map<string, number>();
  let id = 1000;
  return lineas.map((l) => {
    id++;
    if (l.esc !== undefined) idDe.set(`${l.esc}:${l.idx}`, id);
    const m: MsgExport = { id, type: "message", date: `${l.d}T${l.h}:${String(entre(0, 59)).padStart(2, "0")}`, from: l.de, from_id: "user" + (GENTE.indexOf(l.de) + 1) * 1111, text: l.t };
    if (l.re !== undefined && l.esc !== undefined) m.reply_to_message_id = idDe.get(`${l.esc}:${l.re}`);
    return m;
  });
}

const mensajes = generar();
const exp = { name: "Equipo Producto", type: "private_supergroup", id: 2233445566, messages: mensajes };
mkdirSync("fixtures", { recursive: true });
mkdirSync("data", { recursive: true });
writeFileSync("fixtures/telegram-export-seed.json", JSON.stringify(exp, null, 1));

const { mensajes: msgs, autores } = convertir(exp as never);
writeFileSync("data/seed.jsonl", msgs.map((m) => JSON.stringify(m)).join("\n") + "\n");
console.log(`seed: ${mensajes.length} mensajes, ${new Set(msgs.map((m) => m.thread_id)).size} hilos, ${[...autores.keys()].join(", ")}`);
console.log("  fixtures/telegram-export-seed.json  (formato Telegram Desktop)");
console.log("  data/seed.jsonl                     (listo para replay)");
