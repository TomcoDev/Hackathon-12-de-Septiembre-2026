// EL TESTIGO — pantalla del demo, en React sin build.
// React 18.3.1 + htm, vendorizados en public/vendor. No se usa CDN a proposito:
// si el wifi de la sede falla al cargar, la pantalla arranca igual.
//
// La version vanilla anterior queda en index.vanilla.html como respaldo.

const { useState, useEffect, useRef, useCallback } = React;
const html = htm.bind(React.createElement);

const params = new URLSearchParams(location.search);

// El entregable cita los mensajes del grupo textualmente. Si el grupo real tiene
// una key o una clave pegada, termina en camara. ?censurar=1 la tapa al mostrarla.
// No cambia lo que el agente decidio, solo lo que se ve.
const CENSURAR = params.get("censurar") === "1";
const SECRETOS = [
  /\b(sk|rk)-[A-Za-z0-9_-]{12,}/g,
  /\btr_(dev|prod|stg)_sk_[A-Za-z0-9]{8,}/g,
  /\b\d{8,10}:AA[A-Za-z0-9_-]{20,}/g,
  /\bgh[pousr]_[A-Za-z0-9]{20,}/g,
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
  /(?<=\b(clave|contraseña|password|pass|pwd)\b\s{0,2}[:=]?\s{0,2})[^\s,.;]{4,}/gi,
];
const tapar = (t) =>
  CENSURAR ? SECRETOS.reduce((x, re) => x.replace(re, "█████"), String(t ?? "")) : (t ?? "");

// Color estable por nombre y por hilo: se ve quien habla y como se agrupan.
const hue = (s) => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) % 360; return h; };
const colorAutor = (a) => `hsl(${hue(a)} 70% 72%)`;
const colorHilo = (t) => `hsl(${hue(t)} 45% 38%)`;

const fecha = (iso) => {
  const d = new Date(iso);
  return d.toLocaleDateString("es", { day: "numeric", month: "short" }) + " " + d.toTimeString().slice(0, 5);
};
const dia = (iso) => new Date(iso).toLocaleDateString("es", { day: "numeric", month: "short" });
const num = (n) => Number(n ?? 0).toLocaleString("es");

const TIPO = { resolvio: "resolvió", desbloqueo: "destrabó a alguien", decidio: "decidió", sostuvo: "sostuvo" };

const MOTIVO = [
  [/^hilo trivial/, "hilo trivial: puro «dale», «ok», stickers"],
  [/^sin marca de trabajo hecho/, "nadie dijo que terminó algo"],
  [/^el detector no vio/, "lo miró y no vio trabajo hecho"],
  [/^confianza/, (m) => "no estaba seguro (" + m.replace("confianza ", "") + ")"],
  [/^error del modelo/, (m) => "el modelo falló, siguió leyendo · " + m.slice(17)],
  [/^DM no enviado/, (m) => m],
  [/^redactor/, (m) => m],
];
const motivoHumano = (m) => {
  for (const [re, t] of MOTIVO) if (re.test(m)) return typeof t === "function" ? t(m) : t;
  return m;
};

const EMBUDO = [
  ["hilo trivial", /^hilo trivial/],
  ["nadie dijo que terminó algo", /^sin marca/],
  ["miró y no vio trabajo", /^el detector no vio/],
  ["no estaba seguro", /^confianza/],
  ["el modelo falló", /^error del modelo/],
];

const Icono = ({ id, cls = "ic" }) => html`<svg className=${cls} aria-hidden="true"><use href=${"#" + id} /></svg>`;

// /state manda bitacora.slice(-80). En un mes entero las anotaciones ocurren
// temprano y se caen de esa ventana, asi que al terminar el replay la columna
// del medio quedaba sin una sola cita. Se acumulan del lado del navegador.
const claveBit = (d) => (d.tipo === "anotado" ? "e:" + d.evidencia.id : `${d.tipo}|${d.ts}|${d.motivo}`);

function acumular(ref, recibida, leidos) {
  if (leidos < ref.leidos) { ref.lista = []; ref.claves = new Set(); }
  ref.leidos = leidos;
  for (const d of recibida) {
    const k = claveBit(d);
    if (!ref.claves.has(k)) { ref.claves.add(k); ref.lista.push(d); }
  }
  return ref.lista;
}

