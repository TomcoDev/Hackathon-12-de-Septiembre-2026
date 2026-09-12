// Microfono -> deteccion de habla (VAD) -> corte por frase -> servidor.
// Nadie le habla al agente: solo se deja el microfono abierto y se conversa.

const ROOM = new URLSearchParams(location.search).get("room") || "demo";
const $ = (id) => document.getElementById(id);

const SILENCIO_MS = 900;   // pausa que corta una frase
const MIN_FRASE_MS = 700;  // mas corto que esto es ruido
const MAX_FRASE_MS = 15000;// techo para no mandar blobs enormes

let stream, ctx, analyser, rec, chunks = [];
let escuchando = false, agenteHablando = false;
let huboVoz = false, tSegmento = 0, tUltimaVoz = 0, piso = 0.01;

$("speaker").value = localStorage.getItem("speaker") || "";
$("speaker").oninput = (e) => localStorage.setItem("speaker", e.target.value);

$("escuchar").onclick = () => (escuchando ? parar() : arrancar());
$("mute").onclick = () => control("mute");
$("why").onclick = () => control("why");
$("status").onclick = () => control("status");
$("reset").onclick = () => control("reset").then(pintar);

async function arrancar() {
  if (!$("speaker").value.trim()) return alert("Poné tu nombre: el detector necesita saber quién dijo qué.");

  stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
  });

  ctx = new AudioContext();
  analyser = ctx.createAnalyser();
  analyser.fftSize = 1024;
  ctx.createMediaStreamSource(stream).connect(analyser);

  nuevoSegmento();
  escuchando = true;
  $("escuchar").textContent = "Escuchando";
  $("escuchar").classList.add("on");
  vigilar();
}

function parar() {
  escuchando = false;
  try { rec && rec.state !== "inactive" && rec.stop(); } catch {}
  stream?.getTracks().forEach((t) => t.stop());
  ctx?.close();
  $("escuchar").textContent = "Escuchar";
  $("escuchar").classList.remove("on");
  $("nivelIn").style.width = "0%";
}

// MediaRecorder corre continuo y se corta en los bordes de frase: cada blob es
// un webm completo. Arrancar el recorder recien al detectar voz corta el ataque.
function nuevoSegmento() {
  chunks = [];
  huboVoz = false;
  tSegmento = Date.now();
  rec = new MediaRecorder(stream, { mimeType: "audio/webm" });
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  rec.onstop = () => {
    const blob = new Blob(chunks, { type: "audio/webm" });
    if (huboVoz && blob.size > 2000 && !agenteHablando) enviar(blob);
    if (escuchando) nuevoSegmento();
  };
  rec.start();
}

function vigilar() {
  if (!escuchando) return;

  const buf = new Uint8Array(analyser.fftSize);
  analyser.getByteTimeDomainData(buf);
  let suma = 0;
  for (const v of buf) suma += ((v - 128) / 128) ** 2;
  const rms = Math.sqrt(suma / buf.length);

  $("nivelIn").style.width = `${Math.min(100, rms * 400)}%`;

  const ahora = Date.now();
  // Piso de ruido adaptativo: sube rapido, baja lento.
  piso = rms < piso ? piso * 0.995 + rms * 0.005 : piso * 0.9995 + rms * 0.0005;
  const hablando = rms > Math.max(piso * 3, 0.012);

  if (hablando && !agenteHablando) {
    huboVoz = true;
    tUltimaVoz = ahora;
  }

  const dur = ahora - tSegmento;
  const corta = huboVoz && ahora - tUltimaVoz > SILENCIO_MS && dur > MIN_FRASE_MS;
  const largo = dur > MAX_FRASE_MS;
  // Reciclar segmentos de puro silencio para no acumular audio inutil.
  const vacio = !huboVoz && dur > 8000;

  if ((corta || largo || vacio) && rec.state === "recording") rec.stop();

  setTimeout(vigilar, 50);
}

async function enviar(blob) {
  const speaker = encodeURIComponent($("speaker").value.trim() || "?");
  try {
    const r = await fetch(`/utterance?room=${ROOM}&speaker=${speaker}`, {
      method: "POST",
      headers: { "Content-Type": "audio/webm" },
      body: blob,
    });
    const data = await r.json();
    if (data?.resultado?.tipo === "intervencion") await decir(data.resultado.intervencion.message);
    pintar();
  } catch (e) {
    console.error("enviar:", e);
  }
}

// El agente habla. Mientras suena no se manda nada: si no, se escucha a si mismo.
async function decir(texto) {
  agenteHablando = true;
  try {
    const r = await fetch("/speak", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: texto }),
    });
    if (r.ok) {
      const audio = new Audio(URL.createObjectURL(await r.blob()));
      await new Promise((res) => { audio.onended = res; audio.onerror = res; audio.play().catch(res); });
    }
  } finally {
    setTimeout(() => (agenteHablando = false), 400);
  }
}

async function control(cmd) {
  const r = await fetch("/control", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ room: ROOM, cmd }),
  });
  const d = await r.json();
  if (d.dice && cmd !== "reset") await decir(d.dice);
  if (cmd === "mute") {
    const on = $("mute").textContent === "Mute";
    $("mute").textContent = on ? "Unmute" : "Mute";
    $("mute").onclick = () => control(on ? "unmute" : "mute").then(() => location.reload());
  }
  pintar();
  return d;
}

const esc = (s) => String(s).replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]));

async function pintar() {
  const s = await (await fetch(`/state?room=${ROOM}`)).json();

  $("meta").textContent =
    `detector: ${s.detector} · umbral ${s.umbral} · ${s.muteado ? "MUTEADO" : "escuchando"} · ` +
    `${s.bitacora.filter((b) => b.tipo === "intervencion").length} intervenciones en ${s.bitacora.length} frases`;

  $("frases").className = s.frases.length ? "" : "vacio";
  $("frases").innerHTML = s.frases.length
    ? s.frases.map((f) => `<div class="frase"><b>${esc(f.speaker)}</b> ${esc(f.text)}</div>`).join("")
    : "Nadie habló todavía.";

  $("bitacora").className = s.bitacora.length ? "" : "vacio";
  $("bitacora").innerHTML = s.bitacora.length
    ? [...s.bitacora].reverse().map((b) =>
        b.tipo === "intervencion"
          ? `<div class="dec hab">habló · confianza ${b.intervencion.confidence.toFixed(2)} · ${b.ms}ms
             <div class="msg">${esc(b.intervencion.message)}</div>
             ${b.intervencion.evidence.map((e) => `<div class="ev">“${esc(e)}”</div>`).join("")}</div>`
          : `<div class="dec">se calló <span class="motivo">· ${esc(b.motivo)}</span></div>`
      ).join("")
    : "Sin decisiones.";

  $("pendientes").innerHTML = (s.pendientes || []).map((p) =>
    `<div class="pend"><div class="q">El agente quiere <b>${esc(p.name)}</b>:
     ${esc(JSON.stringify(p.params))}</div>
     <button onclick="aprobar('${p.id}',true)">Aprobar</button>
     <button onclick="aprobar('${p.id}',false)">Descartar</button></div>`
  ).join("");

  $("registro").className = (s.registro || []).length ? "" : "vacio";
  $("registro").innerHTML = (s.registro || []).length
    ? s.registro.map((r) => `<div class="hecho">${esc(r)}</div>`).join("")
    : "Ninguna.";
}

window.aprobar = async (id, ok) => {
  await fetch("/approve", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, ok }),
  });
  pintar();
};

pintar();
setInterval(pintar, 2500);
