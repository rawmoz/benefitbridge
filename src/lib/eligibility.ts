// Deterministic rules engine. The AI never decides eligibility; this file does.
import fpl from "../../data/fpl.json";
import programsData from "../../data/programs.json";
import countiesData from "../../data/counties.json";

export type Lang = "en" | "es";
export type CountyId = "los_angeles" | "orange" | "riverside" | "san_bernardino";

export type Profile = {
  county: CountyId;
  zip?: string;
  household_size: number;
  monthly_income: number; // gross, whole household
  children_under_5: number;
  children_under_19: number;
  adults_65_plus: number;
  pregnant: boolean;
  language: Lang;
};

type Rule =
  | { type: "income_pct_fpl"; pct: number }
  | { type: "income_pct_fpl_annual"; pct: number; min_household?: number }
  | { type: "income_band_pct_fpl_annual"; above_pct: number; max_pct: number; min_household?: number }
  | { type: "medi_cal"; adult_pct: number; child_pct: number; pregnant_pct: number }
  | { type: "wic"; pct: number }
  | { type: "follows_programs"; programs: string[] }
  | { type: "school_age_children" }
  | { type: "head_start"; pct: number; via_programs: string[] }
  | { type: "work_income_annual"; max: number; tax_year: number }
  | { type: "eitc"; tax_year: number; limits_by_children: number[] };

type Program = (typeof programsData.programs)[number] & { rule: Rule };

export type Match = {
  id: string;
  name: string;
  summary: string;
  reason: string;
  docs_needed: string[];
  apply_url: string;
  source_url: string;
  last_verified: string;
};

export const COUNTY_IDS: CountyId[] = ["los_angeles", "orange", "riverside", "san_bernardino"];

/** Annual poverty guideline for a household size. */
export function fplAnnual(size: number): number {
  return fpl.first_person + fpl.each_additional_person * (Math.max(1, size) - 1);
}

const money = (n: number) => "$" + Math.round(n).toLocaleString("en-US");
const pctOf = (p: Profile) => (p.monthly_income * 12 * 100) / fplAnnual(p.household_size);

