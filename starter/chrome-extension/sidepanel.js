// Panel lateral. Habla con el content script de la pestaña activa y con el backend.

const $ = (id) => document.getElementById(id);
let snap = null;

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function refresh() {
  const tab = await activeTab();
  if (!tab?.id) return;
  try {
    snap = await chrome.tabs.sendMessage(tab.id, { type: "GET_SNAPSHOT" });
  } catch {
    $("where").textContent = "Esta pestaña no tiene content script (recargala).";
    return;
  }
  render();
}

function render() {
  if (!snap) return;
  $("where").textContent = `${snap.title} · ${snap.fields.length} campos`;
  $("raw").textContent = JSON.stringify(snap, null, 2);
  $("fields").innerHTML = snap.fields
    .map((f, i) => `<div class="field"><b>${f.label || f.name || f.id || f.tag}</b> ${escapeHtml(f.value)}</div>`)
    .join("");
}

async function run() {
  if (!snap) await refresh();
  if (!snap) return;
  $("out").hidden = false;
  $("out").textContent = "Pensando...";
  try {
    const res = await fetch(`${$("backend").value}/agent`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        // TODO (durante el hackathon): el system prompt real del agente y el formato de acción.
        system: "Recibís el snapshot de un formulario. Respondé en JSON {\"action\":\"none\"|\"fill\", \"selector\":string|null, \"value\":string|null, \"reason\":string}.",
        input: JSON.stringify(snap),
      }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    $("out").textContent = data.output;

    // Si el modelo pide escribir en un campo, lo hacemos. Esto es la parte "actúa sobre el entorno".
    // TODO (durante el hackathon): pedir confirmación al usuario antes de escribir (criterio 4: control).
    try {
      const action = JSON.parse(data.output);
      if (action.action === "fill" && action.selector) {
        const tab = await activeTab();
        const r = await chrome.tabs.sendMessage(tab.id, { type: "FILL", selector: action.selector, value: action.value });
        $("out").textContent += `\n\n→ campo ${r.ok ? "actualizado" : "no encontrado"}`;
      }
    } catch { /* la salida no era JSON, se muestra tal cual */ }
  } catch (e) {
    $("out").textContent = "Error: " + e.message;
  }
}

function escapeHtml(s) { return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }

$("refresh").onclick = refresh;
$("run").onclick = run;

// Actualizar solo cuando el content script manda un snapshot nuevo (el usuario editó algo).
chrome.storage.session.onChanged.addListener((changes) => {
  if (changes.lastSnapshot) { snap = changes.lastSnapshot.newValue; render(); }
});

refresh();
