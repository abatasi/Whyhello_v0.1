import assert from "node:assert/strict";
import { after, test } from "node:test";
import { db, pool } from "@workspace/db";
import { contactsTable, companiesTable } from "@workspace/db/schema";
import { and, sql } from "drizzle-orm";
import { searchLocations, locationFilterCondition } from "./location-filters.js";

after(() => pool.end());
function option(query: string, label: string) {
  const result = searchLocations(query).find(p => p.label === label);
  assert(result, `Missing ${label}`);
  return result.value;
}
const canada = () => option("Canada", "Canada");
const toronto = () => option("Toronto Ontario Canada", "Toronto, Ontario, Canada");
const california = () => option("California", "California, United States");

test("library provides cities, states and countries with stable comma-safe values", () => {
  for (const [q, label, kind] of [
    ["Canada", "Canada", "country"],
    ["California", "California, United States", "state"],
    ["Toronto Ontario Canada", "Toronto, Ontario, Canada", "city"],
  ]) {
    const match = searchLocations(q).find(p => p.label === label);
    assert(match);
    assert.equal(match.kind, kind);
    assert(!match.value.includes(","));
    assert.equal(option(q, label), match.value);
  }
  assert.deepEqual(searchLocations(""), []);
  assert.deepEqual(searchLocations("   "), []);
  assert(searchLocations("a").length <= 60);
});

test("library supports qualified city search, diacritics and common country aliases", () => {
  assert(searchLocations("Montreal Quebec").some(p => p.label === "Montréal, Quebec, Canada"));
  assert.equal(searchLocations("UK")[0]?.label, "United Kingdom");
  assert.equal(searchLocations("USA")[0]?.label, "United States");
  assert(searchLocations("NYC").some(p => p.label === "New York City, New York, United States"));
  assert.equal(searchLocations("there-is-no-such-place-12345").length, 0);
});

async function contactMatches(location: string | null, country: string | null, includes: string[], excludes: string[] = []) {
  const condition = locationFilterCondition(contactsTable.location, contactsTable.country, includes, excludes);
  const result = await db.execute(sql`select ${condition ?? sql`true`} as matches from (values (${location}::text, ${country}::text)) as contacts(location, country)`);
  return result.rows[0]?.matches;
}

test("contact inclusion supports country/state/city and aliases without wildcard or country-code false positives", async () => {
  assert.equal(await contactMatches("Toronto, ON", "Canada", [canada()]), true);
  assert.equal(await contactMatches("Toronto, ON", "CA", [toronto()]), true);
  assert.equal(await contactMatches("Toronto, OH", "United States", [toronto()]), false);
  assert.equal(await contactMatches("San Francisco, CA", "US", [california()]), true);
  assert.equal(await contactMatches("San Francisco, CA", "US", [canada()]), false);
  assert.equal(await contactMatches("San Francisco, CA", null, [canada()]), false);
  assert.equal(await contactMatches("London, UK", null, [option("UK", "United Kingdom")]), true);
  assert.equal(await contactMatches("Montreal, QC", "Canada", [option("Montreal Quebec", "Montréal, Quebec, Canada")]), true);
  assert.equal(await contactMatches("New York, NY", "USA", [option("NYC", "New York City, New York, United States")]), true);
  assert.equal(await contactMatches("New York, NY", "U.S.A.", [option("USA", "United States")]), true);
  assert.equal(await contactMatches("Toronto", "Canada", ["%"]), false);
  assert.equal(await contactMatches("Toronto", "Canada", ["geo:country:nonexistent::"]), false);
});

test("includes use OR, exclusions override includes, and unknowns survive exclusion-only filtering", async () => {
  assert.equal(await contactMatches("Toronto, ON", "Canada", [canada(), california()]), true);
  assert.equal(await contactMatches("Toronto, ON", "Canada", [canada()], [toronto()]), false);
  assert.equal(await contactMatches("Vancouver, BC", "Canada", [canada()], [toronto()]), true);
  assert.equal(await contactMatches(null, null, [], [canada()]), true);
  assert.equal(await contactMatches(null, null, [canada()]), false);
  assert.equal(await contactMatches("Toronto, ON", "Canada", ["Toronto"]), true);
});

test("contact and company HQ dimensions use independent fields and combine with AND", async () => {
  const contact = locationFilterCondition(contactsTable.location, contactsTable.country, [canada()], []);
  const hq = locationFilterCondition(companiesTable.location, companiesTable.country, [california()], []);
  const evaluate = async (hqCountry: string) => {
    const result = await db.execute(sql`select ${and(contact, hq)} as matches
      from (values ('Toronto, ON', 'Canada')) as contacts(location, country)
      cross join (values ('San Francisco, CA', ${hqCountry}::text)) as companies(location, country)`);
    return result.rows[0]?.matches;
  };
  assert.equal(await evaluate("United States"), true);
  assert.equal(await evaluate("Canada"), false);
  const excludedHq = locationFilterCondition(companiesTable.location, companiesTable.country, [], [california()]);
  const result = await db.execute(sql`select ${and(contact, excludedHq)} as matches
    from (values ('Toronto, ON', 'Canada')) as contacts(location, country)
    cross join (values ('San Francisco, CA', 'US')) as companies(location, country)`);
  assert.equal(result.rows[0]?.matches, false);
});
