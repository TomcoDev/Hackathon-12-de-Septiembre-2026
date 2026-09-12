// Service worker MV3. No tiene estado persistente: usar chrome.storage si hace falta guardar algo.

// Click en el ícono de la extensión abre el panel lateral.
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(console.error);

// Relay: los mensajes del content script se reenvían al panel lateral y se guardan como último snapshot.
chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg?.type === "SNAPSHOT") {
    chrome.storage.session.set({ lastSnapshot: { ...msg.payload, tabId: sender.tab?.id, url: sender.tab?.url, ts: Date.now() } });
  }
  // Devolver false: no respondemos de forma asíncrona acá.
  return false;
});
