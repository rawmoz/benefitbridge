"use client";

import { useEffect, useRef, useState } from "react";
import type { EligibilityResult, Profile } from "@/lib/eligibility";

type Msg = { role: "user" | "assistant"; content: string };
type Lang = "en" | "es";

const T = {
  en: {
    tagline: "Find help with food, health care and bills in LA, Orange County and the Inland Empire.",
    greeting:
      "Hi! I'll help you find programs your family may qualify for. It takes about 5 minutes. To start, what ZIP code or city do you live in?",
    placeholder: "Type your answer…",
    send: "Send",
    thinking: "Thinking…",
    results: "Programs you may qualify for",
    none: "We didn't find a likely match, but local help is below.",
    why: "Why",
    bring: "What to bring",
    apply: "Apply",
    source: "Official source",
    checked: "checked",
    local: "Help near you",
    office: "County benefits office",
    food: "Food bank",
    utilities: "Utilities",
    helpline: "Free help line",
    restart: "Start over",
    disclaimer:
      "These are estimates based on official income limits, not a decision. The agency makes the final decision. Rules last checked Nov 2026.",
    income: (p: Profile, pct: number) =>
      `${p.household_size} people · $${Math.round(p.monthly_income).toLocaleString()}/month · ${pct}% of the poverty line`,
  },
  es: {
    tagline: "Encuentre ayuda con comida, salud y servicios en LA, Orange County y el Inland Empire.",
    greeting:
      "¡Hola! Le ayudo a encontrar programas para su familia. Toma unos 5 minutos. Para empezar, ¿en qué código postal o ciudad vive?",
    placeholder: "Escriba su respuesta…",
    send: "Enviar",
    thinking: "Pensando…",
    results: "Programas para los que puede calificar",
    none: "No encontramos un programa probable, pero abajo hay ayuda local.",
    why: "Por qué",
    bring: "Qué llevar",
    apply: "Solicitar",
    source: "Fuente oficial",
    checked: "revisado",
    local: "Ayuda cerca de usted",
    office: "Oficina de beneficios del condado",
    food: "Banco de comida",
    utilities: "Servicios (luz y gas)",
    helpline: "Línea de ayuda gratis",
    restart: "Empezar de nuevo",
    disclaimer:
      "Son estimaciones basadas en límites oficiales de ingreso, no una decisión. La agencia toma la decisión final. Reglas revisadas en nov. 2026.",
    income: (p: Profile, pct: number) =>
      `${p.household_size} personas · $${Math.round(p.monthly_income).toLocaleString()}/mes · ${pct}% del nivel de pobreza`,
  },
};

const ICON: Record<string, string> = { calfresh: "🛒", medi_cal: "🩺", wic: "🍼", care: "💡", fera: "💡", lifeline: "📱" };

