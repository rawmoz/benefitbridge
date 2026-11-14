// One small function so the app can run on Claude (Anthropic) or on Vultr Serverless Inference
// (OpenAI-compatible). Pick with LLM_PROVIDER=anthropic|vultr.
import Anthropic from "@anthropic-ai/sdk";

export type ChatMessage = { role: "user" | "assistant"; content: string };

const provider = process.env.LLM_PROVIDER ?? (process.env.ANTHROPIC_API_KEY ? "anthropic" : "vultr");

let anthropic: Anthropic | null = null;

export async function complete(system: string, messages: ChatMessage[], maxTokens = 700): Promise<string> {
  if (provider === "anthropic") {
    anthropic ??= new Anthropic();
    const res = await anthropic.messages.create({
      model: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5-5",
      max_tokens: maxTokens,
      system,
      messages,
    });
    return res.content.map((b) => (b.type === "text" ? b.text : "")).join("");
  }

  const base = process.env.VULTR_INFERENCE_BASE_URL ?? "https://api.vultrinference.com/v1";
  const key = process.env.VULTR_INFERENCE_API_KEY;
  const model = process.env.VULTR_INFERENCE_MODEL;
  if (!key || !model) throw new Error("Set VULTR_INFERENCE_API_KEY and VULTR_INFERENCE_MODEL (or ANTHROPIC_API_KEY).");
  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      temperature: 0.3,
      messages: [{ role: "system", content: system }, ...messages],
    }),
  });
  if (!res.ok) throw new Error(`Inference error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const text: string = data.choices?.[0]?.message?.content ?? "";
  return text.replace(/<think>[\s\S]*?<\/think>/g, "").trim(); // some models inline their reasoning
}
