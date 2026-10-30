import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const MODEL = "claude-opus-5-5";
const MAX_MESSAGES = 30; // caps cost per conversation
const RATE_LIMIT = 20; // requests per IP per window
const RATE_WINDOW_MS = 60 * 60 * 1000;

const SYSTEM_PROMPT = `You are BenefitBridge, a friendly assistant that helps people in Los Angeles, Orange, Riverside, and San Bernardino counties find public benefits they may qualify for.

Ask short, simple questions one at a time to learn: household size, ages of household members, monthly household income, ZIP code, housing situation, and any pregnancy, disability, or veteran status.

Do not tell the user they are eligible for any program. Eligibility is checked separately by the app. Use plain language and reply in the language the user writes in.`;

// In-memory limiter: resets on server restart, good enough for a demo.
const hits = new Map<string, { count: number; start: number }>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = hits.get(ip);
  if (!entry || now - entry.start > RATE_WINDOW_MS) {
    hits.set(ip, { count: 1, start: now });
    return false;
  }
  entry.count++;
  return entry.count > RATE_LIMIT;
}

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "local";
  if (rateLimited(ip)) {
    return Response.json({ error: "Too many requests. Try again later." }, { status: 429 });
  }

  const { messages } = (await req.json()) as { messages: Anthropic.MessageParam[] };
  if (!Array.isArray(messages) || messages.length === 0) {
    return Response.json({ error: "No messages provided." }, { status: 400 });
  }
  if (messages.length > MAX_MESSAGES) {
    return Response.json({ error: "Conversation limit reached." }, { status: 400 });
  }

  try {
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 1024,
      output_config: { effort: "low" },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      messages,
    });

    if (response.stop_reason === "refusal") {
      return Response.json({ reply: "Sorry, I can't help with that. Try rephrasing." });
    }

    const reply = response.content
      .map((block) => (block.type === "text" ? block.text : ""))
      .join("");
    return Response.json({ reply });
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) {
      return Response.json({ error: "The assistant is busy. Try again shortly." }, { status: 429 });
    }
    if (err instanceof Anthropic.APIError) {
      console.error("Claude API error:", err.status, err.message);
      return Response.json({ error: "Assistant error." }, { status: 502 });
    }
    throw err;
  }
}
