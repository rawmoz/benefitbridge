"use client";

import { useEffect, useRef, useState } from "react";
import type { EligibilityResult, Profile } from "@/lib/eligibility";

type Msg = { role: "user" | "assistant"; content: string };
type Lang = "en" | "es";

const T = {
  en: {
    heroTitle: "Find help your family may qualify for",
    heroText: "Answer a few simple questions. We'll show you programs for food, health care and bills, what to bring, and where to go.",
    points: ["About 5 minutes", "Free and private", "English or Spanish"],
    greeting:
      "Hi! I'll help you find programs your family may qualify for. To start, what ZIP code or city do you live in?",
    example: "Try an example",
    exampleText: "I live in 90011. It's me and my 2 kids, one is 3 and one is 8. I make about $600 a week.",
    placeholder: "Type your answer…",
    send: "Send",
    results: "Programs you may qualify for",
    none: "We didn't find a likely match, but the local help below can still assist you.",
    why: "Why",
    bring: "What to bring",
    apply: "Apply",
    source: "Official source",
    checked: "checked",
    local: "Help near you",
    office: "Benefits office",
    food: "Food bank",
    utilities: "Utilities",
    helpline: "Free help line",
    legal: "Free legal help",
    restart: "Start over",
    print: "Print or save as PDF",
    disclaimer:
      "These are estimates based on official income limits, not a decision. The agency makes the final decision.",
    people: (n: number) => `${n} ${n === 1 ? "person" : "people"}`,
    perMonth: "/month",
    fpl: "of poverty line",
    cats: { food: "Food", health: "Health", utilities: "Utilities", phone: "Phone", family: "Kids & family", money: "Tax credit" },
    footer: "Estimates only. Rules from official state and federal sources, checked Nov 2026.",
  },
  es: {
    heroTitle: "Encuentre la ayuda para la que su familia puede calificar",
    heroText: "Conteste unas preguntas sencillas. Le mostramos programas de comida, salud y servicios, qué llevar y a dónde ir.",
    points: ["Unos 5 minutos", "Gratis y privado", "Inglés o español"],
    greeting:
      "¡Hola! Le ayudo a encontrar programas para su familia. Para empezar, ¿en qué código postal o ciudad vive?",
    example: "Probar un ejemplo",
    exampleText: "Vivo en Santa Ana. Somos 4 en casa, con dos niños de 2 y 10 años. Ganamos $3,200 al mes y estoy embarazada.",
    placeholder: "Escriba su respuesta…",
    send: "Enviar",
    results: "Programas para los que puede calificar",
    none: "No encontramos un programa probable, pero la ayuda local de abajo le puede apoyar.",
    why: "Por qué",
    bring: "Qué llevar",
    apply: "Solicitar",
    source: "Fuente oficial",
    checked: "revisado",
    local: "Ayuda cerca de usted",
    office: "Oficina de beneficios",
    food: "Banco de comida",
    utilities: "Servicios (luz y gas)",
    helpline: "Línea de ayuda gratis",
    legal: "Ayuda legal gratis",
    restart: "Empezar de nuevo",
    print: "Imprimir o guardar PDF",
    disclaimer:
      "Son estimaciones basadas en límites oficiales de ingreso, no una decisión. La agencia toma la decisión final.",
    people: (n: number) => `${n} ${n === 1 ? "persona" : "personas"}`,
    perMonth: "/mes",
    fpl: "del nivel de pobreza",
    cats: { food: "Comida", health: "Salud", utilities: "Servicios", phone: "Teléfono", family: "Niños y familia", money: "Crédito de impuestos" },
    footer: "Solo estimaciones. Reglas de fuentes oficiales estatales y federales, revisadas en nov. 2026.",
  },
};

const CATEGORY: Record<string, "food" | "health" | "utilities" | "phone" | "family" | "money"> = {
  calfresh: "food",
  wic: "food",
  school_meals: "food",
  head_start: "family",
  caleitc: "money",
  federal_eitc: "money",
  medi_cal: "health",
  care: "utilities",
  fera: "utilities",
  lifeline: "phone",
};