function Narracion({ s }) {
  const ult = s.bitacora.at(-1);
  let clase = "", titulo = "", detalle = "";

  if (!s.leidos) {
    titulo = "Esperando.";
    detalle = "Apretá «Reproducir el mes» para ver un mes del grupo pasar por el agente.";
  } else if (s.intervenciones > 0) {
    clase = "hablo";
    titulo = "Habló. Una vez. En privado.";
    detalle = `Alguien mencionó el 1:1 en el grupo. Fue lo único que lo hizo hablar en ${num(s.leidos)} mensajes.`;
  } else if (ult && ult.tipo === "anotado") {
    clase = "leyendo";
    titulo = "Anotó en silencio.";
    detalle = `${TIPO[ult.evidencia.tipo]} · «${tapar(ult.evidencia.que).slice(0, 80)}» · no dijo nada en el grupo.`;
  } else if (s.replayEnCurso && s.pausado) {
    titulo = "En pausa.";
    detalle = `Leyó ${num(s.leidos)} de ${num(s.total)} mensajes. El mes está detenido.`;
  } else if (s.replayEnCurso) {
    clase = "leyendo";
    titulo = "Leyendo el grupo. No dice nada.";
    detalle = ult ? "última decisión: se calló, " + motivoHumano(ult.motivo) : "todavía no cerró ningún hilo.";
  } else {
    titulo = "Terminó el mes sin hablar.";
    detalle = `Leyó ${num(s.leidos)} mensajes, anotó ${num(s.anotados)}. Nadie mencionó el 1:1.`;
  }

  return html`<div className=${"estado " + clase}>
    <div className="punto" /><div><b>${titulo}</b> <span>${detalle}</span></div></div>`;
}

function Grupo({ s }) {
  const cont = useRef(null);
  const pegado = useRef(true);

  useEffect(() => {
    const el = cont.current;
    // Solo arrastra el scroll si la persona ya estaba abajo.
    if (el && s.replayEnCurso && pegado.current) el.scrollTop = el.scrollHeight;
  });

  const onScroll = () => {
    const el = cont.current;
    if (el) pegado.current = el.scrollHeight - el.scrollTop - el.clientHeight < 90;
  };

  const planMsg = s.plan[0] && s.plan[0].mensaje_id;

  return html`<section className="publico" ref=${cont} onScroll=${onScroll}>
    <div className="col-head">
      <h2><${Icono} id="i-group" /> El grupo</h2>
      <p className="sub">Telegram · público · todos lo ven · el agente solo lee, nunca escribe acá</p>
    </div>
    ${!s.ultimos.length
      ? html`<div className="vacio" style=${{ padding: "16px 0" }}>Sin mensajes todavía.</div>`
      : s.ultimos.map((m) => {
          const esT = s.disparador && m.id === s.disparador.id;
          const esP = !esT && m.id === planMsg;
          return html`<div key=${m.id} className=${"msg" + (esT ? " trigger" : esP ? " plan" : "")}
              style=${{ borderLeftColor: colorHilo(m.thread_id) }}>
            <span className="quien" style=${{ color: colorAutor(m.autor) }}>${m.autor}</span>
            <span className="texto">${tapar(m.texto)}
              ${esT ? html`<span className="tag warn">esto lo despertó</span>` : null}
              ${esP ? html`<span className="tag priv">de acá sacó el plan</span>` : null}</span>
            <span className="hora">${fecha(m.ts)}</span>
          </div>`;
        })}
  </section>`;
}

