// Content script: corre dentro de la página. Puede leer y modificar el DOM.
// Esto es lo que hace que el agente "vea lo que no podés pegar en un chat".

function snapshot() {
  const fields = [...document.querySelectorAll("input, select, textarea")]
    .filter((el) => el.type !== "hidden" && el.type !== "password")
    .slice(0, 60)
    .map((el) => ({
      tag: el.tagName.toLowerCase(),
      type: el.type || null,
      name: el.name || null,
      id: el.id || null,
      label: labelFor(el),
      value: el.value ?? "",
      // Selector estable para poder escribir de vuelta
      selector: el.id ? `#${CSS.escape(el.id)}` : el.name ? `${el.tagName.toLowerCase()}[name="${el.name}"]` : null,
    }));

  return {
    title: document.title,
    url: location.href,
    fields,
    // TODO (durante el hackathon): agregar lo que el agente necesite ver de la página:
    //   tablas, mensajes de error visibles, estado de botones, etc.
  };
}

function labelFor(el) {
  if (el.id) {
    const l = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
    if (l) return l.textContent.trim();
  }
  const parent = el.closest("label");
  if (parent) return parent.textContent.trim().slice(0, 80);
  return el.getAttribute("placeholder") || el.getAttribute("aria-label") || null;
}

function send() {
  chrome.runtime.sendMessage({ type: "SNAPSHOT", payload: snapshot() }).catch(() => {});
}

// Mandar un snapshot al cargar y cada vez que el usuario edita algo (con debounce).
send();
let t;
document.addEventListener("input", () => { clearTimeout(t); t = setTimeout(send, 400); }, true);

// El panel puede pedir escribir en un campo. Esto es "actuar sobre el entorno".
chrome.runtime.onMessage.addListener((msg, _sender, respond) => {
  if (msg?.type === "GET_SNAPSHOT") { respond(snapshot()); return true; }
  if (msg?.type === "FILL") {
    const el = document.querySelector(msg.selector);
    if (!el) { respond({ ok: false, error: "selector no encontrado" }); return true; }
    el.focus();
    el.value = msg.value;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    el.style.outline = "2px solid #1e8449";
    setTimeout(() => (el.style.outline = ""), 1500);
    respond({ ok: true });
    return true;
  }
  return false;
});
