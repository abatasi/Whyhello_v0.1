import { and, eq, gt, ne, or, sql, type SQL } from "drizzle-orm";
import { db } from "@workspace/db";
import { contactsTable, companiesTable, contactDepartmentClassificationsTable as classifications } from "@workspace/db/schema";
import { classifyManagementLevel, managementLevelExpression } from "./contact-management-levels.js";

const TITLE_STOP_WORDS = new Set("a an and or the of at for to in with senior sr junior jr head director manager chief vp svp evp vice president global regional assistant executive founder owner partner co".split(" "));
export const normalizeProfileText = (value: string | null | undefined) =>
  (value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export function titleTokens(title: string | null | undefined): string[] {
  return [...new Set(normalizeProfileText(title).split(" ").filter(t => t.length > 1 && !TITLE_STOP_WORDS.has(t)))];
}

export class LookalikeInputError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

export async function getLookalikeReference(id: number) {
  const [reference] = await db.select({
    id: contactsTable.id, jobTitle: contactsTable.jobTitle, roleId: contactsTable.roleId,
    department: contactsTable.department, seniority: contactsTable.seniority,
    location: contactsTable.location, industry: companiesTable.industry, size: companiesTable.size,
    primaryDepartment: classifications.primaryDepartment, primaryFunction: classifications.primaryFunction,
    secondaryDepartments: classifications.secondaryDepartments, secondaryFunctions: classifications.secondaryFunctions,
  }).from(contactsTable)
    .leftJoin(companiesTable, eq(contactsTable.companyId, companiesTable.id))
    .leftJoin(classifications, eq(contactsTable.id, classifications.contactId))
    .where(eq(contactsTable.id, id)).limit(1);
  if (!reference) throw new LookalikeInputError("The reference contact no longer exists. Choose another contact.", 404);
  return reference;
}

export type LookalikeReference = Awaited<ReturnType<typeof getLookalikeReference>>;

/** Deterministic profile comparison, not an AI or buyer-relevance score. */
export function buildLookalikeRanking(reference: LookalikeReference) {
  const signals: { label: string; weight: number; match: SQL<number>; professional: boolean }[] = [];
  const exact = (column: SQL | typeof contactsTable.department | typeof contactsTable.location | typeof companiesTable.industry | typeof companiesTable.size, value: string) =>
    sql<number>`case when lower(regexp_replace(trim(coalesce(${column}, '')), '[^a-zA-Z0-9]+', ' ', 'g')) = ${normalizeProfileText(value)} then 1 else 0 end`;
  const add = (label: string, weight: number, match: SQL<number>, professional = false) =>
    signals.push({ label, weight, match, professional });
  if (reference.roleId !== null) {
    add("Role", 25, sql<number>`case when ${contactsTable.roleId} = ${reference.roleId} then 1 else 0 end`, true);
  }
  const tokens = titleTokens(reference.jobTitle);
  if (tokens.length) {
    const matches = tokens.map(t => sql`case when ${contactsTable.jobTitle} ~* ${`\\m${t}\\M`} then 1 else 0 end`);
    add("Job title", 30, sql<number>`((${sql.join(matches, sql` + `)})::float / ${tokens.length})`, true);
  }
  const functions = [...new Set([reference.primaryFunction, ...(reference.secondaryFunctions ?? [])].filter((s): s is string => !!s))];
  const departments = [...new Set([reference.primaryDepartment, ...(reference.secondaryDepartments ?? [])].filter((s): s is string => !!s))];
  const nodes = functions.length ? functions : departments;
  if (nodes.length || normalizeProfileText(reference.department)) {
    const structured = nodes.length ? sql`exists (
      select 1 from contact_department_classifications ld
      where ld.contact_id = ${contactsTable.id} and (
        ${functions.length ? sql`ld.primary_function` : sql`ld.primary_department`} in (${sql.join(nodes.map(n => sql`${n}`), sql`, `)})
        or ${functions.length ? sql`ld.secondary_functions` : sql`ld.secondary_departments`} && ARRAY[${sql.join(nodes.map(n => sql`${n}`), sql`, `)}]::text[]
      ))` : sql`false`;
    const raw = normalizeProfileText(reference.department) ? gt(exact(contactsTable.department, reference.department!), 0) : sql`false`;
    add(functions.length ? "Job function" : "Department", 20, sql<number>`case when (${structured}) or (${raw}) then 1 else 0 end`, true);
  }
  const level = classifyManagementLevel(reference.seniority, reference.jobTitle);
  if (level) add("Management level", 10, sql<number>`case when ${managementLevelExpression()} = ${level} then 1 else 0 end`, true);
  if (normalizeProfileText(reference.industry)) add("Company industry", 15, exact(companiesTable.industry, reference.industry!));
  if (normalizeProfileText(reference.size)) add("Company size", 5, exact(companiesTable.size, reference.size!));
  if (normalizeProfileText(reference.location)) add("Location", 5, exact(contactsTable.location, reference.location!));
  const professional = signals.filter(s => s.professional);
  if (!professional.length) {
    throw new LookalikeInputError("This contact needs a job title, role, department or management level before we can find useful lookalikes. Choose a more complete contact.", 422);
  }
  const total = signals.reduce((sum, s) => sum + s.weight, 0);
  const score = sql<number>`round((100.0 * (${sql.join(signals.map(s => sql`${s.weight} * ${s.match}`), sql` + `)}) / ${total})::numeric)::int`;
  const reasons = sql<string[]>`array_remove(ARRAY[${sql.join(signals.map(s => sql`case when ${s.match} > 0 then ${s.label}::text else null end`), sql`, `)}]::text[], null)`;
  const condition = and(ne(contactsTable.id, reference.id), gt(score, 0), or(...professional.map(s => gt(s.match, 0))))!;
  return { score, reasons, condition };
}