export default function Home() {
  const [lang, setLang] = useState<Lang>("en");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [results, setResults] = useState<EligibilityResult | null>(null);
  const [summary, setSummary] = useState("");
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const bottom = useRef<HTMLDivElement>(null);
  const t = T[profile?.language ?? lang];

  useEffect(() => bottom.current?.scrollIntoView({ behavior: "smooth" }), [messages, results, loading]);

  function restart() {
    setMessages([]);
    setProfile(null);
    setResults(null);
    setSummary("");
    setChecked({});
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;
    // The greeting is shown in the UI; we send it to the model so it knows what was asked.
    const history: Msg[] = [...messages, { role: "user", content: text }];
    setMessages(history);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: withGreeting(history, T[lang].greeting) }),
      });
      const data = await res.json();
      const reply = data.reply || data.error || "";
      setMessages([...history, ...(reply ? [{ role: "assistant" as const, content: reply }] : [])]);
      if (data.results) {
        setProfile(data.profile);
        setResults(data.results);
        setSummary(data.summary ?? "");
      }
    } catch {
      setMessages([...history, { role: "assistant", content: "Something went wrong. Please try again." }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col px-4 py-5">
      <header className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-emerald-800">BenefitBridge</h1>
          <p className="text-sm text-gray-600">{t.tagline}</p>
        </div>
        <div className="flex shrink-0 overflow-hidden rounded-full border border-emerald-700 text-sm">
          {(["en", "es"] as Lang[]).map((l) => (
            <button
              key={l}
              onClick={() => setLang(l)}
              disabled={messages.length > 0}
              className={`px-3 py-1 ${lang === l ? "bg-emerald-700 text-white" : "text-emerald-800"} disabled:cursor-not-allowed`}
            >
              {l === "en" ? "EN" : "ES"}
            </button>
          ))}
        </div>
      </header>

      <section className="flex-1 space-y-3">
        <Bubble role="assistant" text={T[lang].greeting} />
        {messages.map((m, i) => (
          <Bubble key={i} role={m.role} text={m.content} />
        ))}
        {loading && <p className="text-sm text-gray-500">{t.thinking}</p>}

        {results && profile && (
          <div className="space-y-4 pt-2">
            <div className="rounded-xl bg-emerald-50 p-4">
              <h2 className="text-lg font-semibold text-emerald-900">{t.results}</h2>
              <p className="text-xs text-emerald-800">
                {results.county.name} · {t.income(profile, results.fpl_percent)}
              </p>
              {summary && <p className="mt-2 whitespace-pre-wrap text-sm text-gray-800">{summary}</p>}
            </div>

            {results.matches.length === 0 && <p className="text-sm text-gray-700">{t.none}</p>}

            {results.matches.map((m) => (
              <article key={m.id} className="rounded-xl border border-gray-200 p-4 shadow-sm">
                <h3 className="text-base font-semibold">
                  {ICON[m.id]} {m.name}
                </h3>
                <p className="text-sm text-gray-700">{m.summary}</p>
                <p className="mt-1 text-xs text-gray-500">
                  <b>{t.why}:</b> {m.reason}
                </p>
                <p className="mt-3 text-sm font-medium">{t.bring}</p>
                <ul className="mt-1 space-y-1">
                  {m.docs_needed.map((d) => {
                    const k = m.id + d;
                    return (
                      <li key={k}>
                        <label className="flex cursor-pointer items-start gap-2 text-sm">
                          <input
                            type="checkbox"
                            className="mt-1 accent-emerald-700"
                            checked={!!checked[k]}
                            onChange={() => setChecked({ ...checked, [k]: !checked[k] })}
                          />
                          <span className={checked[k] ? "text-gray-400 line-through" : ""}>{d}</span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <a href={m.apply_url} target="_blank" rel="noreferrer" className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white">
                    {t.apply} →
                  </a>
                  <a href={m.source_url} target="_blank" rel="noreferrer" className="text-xs text-gray-500 underline">
                    {t.source} ({t.checked} {m.last_verified})
                  </a>
                </div>
              </article>
            ))}

            <div className="rounded-xl border border-gray-200 p-4">
              <h3 className="font-semibold">📍 {t.local}</h3>
              <Res label={t.office} name={results.county.benefits_office.name} url={results.county.benefits_office.url} />
              <Res label={t.food} name={results.county.food_bank.name} url={results.county.food_bank.url} />
              <p className="mt-2 text-xs font-medium text-gray-500">{t.utilities}</p>
              {results.county.utilities.map((u) => (
                <Res key={u.name} name={u.name} url={u.url} />
              ))}
              <Res label={t.helpline} name={results.county.helpline.name} url={results.county.helpline.url} />
            </div>

            <p className="text-xs text-gray-500">{t.disclaimer}</p>
            <button onClick={restart} className="text-sm text-emerald-800 underline">
              {t.restart}
            </button>
          </div>
        )}
        <div ref={bottom} />
      </section>

      {!results && (
        <form onSubmit={send} className="sticky bottom-0 mt-4 flex gap-2 bg-white py-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t.placeholder}
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-base"
            autoFocus
          />
          <button disabled={loading} className="rounded-lg bg-emerald-700 px-4 py-2 font-medium text-white disabled:opacity-50">
            {t.send}
          </button>
        </form>
      )}
    </main>
  );
}

// The API requires the conversation to start with a user turn, so the greeting is folded into the first user message.
function withGreeting(history: Msg[], greeting: string): Msg[] {
  const [first, ...rest] = history;
  return [{ role: "user", content: `(You asked: "${greeting}")\n${first.content}` }, ...rest];
}

function Bubble({ role, text }: { role: "user" | "assistant"; text: string }) {
  return (
    <div
      className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2 ${
        role === "user" ? "ml-auto bg-emerald-700 text-white" : "bg-gray-100 text-gray-900"
      }`}
    >
      {text}
    </div>
  );
}

function Res({ label, name, url }: { label?: string; name: string; url: string | null }) {
  return (
    <p className="mt-1 text-sm">
      {label && <span className="text-gray-500">{label}: </span>}
      {url ? (
        <a href={url} target="_blank" rel="noreferrer" className="text-emerald-800 underline">
          {name}
        </a>
      ) : (
        name
      )}
    </p>
  );
}