function Decision({ d, abierta, onToggle }) {
  if (d.tipo === "anotado") {
    const e = d.evidencia;
    const partes = e.que.split(" — ");
    return html`<div className=${"dec anoto" + (abierta ? " abierta" : "")}>
      <div className="cab">
        <span className="tag ok">anotó</span><span>${TIPO[e.tipo] || e.tipo}</span>
        <span className="cuando">${dia(e.cuando + "T12:00:00")}</span>
      </div>
      <div className="que">«${tapar(partes[0])}»</div>
      <div className="meta">
        ${partes[1] ? partes[1] + " · " : ""}
        <span className="conf">confianza ${e.confianza.toFixed(2)}</span>
        ${e.no_estaba_en_plan ? html`<span> · <span className="fp">no estaba en el plan</span></span>` : null}
      </div>
      <details open=${abierta} onToggle=${(ev) => onToggle(e.id, ev.target.open)}>
        <summary>ver la cita que lo prueba</summary>
        <p>${tapar(e.cita)}</p>
      </details>
    </div>`;
  }

  if (d.tipo === "hablo") {
    return html`<div className="dec hablo"><div className="cab">
      <span className="tag warn">habló</span><span>${d.motivo}</span></div></div>`;
  }

  return html`<div className=${"dec" + (/^error|^DM no/.test(d.motivo) ? " err" : "")}>
    <div className="cab">
      <span className="tag gris">se calló</span><span>${motivoHumano(d.motivo)}</span>
      <span className="cuando">${dia(d.ts)}</span>
    </div></div>`;
}

