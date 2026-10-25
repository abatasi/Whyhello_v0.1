import assert from "node:assert/strict";
import { test } from "node:test";
import { db, pool } from "@workspace/db";
import { contactsTable, contactDepartmentClassificationsTable as classifications } from "@workspace/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { ensureDepartmentTaxonomy, departmentFilterCondition, classifyImportedContact } from "./department-taxonomy";

test("versioned migration preserves source data; search matches primary/secondary paths and legacy values", async () => {
  try {
    const snapshot = async () => (await db.execute(sql`select count(*)::int as count, md5(string_agg(concat_ws('|', id::text, coalesce(department,''), coalesce(job_title,''), coalesce(seniority,''), coalesce(role_id::text,'')), ',' order by id)) as fingerprint from contacts`)).rows[0];
    const before = await snapshot();
    await ensureDepartmentTaxonomy();
    await ensureDepartmentTaxonomy();
    assert.deepEqual(await snapshot(), before);
    const rollback = new Error("intentional fixture rollback");
    try {
      await db.transaction(async tx => {
        const [contact] = await tx.insert(contactsTable).values({ firstName: "Taxonomy", lastName: "Fixture", department: "Sales", jobTitle: "VP, Global Enterprise Sales & Strategic Partnerships", seniority: "VP" }).returning();
        await classifyImportedContact(contact!.id, contact!, tx);
        for (const selected of [["sales"], ["sales__enterprise_sales"], ["business_development_partnerships"], ["marketing", "sales"]]) {
          const match = await tx.select({ id: contactsTable.id }).from(contactsTable).where(and(eq(contactsTable.id, contact!.id), await departmentFilterCondition(selected)));
          assert.equal(match.length, 1, selected.join(","));
        }
        assert.equal((await tx.select().from(contactsTable).where(and(eq(contactsTable.id, contact!.id), await departmentFilterCondition(["marketing"])))).length, 0);
        assert.equal((await tx.select().from(contactsTable).where(and(eq(contactsTable.id, contact!.id), await departmentFilterCondition(["sales"]), eq(contactsTable.seniority, "Director")))).length, 0);
        assert.equal((await tx.select().from(contactsTable).where(and(eq(contactsTable.id, contact!.id), await departmentFilterCondition(["Sales"])))).length, 1);
        const [classified] = await tx.select().from(classifications).where(eq(classifications.contactId, contact!.id));
        assert.equal(classified!.primaryDepartment, "sales");
        assert.equal(classified!.primaryFunction, "sales__enterprise_sales");
        assert.equal(contact!.department, "Sales");
        await classifyImportedContact(contact!.id, {
          department: "Sales", primaryFunction: "Accounting", additionalValues: ["Accounting"],
        }, tx);
        const [mismatch] = await tx.select().from(classifications).where(eq(classifications.contactId, contact!.id));
        assert.equal(mismatch!.needsReview, true);
        assert(mismatch!.rawValues.includes("Accounting"));
        throw rollback;
      });
    } catch (error) { if (error !== rollback) throw error; }
    assert.deepEqual(await snapshot(), before);
  } finally { await pool.end(); }
});