function check(rule: Rule, p: Profile, matched: Set<string>, lang: Lang): string | null {
  const es = lang === "es";
  const monthlyLimit = (pct: number, size = p.household_size) => (fplAnnual(size) * pct) / 100 / 12;
  switch (rule.type) {
    case "income_pct_fpl": {
      const limit = monthlyLimit(rule.pct);
      if (p.monthly_income > limit) return null;
      return es
        ? `Ingreso mensual ${money(p.monthly_income)} ≤ límite ${money(limit)} para ${p.household_size} persona(s).`
        : `Monthly income ${money(p.monthly_income)} is under the ${money(limit)} limit for ${p.household_size}.`;
    }
    case "income_pct_fpl_annual": {
      const size = Math.max(p.household_size, rule.min_household ?? 1);
      const limit = (fplAnnual(size) * rule.pct) / 100;
      if (p.monthly_income * 12 > limit) return null;
      return es
        ? `Ingreso anual ${money(p.monthly_income * 12)} ≤ límite ${money(limit)}.`
        : `Yearly income ${money(p.monthly_income * 12)} is under the ${money(limit)} limit.`;
    }
    case "income_band_pct_fpl_annual": {
      const size = Math.max(p.household_size, rule.min_household ?? 1);
      const low = (fplAnnual(size) * rule.above_pct) / 100;
      const high = (fplAnnual(size) * rule.max_pct) / 100;
      const annual = p.monthly_income * 12;
      if (annual <= low || annual > high) return null;
      return es
        ? `Ingreso anual ${money(annual)} entre ${money(low)} y ${money(high)}.`
        : `Yearly income ${money(annual)} is between ${money(low)} and ${money(high)}.`;
    }
    case "medi_cal": {
      const pct = pctOf(p);
      const who: string[] = [];
      if (pct <= rule.adult_pct) who.push(es ? "adultos" : "adults");
      if (p.children_under_19 > 0 && pct <= rule.child_pct) who.push(es ? "niños menores de 19" : "children under 19");
      if (p.pregnant && pct <= rule.pregnant_pct) who.push(es ? "la persona embarazada" : "the pregnant person");
      if (who.length === 0) return null;
      return es
        ? `Según el ingreso del hogar, pueden calificar: ${who.join(", ")}.`
        : `Based on household income, these members may qualify: ${who.join(", ")}.`;
    }
    case "wic": {
      if (!p.pregnant && p.children_under_5 === 0) return null;
      const viaProgram = matched.has("calfresh") || matched.has("medi_cal");
      const limit = monthlyLimit(rule.pct);
      if (!viaProgram && p.monthly_income > limit) return null;
      return es
        ? `Hay ${p.pregnant ? "un embarazo" : "niños menores de 5"} y el ingreso está dentro del límite (${money(limit)}/mes) o califica por Medi-Cal/CalFresh.`
        : `There is ${p.pregnant ? "a pregnancy" : "a child under 5"} and income is within the ${money(limit)}/month limit or qualifies through Medi-Cal/CalFresh.`;
    }
    case "follows_programs": {
      const via = rule.programs.filter((id) => matched.has(id));
      if (via.length === 0) return null;
      return es
        ? "Puede calificar automáticamente al estar inscrito en CalFresh o Medi-Cal."
        : "You can qualify automatically once enrolled in CalFresh or Medi-Cal.";
    }
    case "school_age_children": {
      const kids = p.children_under_19 - p.children_under_5;
      if (kids <= 0) return null;
      return es
        ? `Hay ${kids} niño(s) en edad escolar. En California, todo estudiante de escuela pública recibe desayuno y almuerzo gratis.`
        : `You have ${kids} school-age child(ren). In California every public school student gets free breakfast and lunch.`;
    }
    case "head_start": {
      if (p.children_under_5 === 0) return null;
      const limit = monthlyLimit(rule.pct);
      const viaProgram = rule.via_programs.some((id) => matched.has(id));
      if (!viaProgram && p.monthly_income > limit) return null;
      return es
        ? `Hay niños menores de 5 y el ingreso está bajo la línea de pobreza (${money(limit)}/mes) o califica por CalFresh.`
        : `You have a child under 5 and income is under the poverty line (${money(limit)}/month) or qualifies through CalFresh.`;
    }
    case "work_income_annual": {
      const annual = p.monthly_income * 12;
      if (annual <= 0 || annual > rule.max) return null;
      return es
        ? `Si este ingreso es de trabajo, ${money(annual)} al año está bajo el límite de ${money(rule.max)} (año fiscal ${rule.tax_year}).`
        : `If this income is from work, ${money(annual)} a year is under the ${money(rule.max)} limit (tax year ${rule.tax_year}).`;
    }
    case "eitc": {
      const annual = p.monthly_income * 12;
      const kids = Math.min(p.children_under_19, rule.limits_by_children.length - 1);
      const limit = rule.limits_by_children[kids];
      if (annual <= 0 || annual > limit) return null;
      return es
        ? `Si este ingreso es de trabajo, ${money(annual)} al año está bajo el límite de ${money(limit)} con ${kids} niño(s) (año fiscal ${rule.tax_year}; parejas casadas tienen un límite más alto).`
        : `If this income is from work, ${money(annual)} a year is under the ${money(limit)} limit with ${kids} child(ren) (tax year ${rule.tax_year}; married couples have a higher limit).`;
    }
  }
}

export function checkEligibility(p: Profile) {
  const lang = p.language;
  const matched = new Set<string>();
  const matches: Match[] = [];
  // Programs are ordered so that "follows_programs" rules come after the programs they depend on.
  for (const prog of programsData.programs as Program[]) {
    const reason = check(prog.rule, p, matched, lang);
    if (!reason) continue;
    matched.add(prog.id);
    matches.push({
      id: prog.id,
      name: prog.name[lang],
      summary: prog.summary[lang],
      reason,
      docs_needed: prog.docs_needed[lang],
      apply_url: prog.apply_url,
      source_url: prog.source_url,
      last_verified: prog.last_verified,
    });
  }
  const county = countiesData.counties[p.county];
  return {
    matches,
    county,
    fpl_percent: Math.round(pctOf(p)),
    fpl_year: fpl.year,
  };
}

export type EligibilityResult = ReturnType<typeof checkEligibility>;

/** Validate and normalize a profile coming from the model. Returns null if unusable. */
export function parseProfile(raw: unknown): Profile | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const num = (v: unknown, d = 0) => (typeof v === "number" && isFinite(v) && v >= 0 ? v : typeof v === "string" && v.trim() !== "" && !isNaN(+v) ? +v : d);
  const county = r.county as CountyId;
  const size = Math.round(num(r.household_size));
  if (!COUNTY_IDS.includes(county) || size < 1 || size > 20) return null;
  if (r.monthly_income === undefined || r.monthly_income === null) return null;
  return {
    county,
    zip: typeof r.zip === "string" ? r.zip : undefined,
    household_size: size,
    monthly_income: num(r.monthly_income),
    children_under_5: Math.round(num(r.children_under_5)),
    children_under_19: Math.max(Math.round(num(r.children_under_19)), Math.round(num(r.children_under_5))),
    adults_65_plus: Math.round(num(r.adults_65_plus)),
    pregnant: r.pregnant === true || r.pregnant === "true",
    language: r.language === "es" ? "es" : "en",
  };
}
