// Detector SIN modelo. Es el plan B si la API se cae en el demo, y es lo que corre
// hasta que Jose enchufe el detector real (src/detectores/evidencia.ts).
//
// Hace lo minimo que hace al producto: encuentra trabajo terminado y se lo atribuye
// a la persona correcta, que no siempre es quien escribio el mensaje.
//
// Ojo con \b en JS: no funciona despues de una vocal acentuada ("arreglé\b" falla).
// Por eso los bordes van con lookarounds sobre el alfabeto en espanol.

import type { Evidencia, Msg, TipoEvidencia } from "../tipos.js";
import type { DetectorEvidencia, Estado } from "../pipeline.js";

const L = "a-záéíóúñü";
const ini = `(?<![${L}])`;
const fin = `(?![${L}])`;

/** "pensé", "creí", "quise": preterito que no es trabajo hecho. */
const NO_ES_HECHO = /^(pens|cre|quis|intent|trat|busqu|supon|imagin|olvid|entend|prob|mir|le|vi|fu|estuv|tuv|pud|sal|lleg|volv|ped|sab|dij)/i;

const PATRONES: { re: RegExp; tipo: TipoEvidencia; conf: number }[] = [
  { re: new RegExp(`${ini}(ya )?(sub[ií]|arregl[eé]|resolv[ií]|solucion[eé]|cerr[eé]|termin[eé]|deploy[eé]|mergi[eé]|dej[eé] andando|lo hice|qued[oó] listo|listo,? ya|corr[ií] las|emitid[oa]s|deployada|ya est[aá] en (staging|prod|main|master))${fin}`, "i"), tipo: "resolvio", conf: 0.8 },
  // Primera persona del preterito: "agregué", "devolví", "paralelicé". Generico, por eso confia menos.
  { re: new RegExp(`${ini}(?!(?:${"pens|cre|quis|intent|trat|busqu|supon|imagin|olvid|entend|prob|mir|estuv|tuv|pud|sal|lleg|volv|ped|sab|dij"})[a-z]*[éí]${fin})[a-z]{4,}[éí]${fin}`, "i"), tipo: "resolvio", conf: 0.76 },
  { re: new RegExp(`${ini}(habl[eé] con|llam[eé] a|calm[eé]|le(s)? expliqu[eé]|qued(aron|[oó]) tranquil)`, "i"), tipo: "sostuvo", conf: 0.78 },
  { re: new RegExp(`${ini}(decidimos|(?<!c[oó]mo )vamos con|queda as[ií]|cerramos con|arm[eé] el comparativo|yo ir[ií]a por)${fin}`, "i"), tipo: "decidio", conf: 0.76 },
];

/** "gracias lu", "uf, gracias @lu", "salió, gracias lu" -> evidencia sobre lu, escrita por otro. */
const GRACIAS = new RegExp(`${ini}(gracias|me salvaste|te debo una|gracias totales)${fin}[^${L}]{0,12}@?([${L}]{2,})`, "gi");

const TRES_HORAS = 3 * 60 * 60_000;

let n = 0;
const id = () => `ev_${String(++n).padStart(3, "0")}`;

export const heuristico: DetectorEvidencia = async (hilo: Msg[], estado: Estado) => {
  const out: Evidencia[] = [];

  for (let i = 0; i < hilo.length; i++) {
    const m = hilo[i];
    const dia = m.ts.slice(0, 10);

    // Un agradecimiento habla del trabajo de OTRO: se evalua antes que el trabajo propio.
    const agradece = [...m.texto.matchAll(GRACIAS)].some((g) => estado.autores.has(g[2].toLowerCase()) && g[2].toLowerCase() !== m.autor);

    // Caso 1: alguien dice que termino algo. Se anota para cualquiera: el DM filtra por persona.
    // Preguntas, negaciones y "nunca lo hice" no son trabajo hecho.
    const noEsHecho = /\?|(^|\s)no (me |lo |la |se )?(anda|funciona|sale|puedo|pude|llego)|nunca lo hice|no (lo )?hice/i.test(m.texto);
    const p = !agradece && !noEsHecho ? PATRONES.find((p) => p.re.test(m.texto)) : undefined;
    if (p && m.texto.length > 25) {
      out.push({
        id: id(), persona: m.autor, tipo: p.tipo, que: m.texto.slice(0, 140), cuando: dia,
        mensaje_id: m.id, link: m.link, cita: m.texto, confianza: p.conf, no_estaba_en_plan: false,
      });
      continue;
    }

    // Caso 2: alguien le agradece a otro. El merito lo registra un tercero.
    for (const g of m.texto.matchAll(GRACIAS)) {
      const quien = g[2].toLowerCase();
      if (quien === m.autor || !estado.autores.has(quien)) continue;
      // Lo que hizo esta en su ultimo mensaje: en el hilo, o en las 3 horas previas.
      const enHilo = hilo.slice(0, i).reverse().find((x) => x.autor === quien);
      const t = new Date(m.ts).getTime();
      const reciente = estado.ultimos
        .filter((x) => x.autor === quien && x.id !== m.id && t - new Date(x.ts).getTime() < TRES_HORAS && new Date(x.ts).getTime() <= t)
        .at(-1);
      const previo = enHilo ?? reciente;
      out.push({
        id: id(), persona: quien, tipo: "desbloqueo",
        que: previo ? `${previo.texto.slice(0, 110)} — ${m.autor} lo confirmó` : `Ayudó a ${m.autor}`,
        cuando: dia, mensaje_id: previo?.id ?? m.id, link: previo?.link ?? m.link,
        cita: m.texto, confianza: previo ? 0.82 : 0.6, no_estaba_en_plan: false,
      });
      break;
    }
  }

  // Si la persona lo dijo Y otro lo agradecio, es UNA evidencia corroborada, no dos.
  const corroboradas = out.filter((e) => e.tipo === "desbloqueo");
  return out
    .filter((e) => e.tipo === "desbloqueo" || !corroboradas.some((c) => c.mensaje_id === e.mensaje_id))
    .map((e) => (e.tipo === "desbloqueo" && out.some((o) => o !== e && o.mensaje_id === e.mensaje_id)
      ? { ...e, confianza: 0.9 }
      : e));
};
