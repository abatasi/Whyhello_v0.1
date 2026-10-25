import { inArray, sql } from "drizzle-orm";
import { contactsTable } from "@workspace/db/schema";

export const MANAGEMENT_LEVELS = [
  "Owner",
  "Founder",
  "C suite",
  "Partner",
  "Vp",
  "Head",
  "Director",
  "Manager",
  "Senior",
  "Entry",
  "Intern",
] as const;

const LEVEL_ALIASES: Record<string, (typeof MANAGEMENT_LEVELS)[number]> = {
  owner: "Owner",
  founder: "Founder",
  "c suite": "C suite",
  "c-suite": "C suite",
  csuite: "C suite",
  executive: "C suite",
  partner: "Partner",
  vp: "Vp",
  "vice president": "Vp",
  head: "Head",
  director: "Director",
  manager: "Manager",
  senior: "Senior",
  "individual contributor": "Senior",
  entry: "Entry",
  intern: "Intern",
};

type ManagementLevelRule = {
  value: (typeof MANAGEMENT_LEVELS)[number];
  storedValues: string[];
  sqlPattern: string;
  titlePattern: RegExp;
};

const MANAGEMENT_LEVEL_RULES: ManagementLevelRule[] = [
  { value: "Owner", storedValues: ["owner"], sqlPattern: "\\m(owner|proprietor)\\M", titlePattern: /\b(owner|proprietor)\b/i },
  { value: "Founder", storedValues: ["founder"], sqlPattern: "\\m(founder|co-founder|cofounder)\\M", titlePattern: /\b(founder|co-founder|cofounder)\b/i },
  { value: "C suite", storedValues: ["c-suite", "c suite", "csuite", "executive"], sqlPattern: "\\m(chief|ceo|cfo|cto|coo|cio|cmo|cro|chro|cpo|cso)\\M", titlePattern: /\b(chief|ceo|cfo|cto|coo|cio|cmo|cro|chro|cpo|cso)\b/i },
  { value: "Partner", storedValues: ["partner"], sqlPattern: "\\mpartner\\M", titlePattern: /\bpartner\b/i },
  { value: "Vp", storedValues: ["vp", "vice president"], sqlPattern: "\\m(svp|evp|vp|vice president)\\M", titlePattern: /\b(svp|evp|vp|vice president)\b/i },
  { value: "Head", storedValues: ["head"], sqlPattern: "\\mhead\\M", titlePattern: /\bhead\b/i },
  { value: "Director", storedValues: ["director"], sqlPattern: "\\mdirector\\M", titlePattern: /\bdirector\b/i },
  { value: "Manager", storedValues: ["manager"], sqlPattern: "\\mmanager\\M", titlePattern: /\bmanager\b/i },
  { value: "Intern", storedValues: ["intern"], sqlPattern: "\\mintern\\M", titlePattern: /\bintern\b/i },
  { value: "Entry", storedValues: ["entry", "entry-level"], sqlPattern: "\\m(junior|entry-level|associate)\\M", titlePattern: /\b(junior|entry-level|associate)\b/i },
  { value: "Senior", storedValues: ["senior", "individual contributor"], sqlPattern: "\\m(senior|sr|principal|staff)\\M", titlePattern: /\b(senior|sr|principal|staff)\b/i },
];

export function normalizeManagementLevel(value: string): string {
  const trimmed = value.trim();
  return LEVEL_ALIASES[trimmed.toLowerCase()] ?? trimmed;
}

export function classifyManagementLevel(seniority: string | null | undefined, jobTitle: string | null | undefined): string | null {
  const normalizedSeniority = seniority?.trim().toLowerCase() ?? "";
  const normalizedTitle = jobTitle?.trim() ?? "";
  return MANAGEMENT_LEVEL_RULES.find(rule =>
    rule.storedValues.includes(normalizedSeniority) || rule.titlePattern.test(normalizedTitle),
  )?.value ?? null;
}

/**
 * Classifies contacts from stored seniority and job title so the role filter
 * can support the same levels even when upstream data uses different labels.
 * The order is intentional: the first matching category is the primary level.
 */
export function managementLevelExpression() {
  const seniority = sql`lower(coalesce(${contactsTable.seniority}, ''))`;
  const title = contactsTable.jobTitle;
  const cases = MANAGEMENT_LEVEL_RULES.map(rule =>
    sql`when ${inArray(seniority, rule.storedValues)} or ${title} ~* ${rule.sqlPattern} then ${rule.value}`,
  );
  return sql<string>`case ${sql.join(cases, sql` `)} else null end`;
}
