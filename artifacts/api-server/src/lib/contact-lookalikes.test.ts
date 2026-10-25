import assert from "node:assert/strict";
import { after, test } from "node:test";
import { db, pool } from "@workspace/db";
import { sql } from "drizzle-orm";
import { buildLookalikeRanking, LookalikeInputError, titleTokens, type LookalikeReference } from "./contact-lookalikes.js";

after(() => pool.end());
const reference: LookalikeReference = {
  id: 1, roleId: 9, jobTitle: "Senior Enterprise Sales Manager", department: "Sales",
  seniority: "Manager", location: "Toronto", industry: "Software", size: "51-200",
  primaryDepartment: null, primaryFunction: null, secondaryDepartments: [], secondaryFunctions: [],
};

async function compare(overrides: Partial<LookalikeReference> = {}, seed = reference) {
  const c = { ...reference, id: 2, ...overrides };
  const ranking = buildLookalikeRanking(seed);
  const result = await db.execute(sql`
    with contact_department_classifications as (
      select ${c.id}::int as contact_id, ${c.primaryDepartment}::text as primary_department,
      ${c.primaryFunction}::text as primary_function,
      ARRAY[${sql.join((c.secondaryDepartments ?? []).map(s => sql`${s}`), sql`, `)}]::text[] as secondary_departments,
      ARRAY[${sql.join((c.secondaryFunctions ?? []).map(s => sql`${s}`), sql`, `)}]::text[] as secondary_functions
    )
    select ${ranking.score} as score, ${ranking.reasons} as reasons, ${ranking.condition} as qualifies
    from (values (${c.id}::int, ${c.roleId}::int, ${c.jobTitle}::text, ${c.department}::text, ${c.seniority}::text, ${c.location}::text))
      as contacts(id, role_id, job_title, department, seniority, location)
    cross join (values (${c.industry}::text, ${c.size}::text)) as companies(industry, size)`);
  return result.rows[0] as { score: number; reasons: string[]; qualifies: boolean };
}

test("title tokens ignore seniority and duplicate words; whole-word tokens remain", () => {
  assert.deepEqual(titleTokens("Senior VP of Enterprise Sales & Sales"), ["enterprise", "sales"]);
  assert.deepEqual(titleTokens(null), []);
});

test("complete profile matches score 100 with transparent professional and company reasons", async () => {
  const match = await compare();
  assert.equal(match.score, 100);
  assert.equal(match.qualifies, true);
  assert.deepEqual(match.reasons, ["Role", "Job title", "Department", "Management level", "Company industry", "Company size", "Location"]);
  assert.equal((await compare({ id: reference.id })).qualifies, false, "reference contact excluded");
});

test("partial matches rank below complete matches; missing values and environment-only matches do not qualify", async () => {
  const partial = await compare({ roleId: null, jobTitle: "Enterprise Account Executive", department: "Sales", seniority: "Entry", industry: "Healthcare", size: null, location: null });
  assert(partial.score > 0 && partial.score < 100);
  assert.equal(partial.qualifies, true);
  assert(partial.reasons.includes("Job title"));
  assert(!partial.reasons.includes("Company industry"));
  const environmentOnly = await compare({ roleId: null, jobTitle: "Intern Software Developer", department: null, seniority: "Intern" });
  assert(environmentOnly.score > 0);
  assert.equal(environmentOnly.qualifies, false);
  const blank = await compare({ roleId: null, jobTitle: null, department: null, seniority: null, location: null, industry: null, size: null });
  assert.equal(blank.score, 0);
  assert.equal(blank.qualifies, false);
  assert.deepEqual(blank.reasons, []);
});

test("title matching uses whole words; known reference fields alone form the denominator", async () => {
  const sparse = { ...reference, roleId: null, jobTitle: "Sales", department: null, seniority: null, industry: null, size: null, location: null };
  assert.equal((await compare({ jobTitle: "Salesforce Engineer", roleId: null, department: null, seniority: null }, sparse)).qualifies, false);
  assert.equal((await compare({ jobTitle: "Sales Representative" }, sparse)).score, 100);
  assert.throws(() => buildLookalikeRanking({ ...sparse, jobTitle: null }), LookalikeInputError);
});

test("taxonomy primary/secondary functions match independently of raw source department", async () => {
  const seed = { ...reference, department: null, primaryFunction: "sales__enterprise_sales", primaryDepartment: "sales" };
  const match = await compare({ department: null, primaryFunction: "marketing__demand_generation", secondaryFunctions: ["sales__enterprise_sales"] }, seed);
  assert(match.reasons.includes("Job function"));
  const mismatch = await compare({ department: null, primaryFunction: "marketing__demand_generation" }, seed);
  assert(!mismatch.reasons.includes("Job function"));
  assert(match.score > mismatch.score);
});