function Agente({ s, filtro, setFiltro, abiertos, toggle }) {
  const desc = s.bitacora.filter((d) => d.tipo === "descartado");
  const filas = EMBUDO.map(([n, re]) => [n, desc.filter((d) => re.test(d.motivo)).length]).filter((f) => f[1]);
  const max = Math.max(1, ...filas.map((f) => f[1]), s.anotados);
  const totalDec = s.bitacora.length || 1;
  const lista = [...s.bitacora].reverse().filter((d) => filtro === "todo" || d.tipo !== "descartado");
  const pct = (c) => Math.round((c / totalDec) * 100) + "%";

  return html`<section className="agente">
    <div className="col-head">
      <h2><${Icono} id="i-chip" /> Adentro del agente</h2>
      <p className="sub">Cada decisión, incluidas las de callarse. El 80% del trabajo es descartar.</p>
    </div>

    <div className="caja plan">
      ${s.plan.length
        ? html`<${React.Fragment}>
            <h3>El plan del mes <span className="de">· lo dijo alguien en el grupo, el agente lo leyó</span></h3>
            <ul style=${{ margin: 0, paddingLeft: 18 }}>${s.plan.map((p) => html`<li key=${p.id}>${p.texto}</li>`)}</ul>
          <//>`
        : html`<${React.Fragment}>
            <h3>El plan del mes</h3>
            <span className="vacio">Todavía no apareció. Lo saca del primer mensaje que enumera objetivos.</span>
          <//>`}
    </div>

    <div className="caja embudo">
      <h3 style=${{ display: "flex" }}>Por qué se calló
        <span className="umbral">umbral ${Number(s.umbral ?? 0).toFixed(2)}</span></h3>
      ${!s.bitacora.length
        ? html`<span className="vacio">Sin hilos cerrados todavía.</span>`
        : html`<${React.Fragment}>
            ${filas.map(([n, c]) => html`<div className="fila" key=${n}>
              <span>${n}</span><b>${c}</b>
              <div className="barra" style=${{ width: (c / max) * 100 + "%" }} />
              <span className="pct">${pct(c)}</span></div>`)}
            <div className="fila ok">
              <span>anotó en silencio</span><b>${s.anotados}</b>
              <div className="barra" style=${{ width: (s.anotados / max) * 100 + "%" }} />
              <span className="pct">${pct(s.anotados)}</span></div>
          <//>`}
    </div>

    <div className="filtros">
      ${[["todo", "todas las decisiones"], ["anoto", "solo lo que anotó"]].map(([f, t]) =>
        html`<button key=${f} className=${"mini" + (filtro === f ? " on" : "")} onClick=${() => setFiltro(f)}>${t}</button>`)}
    </div>

    ${!lista.length
      ? html`<div className="vacio">${filtro === "todo" ? "Nada todavía." : "Todavía no anotó nada."}</div>`
      : lista.map((d) => html`<${Decision} key=${claveBit(d)} d=${d}
          abierta=${d.tipo === "anotado" && abiertos.has(d.evidencia.id)} onToggle=${toggle} />`)}
  </section>`;
}

function Privado({ s, borrar, compartir }) {
  const e = s.entregable;
  const cabecera = html`<div className="col-head">
    <h2><${Icono} id="i-lock" /> Mensaje privado</h2>
    <p className="sub">Solo lo ve la persona · nunca el jefe · nada sale sin que ella lo comparta</p>
  </div>`;

  if (!e) {
    return html`<section className="privado">${cabecera}
      <div className="nada">
        <div className="g"><svg width="36" height="36" fill="currentColor" aria-hidden="true"><use href="#i-mute" /></svg></div>
        <b>Todavía no habló.</b><br />
        Habla una sola vez: cuando alguien menciona el 1:1 en el grupo.<br />
        Nadie le escribe. Nadie le pide nada.
      </div></section>`;
  }

  const cita = (id) => { const x = s.evidencias.find((y) => y.id === id); return x && x.cita; };
  const d = s.disparador;

  return html`<section className="privado">${cabecera}
    ${d ? html`<div className="disparo">
      <b>Lo despertó un mensaje del grupo</b> · ${d.autor}, ${fecha(d.ts)}
      <q>${tapar(d.texto)}</q></div>` : null}

    <div className="dm">
      <div className="de"><${Icono} id="i-lock" /> EL TESTIGO → ${e.persona} · privado
        ${e.compartido ? html`<span className="listo"><${Icono} id="i-check" /> listo para compartir · no se mandó a nadie</span>` : null}
      </div>
      <p>Esto es lo que hiciste entre el ${e.periodo.replace(" a ", " y el ")}.</p>

      ${e.bullets.length
        ? e.bullets.map((x, i) => {
            const partes = x.texto.split(" — ");
            const c = cita(x.evidencia_id);
            return html`<div className="b" key=${x.evidencia_id}>
              <span className="n">${i + 1}.</span>
              <span className="t">${tapar(partes[0])}
                ${x.fuera_de_plan ? html`<span className="fp"> · no estaba en tu plan</span>` : null}</span>
              <span className="acc">
                <a href=${x.link} target="_blank" rel="noopener">ver mensaje ↗</a>
                <button className="mini" title="No fue así. Borrar." onClick=${() => borrar(x.evidencia_id)}>
                  <${Icono} id="i-x" /></button></span>
              ${c ? html`<div className="ev">evidencia: <q>${tapar(c)}</q>${partes[1] ? " · " + partes[1] : ""}</div>` : null}
            </div>`;
          })
        : html`<p className="vacio">Borraste todo. Queda vacío: es tu registro.</p>`}

      ${e.fuera_de_plan.length
        ? html`<p><b>${e.fuera_de_plan.length} de estas no estaban en tu plan.</b> Por eso no llegaste a lo otro.</p>`
        : null}

      <div className="pie">
        Leí ${num(e.leidos)} mensajes. Anoté ${num(e.anotados)}. Hablé una vez: esta.<br />
        Si algo no fue así, borralo. Nada sale de acá sin que vos lo compartas.
        ${!e.compartido
          ? html`<div className="cta">
              <button className="primary" onClick=${compartir}>Compartir</button>
              <small>hoy no manda nada a nadie: existe para que se vea que la decisión es tuya</small></div>`
          : null}
      </div>
    </div></section>`;
}

function App() {
  const [s, setS] = useState(null);
  const [caido, setCaido] = useState(false);
  const [filtro, setFiltro] = useState("todo");
  const [abiertos, setAbiertos] = useState(() => new Set());
  const [vel, setVel] = useState("80");

  const acum = useRef({ lista: [], leidos: -1, claves: new Set() });
  const firma = useRef("");
  const tickRef = useRef(null);

  // Se repinta solo si el estado cambio de verdad. React ademas reconcilia en
  // vez de reemplazar nodos, asi que una cita abierta no se cierra sola.
  const tick = useCallback(async (forzar) => {
    let j;
    try {
      j = await (await fetch("/state", { cache: "no-store" })).json();
    } catch (err) {
      setCaido(true);
      return;
    }
    setCaido(false);
    j.bitacora = acumular(acum.current, j.bitacora, j.leidos);
    const nueva = JSON.stringify([
      j.leidos, j.anotados, j.intervenciones, j.bitacora.length, j.plan.length,
      j.ultimos.at(-1) && j.ultimos.at(-1).id, j.disparador && j.disparador.id,
      j.replayEnCurso, j.pausado, j.total,
      j.entregable && j.entregable.bullets.length, j.entregable && j.entregable.compartido,
    ]);
    if (!forzar && nueva === firma.current) return;
    firma.current = nueva;
    setS(j);
  }, []);
  tickRef.current = tick;

  useEffect(() => {
    tick(true);
    const id = setInterval(() => tickRef.current(), 250);
    return () => clearInterval(id);
  }, [tick]);

  const post = (u, b) =>
    fetch(u, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b || {}) });

  const replay = () =>
    post("/replay", { ...(params.get("archivo") ? { archivo: params.get("archivo") } : {}), ms: Number(vel) })
      .then(() => tick(true));

  const reset = () =>
    post("/reset").then(() => {
      acum.current = { lista: [], leidos: -1, claves: new Set() };
      setAbiertos(new Set());
      firma.current = "";
      tick(true);
    });

  const pausar = () => post("/pausa").then(() => tick(true));
  const reanudar = () => post("/reanudar").then(() => tick(true));
  // Cancelar y limpiar son lo mismo: /reset corta el replay y deja el estado en cero.
  const cancelar = reset;

  const borrar = (id) => fetch("/entregable/" + id, { method: "DELETE" }).then(() => tick(true));
  const compartir = () => post("/entregable/compartir").then(() => tick(true));

  const toggle = useCallback((id, open) => {
    setAbiertos((prev) => { const n = new Set(prev); if (open) n.add(id); else n.delete(id); return n; });
  }, []);

  if (!s) {
    return html`<div className="cargando">${caido ? "El servidor no responde en /state." : "Conectando…"}</div>`;
  }

  return html`<${React.Fragment}>
    <header>
      <div className="brand">
        <h1>EL TESTIGO</h1>
        <p>Vive en tu grupo. No habla. Se acuerda de lo que hiciste.</p>
      </div>
      <div className="controles">
        <select id="vel" value=${vel} onChange=${(ev) => setVel(ev.target.value)}>
          <option value="15">rápido</option>
          <option value="80">ritmo de demo</option>
          <option value="350">lento, para explicar</option>
        </select>
        ${s.replayEnCurso
          ? html`<${React.Fragment}>
              ${s.pausado
                ? html`<button id="reanudar" className="primary" onClick=${reanudar}><${Icono} id="i-play" />Reanudar</button>`
                : html`<button id="pausa" onClick=${pausar}><${Icono} id="i-pause" />Pausa</button>`}
              <button id="cancelar" onClick=${cancelar}><${Icono} id="i-stop" />Cancelar</button>
            <//>`
          : html`<${React.Fragment}>
              <button id="replay" className="primary" onClick=${replay}><${Icono} id="i-play" />Reproducir el mes</button>
              <button id="reset" onClick=${reset}><${Icono} id="i-reset" />Limpiar</button>
            <//>`}
      </div>
      <div className="contador">
        <div><b id="leidos">${num(s.leidos)}</b><span>mensajes leídos</span></div>
        <div className="anoto"><b id="anotados">${num(s.anotados)}</b><span>anotó en silencio</span></div>
        <div className="hablo"><b id="hablo">${num(s.intervenciones)}</b><span>veces que habló</span></div>
      </div>
    </header>

    <div className="progreso">
      <div id="barra" style=${{ width: s.total ? (s.leidos / s.total) * 100 + "%" : "0%" }} /></div>

    ${caido
      ? html`<div className="estado"><div className="punto" /><div>
          <b>Servidor caído.</b> <span>No responde /state. Revisá la terminal de <code>npm run dev</code>.</span>
        </div></div>`
      : html`<${Narracion} s=${s} />`}

    <main>
      <${Grupo} s=${s} />
      <${Agente} s=${s} filtro=${filtro} setFiltro=${setFiltro} abiertos=${abiertos} toggle=${toggle} />
      <${Privado} s=${s} borrar=${borrar} compartir=${compartir} />
    </main>
  <//>`;
}

ReactDOM.createRoot(document.getElementById("root")).render(html`<${App} />`);
