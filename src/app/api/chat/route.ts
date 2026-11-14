import { complete, type ChatMessage } from "@/lib/llm";
import { checkEligibility, parseProfile } from "@/lib/eligibility";

const MAX_MESSAGES = 30;
const RATE_LIMIT = 40; // requests per IP per hour
const hits = new Map<string, { count: number; start: number }>();

function rateLimited(ip: string) {
  const now = Date.now();
  const e = hits.get(ip);
  if (!e || now - e.start > 3_600_000) {
    hits.set(ip, { count: 1, start: now });
    return false;
  }
  return ++e.count > RATE_LIMIT;
}

const INTAKE_PROMPT = `You are BenefitBridge, a warm, patient assistant helping families in Los Angeles, Orange, Riverside and San Bernardino counties (California) find public benefits.

Your only job is to collect a short household profile. Ask ONE short, simple question at a time (6th-grade reading level). Reply in the language the user writes in (English or Spanish).

You need:
1. Where they live: ZIP code or city. Work out which county it is in. If it is outside the four counties, kindly say we only cover those four for now.
2. How many people live in the household (people who buy and cook food together).
3. Total household income per month before taxes, from all jobs and sources. If they give weekly, every-two-weeks or yearly amounts, convert to monthly yourself. "No income" means 0.
4. Ages: how many children under 5, how many under 19, how many adults 65 or older.
5. Whether anyone is pregnant.

If the user already gave some of this in their first message, don't ask again. Never say someone is or isn't eligible, and never list programs: a separate rules engine does that.

When you have everything, reply with ONE short sentence (e.g. "Thanks! Let me check which programs fit your family.") followed by the profile in exactly this format on its own line:
<profile>{"county":"los_angeles|orange|riverside|san_bernardino","zip":"90011","household_size":3,"monthly_income":2400,"children_under_5":1,"children_under_19":2,"adults_65_plus":0,"pregnant":false,"language":"en|es"}</profile>
children_under_19 includes children under 5.`;

const EXPLAIN_PROMPT = `You explain benefit screening results to a family in plain, kind language (6th-grade level).
Rules: Use ONLY the programs in the JSON. Do not add programs or change amounts. Max 110 words. No markdown headings; short sentences.
Say these are estimates and the agency makes the final decision. End with one encouraging next step (apply online first, or call 2-1-1 for help).
If there are no matches, say so gently and point them to the county office and food bank listed.`;

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (rateLimited(ip)) return Response.json({ error: "Too many requests. Try again later." }, { status: 429 });

  const body = (await req.json().catch(() => null)) as { messages?: ChatMessage[] } | null;
  const messages = (body?.messages ?? [])
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }));
  if (messages.length === 0 || messages[messages.length - 1].role !== "user")
    return Response.json({ error: "No message provided." }, { status: 400 });
  if (messages.length > MAX_MESSAGES) return Response.json({ error: "Conversation limit reached. Please start over." }, { status: 400 });

  try {
    const raw = await complete(INTAKE_PROMPT, messages, 1500);
    const m = raw.match(/<profile>([\s\S]*?)<\/profile>/);
    const reply = raw.replace(/<profile>[\s\S]*?<\/profile>/, "").trim();
    if (!m) return Response.json({ reply });

    let parsed: unknown = null;
    try {
      parsed = JSON.parse(m[1]);
    } catch {}
    const profile = parseProfile(parsed);
    if (!profile) return Response.json({ reply: reply || "Sorry, could you confirm your ZIP code, household size and monthly income?" });

    const results = checkEligibility(profile);
    const summary = await complete(
      EXPLAIN_PROMPT,
      [
        {
          role: "user",
          content: `Language: ${profile.language === "es" ? "Spanish" : "English"}\nHousehold: ${JSON.stringify(profile)}\nResults: ${JSON.stringify({
            matches: results.matches.map((x) => ({ name: x.name, reason: x.reason })),
            county: results.county.name,
            office: results.county.benefits_office.name,
            food_bank: results.county.food_bank.name,
          })}`,
        },
      ],
      1500, // leave room for models that reason before answering
    ).catch((e) => {
      console.error("explain error:", e);
      return "";
    });

    return Response.json({ reply, profile, results, summary });
  } catch (err) {
    console.error("chat error:", err);
    return Response.json({ error: "The assistant had a problem. Please try again." }, { status: 502 });
  }
}
