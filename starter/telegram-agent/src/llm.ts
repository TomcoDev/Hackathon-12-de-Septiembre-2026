// Cliente mínimo de OpenRouter. Compatible con el formato de OpenAI.
// Docs: https://openrouter.ai/docs

export type Message = { role: "system" | "user" | "assistant"; content: string };

const URL = "https://openrouter.ai/api/v1/chat/completions";

export async function chat(messages: Message[], opts: { model?: string; temperature?: number; json?: boolean } = {}) {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error("Falta OPENROUTER_API_KEY en .env");

  const res = await fetch(URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${key}`,
      "Content-Type": "application/json",
      // Opcionales, OpenRouter los usa para atribución en su dashboard
      "HTTP-Referer": "https://github.com/TomcoDev/Hackathon-12-de-Septiembre-2026",
      "X-Title": "Terere Driven Development",
    },
    body: JSON.stringify({
      model: opts.model ?? process.env.OPENROUTER_MODEL ?? "openai/gpt-4o-mini",
      messages,
      temperature: opts.temperature ?? 0.2,
      ...(opts.json ? { response_format: { type: "json_object" } } : {}),
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenRouter ${res.status}: ${body.slice(0, 300)}`);
  }
  const data: any = await res.json();
  return String(data.choices?.[0]?.message?.content ?? "");
}