const CAT_STYLE = {
  food: "bg-amber-50 text-amber-800 ring-amber-200",
  health: "bg-sky-50 text-sky-800 ring-sky-200",
  utilities: "bg-violet-50 text-violet-800 ring-violet-200",
  phone: "bg-slate-100 text-slate-700 ring-slate-200",
  family: "bg-rose-50 text-rose-800 ring-rose-200",
  money: "bg-emerald-50 text-emerald-800 ring-emerald-200",
};

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
  const started = messages.length > 0;

  useEffect(() => {
    if (started) bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, results, loading, started]);

  function restart() {
    setMessages([]);
    setProfile(null);
    setResults(null);
    setSummary("");
    setChecked({});
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function send(text: string) {
    text = text.trim();
    if (!text || loading) return;
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
    <div className="flex min-h-dvh flex-col">
      <header className="print:hidden sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <button onClick={restart} className="flex items-center gap-2">
            <Logo />
            <span className="text-[17px] font-semibold tracking-tight text-slate-900">
              BenefitBridge <span className="font-normal text-slate-400">SoCal</span>
            </span>
          </button>
          <div className="flex rounded-lg bg-slate-100 p-0.5 text-sm font-medium">
            {(["en", "es"] as Lang[]).map((l) => (
              <button
                key={l}
                onClick={() => setLang(l)}
                disabled={started}
                className={`rounded-md px-3 py-1 transition ${
                  lang === l ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
                } disabled:cursor-not-allowed`}
              >
                {l === "en" ? "English" : "Español"}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-6">
        {!started && (
          <section className="pt-10 pb-6">
            <h1 className="text-[28px] font-semibold leading-tight tracking-tight text-slate-900 sm:text-[34px]">
              {t.heroTitle}
            </h1>
            <p className="mt-3 text-[15px] leading-relaxed text-slate-600">{t.heroText}</p>
            <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-600">
              {t.points.map((p) => (
                <li key={p} className="flex items-center gap-1.5">
                  <Check /> {p}
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className={`space-y-3 ${started ? "pt-6" : ""}`}>
          <Bubble role="assistant" text={T[lang].greeting} />
          {messages.map((m, i) => (
            <Bubble key={i} role={m.role} text={m.content} />
          ))}
          {loading && <Typing />}
          {!started && (
            <button
              onClick={() => send(t.exampleText)}
              className="ml-10 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-left text-sm text-slate-600 transition hover:border-teal-600 hover:text-teal-700"
            >
              {t.example}: “{t.exampleText}”
            </button>
          )}
        </section>

        {results && profile && (
          <section className="mt-8 space-y-4">
            <div className="rounded-2xl border border-teal-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">{t.results}</h2>
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                <Chip>{results.county.name}</Chip>
                <Chip>{t.people(profile.household_size)}</Chip>
                <Chip>
                  ${Math.round(profile.monthly_income).toLocaleString()}
                  {t.perMonth}
                </Chip>
                <Chip>
                  {results.fpl_percent}% {t.fpl}
                </Chip>
              </div>
              {summary && <p className="mt-4 whitespace-pre-line text-[15px] leading-relaxed text-slate-700">{summary}</p>}
            </div>

            {results.matches.length === 0 && <p className="text-sm text-slate-600">{t.none}</p>}

            {results.matches.map((m) => {
              const cat = CATEGORY[m.id] ?? "phone";
              return (
                <article key={m.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-base font-semibold text-slate-900">{m.name}</h3>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${CAT_STYLE[cat]}`}>
                      {t.cats[cat]}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-600">{m.summary}</p>
                  <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                    <span className="font-medium text-slate-700">{t.why}:</span> {m.reason}
                  </p>

                  <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-500">{t.bring}</p>
                  <ul className="mt-2 space-y-1.5">
                    {m.docs_needed.map((d) => {
                      const k = m.id + d;
                      return (
                        <li key={k}>
                          <label className="flex cursor-pointer items-start gap-2.5 text-sm text-slate-700">
                            <input
                              type="checkbox"
                              className="mt-0.5 size-4 shrink-0 accent-teal-700"
                              checked={!!checked[k]}
                              onChange={() => setChecked({ ...checked, [k]: !checked[k] })}
                            />
                            <span className={checked[k] ? "text-slate-400 line-through" : ""}>{d}</span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>

                  <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
                    <a
                      href={m.source_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-slate-500 underline-offset-2 hover:underline"
                    >
                      {t.source} · {t.checked} {m.last_verified}
                    </a>
                    <a
                      href={m.apply_url}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-teal-800"
                    >
                      {t.apply} →
                    </a>
                  </div>
                </article>
              );
            })}

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-base font-semibold text-slate-900">{t.local}</h3>
              <p className="text-xs text-slate-500">{results.county.name}</p>
              <dl className="mt-3 divide-y divide-slate-100 text-sm">
                <Row label={t.office} items={[results.county.benefits_office]} />
                <Row label={t.food} items={[results.county.food_bank]} />
                <Row label={t.utilities} items={results.county.utilities} />
                <Row label={t.legal} items={[results.county.legal_aid]} />
                <Row label={t.helpline} items={[results.county.helpline]} />
              </dl>
            </div>

            <p className="text-xs leading-relaxed text-slate-500">{t.disclaimer}</p>
            <div className="flex flex-wrap gap-2 print:hidden">
              <button
                onClick={() => window.print()}
                className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-teal-800"
              >
                {t.print}
              </button>
              <button
                onClick={restart}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                {t.restart}
              </button>
            </div>
          </section>
        )}
        <div ref={bottom} />
      </main>

      {!results ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="sticky bottom-0 border-t border-slate-200 bg-white/95 backdrop-blur"
        >
          <div className="mx-auto flex max-w-2xl gap-2 px-4 py-3">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t.placeholder}
              className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-base text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20"
            />
            <button
              disabled={loading || !input.trim()}
              className="rounded-xl bg-teal-700 px-5 py-2.5 font-medium text-white transition hover:bg-teal-800 disabled:opacity-40"
            >
              {t.send}
            </button>
          </div>
        </form>
      ) : (
        <footer className="mx-auto max-w-2xl px-4 pb-6 text-xs text-slate-400">{t.footer}</footer>
      )}
    </div>
  );
}

// The API requires the conversation to start with a user turn, so the greeting is folded into the first user message.
function withGreeting(history: Msg[], greeting: string): Msg[] {
  const [first, ...rest] = history;
  return [{ role: "user", content: `(You asked: "${greeting}")\n${first.content}` }, ...rest];
}

function Bubble({ role, text }: { role: "user" | "assistant"; text: string }) {
  if (role === "user")
    return (
      <div className="ml-auto max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-teal-700 px-4 py-2.5 text-[15px] text-white">
        {text}
      </div>
    );
  return (
    <div className="flex max-w-[90%] items-end gap-2">
      <Logo small />
      <div className="whitespace-pre-wrap rounded-2xl rounded-bl-md border border-slate-200 bg-white px-4 py-2.5 text-[15px] text-slate-800 shadow-sm">
        {text}
      </div>
    </div>
  );
}

function Typing() {
  return (
    <div className="flex items-end gap-2">
      <Logo small />
      <div className="flex gap-1 rounded-2xl rounded-bl-md border border-slate-200 bg-white px-4 py-3.5 shadow-sm">
        {[0, 150, 300].map((d) => (
          <span key={d} className="size-1.5 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: `${d}ms` }} />
        ))}
      </div>
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-700">{children}</span>;
}

function Row({ label, items }: { label: string; items: { name: string; url: string | null }[] }) {
  return (
    <div className="grid grid-cols-1 gap-1 py-2.5 sm:grid-cols-[150px_1fr]">
      <dt className="text-slate-500">{label}</dt>
      <dd className="space-y-1">
        {items.map((it) =>
          it.url ? (
            <a key={it.name} href={it.url} target="_blank" rel="noreferrer" className="block font-medium text-teal-800 hover:underline">
              {it.name}
            </a>
          ) : (
            <span key={it.name} className="block font-medium text-slate-800">
              {it.name}
            </span>
          ),
        )}
      </dd>
    </div>
  );
}

function Logo({ small }: { small?: boolean }) {
  const s = small ? "size-7" : "size-8";
  return (
    <span className={`${s} grid shrink-0 place-items-center rounded-lg bg-teal-700 text-white`}>
      <svg viewBox="0 0 24 24" className={small ? "size-4" : "size-5"} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M3 17h18M5 17v-4a7 7 0 0 1 14 0v4M9 17v-3M15 17v-3M12 17v-4" />
      </svg>
    </span>
  );
}

function Check() {
  return (
    <svg viewBox="0 0 20 20" className="size-4 text-teal-700" fill="currentColor">
      <path
        fillRule="evenodd"
        d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0L3.3 9.7a1 1 0 1 1 1.4-1.4l3.8 3.8 6.8-6.8a1 1 0 0 1 1.4 0Z"
        clipRule="evenodd"
      />
    </svg>
  );
}
