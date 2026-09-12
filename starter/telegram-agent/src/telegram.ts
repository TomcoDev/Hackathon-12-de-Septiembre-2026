// hackathon 12/09/2026
// Cliente mínimo de la Bot API de Telegram, con fetch y sin grammY.
//
// Existe porque las tareas de Trigger.dev corren en OTRO PROCESO: no tienen la
// instancia del bot ni el ctx de grammY. Para postear desde una tarea diferida
// hay que hablarle a la Bot API directo.

const API = "https://api.telegram.org";

function token(): string {
  const t = process.env.TELEGRAM_BOT_TOKEN;
  if (!t) throw new Error("Falta TELEGRAM_BOT_TOKEN. En Trigger.dev cloud hay que cargarlo en las variables del entorno, no alcanza con el .env local.");
  return t;
}

/** Postea en el chat. Devuelve el message_id por si hay que responder encima. */
export async function enviarMensaje(
  chatId: number,
  texto: string,
  opts: { responderA?: number } = {},
): Promise<number> {
  const res = await fetch(`${API}/bot${token()}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: texto,
      ...(opts.responderA ? { reply_to_message_id: opts.responderA } : {}),
    }),
  });

  const data: any = await res.json();
  if (!data.ok) throw new Error(`Telegram ${res.status}: ${data.description ?? "error desconocido"}`);
  return data.result.message_id as number;
}
