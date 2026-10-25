import assert from "node:assert/strict";
import { after, test } from "node:test";
import { db, pool } from "@workspace/db";
import { sql } from "drizzle-orm";
import { contactTextSearchCondition } from "./contact-text-search.js";

after(() => pool.end());
async function matches(query: string, professional = true, first = "Alain", last = "Kamel") {
  const condition = contactTextSearchCondition(query, professional);
  const result = await db.execute(sql`select ${condition ?? sql`true`} as matches
    from (values (${first}::text, ${last}::text, 'alain.kamel@example.com', 'Investment Advisor'))
      as contacts(first_name, last_name, email, job_title)
    cross join (values ('Example Wealth')) as companies(name)`);
  return result.rows[0]?.matches;
}

test("partial first, last and full names match throughout typing", async () => {
  for (const query of ["Ala", "Alain", "Alain ", "Alain K", "Alain Ka", "Alain Kamel", "Kamel", "aLaIn k"]) {
    assert.equal(await matches(query), true, query);
    assert.equal(await matches(query, false), true, `recipient: ${query}`);
  }
  assert.equal(await matches("Alain Z"), false);
});

test("extra input and stored whitespace are normalized, including compound names", async () => {
  assert.equal(await matches("  Alain   K  "), true);
  assert.equal(await matches("Alain K", true, " Alain ", " Kamel "), true);
  assert.equal(await matches("Mary Jane Van D", true, "Mary Jane", "Van Dyke"), true);
  assert.equal(await matches("Anne-Marie O'N", true, "Anne-Marie", "O'Neill"), true);
});

test("email, title and company search remain supported, with recipient scope preserved", async () => {
  assert.equal(await matches("alain.kamel@example.com"), true);
  assert.equal(await matches("Investment Advisor"), true);
  assert.equal(await matches("Example Wealth"), true);
  assert.equal(await matches("alain.kamel@example.com", false), true);
  assert.equal(await matches("Investment Advisor", false), false);
  assert.equal(await matches("Example Wealth", false), false);
});

test("search patterns are literal and blank input adds no restriction", async () => {
  assert.equal(await matches("%"), false);
  assert.equal(await matches("_"), false);
  assert.equal(await matches("Alain%K"), false);
  assert.equal(contactTextSearchCondition(" \t "), undefined);
  assert.equal(contactTextSearchCondition(undefined), undefined);
});
