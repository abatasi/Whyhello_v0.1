import { db } from "@workspace/db";
import { contactsTable, departmentTaxonomyTable as nodesTable, contactDepartmentClassificationsTable as classifications, departmentTaxonomyMigrationsTable as migrations, rolesTable } from "@workspace/db/schema";
import { and, eq, inArray, isNull, or, sql, arrayOverlaps, type SQL } from "drizzle-orm";
import { classifyContact, descendants, resolveAlias, validateHierarchy, validateClassification, type DepartmentNode, type DepartmentClassification } from "@workspace/department-taxonomy";
import { DEPARTMENT_SEED, DEPARTMENT_TAXONOMY_VERSION } from "@workspace/department-taxonomy/seed";

let cache: { nodes: DepartmentNode[]; until: number } | undefined;
let initialization: Promise<void> | undefined;

export async function getDepartmentNodes(): Promise<DepartmentNode[]> {
  if (cache && cache.until > Date.now()) return cache.nodes;
  const rows = await db.select().from(nodesTable).orderBy(nodesTable.sortOrder, nodesTable.id);
  const nodes = rows.map(r => ({ ...r, level: r.level as 1 | 2 | 3 }));
  validateHierarchy(nodes);
  cache = { nodes, until: Date.now() + 60_000 };
  return nodes;
}

/** Future administration/enrichment callers use the same validation, never edit seed labels to rename nodes. */
export async function saveDepartmentNode(node: DepartmentNode): Promise<void> {
  const nodes = await getDepartmentNodes();
  validateHierarchy([...nodes.filter(n => n.id !== node.id), node]);
  await db.insert(nodesTable).values(node).onConflictDoUpdate({ target: nodesTable.id, set: node });
  cache = undefined;
}

export async function saveContactClassification(contactId: number, classification: DepartmentClassification, sourceSignature: string, writer: Pick<typeof db, "insert"> = db): Promise<void> {
  validateClassification(await getDepartmentNodes(), classification);
  const row = { ...classification, contactId, sourceSignature, taxonomyVersion: DEPARTMENT_TAXONOMY_VERSION, updatedAt: new Date() };
  await writer.insert(classifications).values(row).onConflictDoUpdate({ target: classifications.contactId, set: row });
}

export async function classifyImportedContact(contactId: number, input: {
  department?: string | null; jobTitle?: string | null; additionalValues?: string[];
  primaryFunction?: string | null; primarySpecialization?: string | null;
}, writer: Pick<typeof db, "insert"> = db): Promise<void> {
  await ensureDepartmentTaxonomy();
  const nodes = await getDepartmentNodes();
  const classification = classifyContact(nodes, input);
  if (input.primaryFunction) {
    const node = resolveAlias(nodes, input.primaryFunction, classification.primaryDepartment ?? undefined);
    if (!node || node.level !== 2 || node.id !== classification.primaryFunction) classification.needsReview = true;
  }
  if (input.primarySpecialization) {
    const node = resolveAlias(nodes, input.primarySpecialization, classification.primaryDepartment ?? undefined);
    if (!node || node.level !== 3 || node.parentId !== classification.primaryFunction) classification.needsReview = true;
  }
  await saveContactClassification(contactId, classification, JSON.stringify(input), writer);
}

/** Data-only versioned seed/backfill. Schema changes belong to the normal DB migration flow. */
export function ensureDepartmentTaxonomy(): Promise<void> {
  if (initialization) return initialization;
  initialization = (async () => {
    const [applied] = await db.select().from(migrations).where(eq(migrations.version, DEPARTMENT_TAXONOMY_VERSION));
    if (!applied) {
      validateHierarchy(DEPARTMENT_SEED);
      await db.transaction(async tx => {
        // Insert parents before descendants. Existing edits and classifications are never overwritten.
        for (const level of [1, 2, 3]) {
          const rows = DEPARTMENT_SEED.filter(n => n.level === level);
          if (rows.length) await tx.insert(nodesTable).values(rows).onConflictDoNothing();
        }
        await tx.insert(migrations).values({ version: DEPARTMENT_TAXONOMY_VERSION }).onConflictDoNothing();
      });
      cache = undefined;
    }
    const nodes = await getDepartmentNodes();
    const pending = await db.select({ id: contactsTable.id, department: contactsTable.department, jobTitle: contactsTable.jobTitle })
      .from(contactsTable).leftJoin(classifications, eq(classifications.contactId, contactsTable.id))
      .where(isNull(classifications.contactId));
    for (let i = 0; i < pending.length; i += 100) {
      const rows = pending.slice(i, i + 100).map(contact => ({
        contactId: contact.id,
        ...classifyContact(nodes, contact),
        sourceSignature: JSON.stringify({ department: contact.department, jobTitle: contact.jobTitle }),
        taxonomyVersion: DEPARTMENT_TAXONOMY_VERSION,
      }));
      await db.insert(classifications).values(rows).onConflictDoNothing();
    }
  })().catch(error => { initialization = undefined; throw error; });
  return initialization;
}

/** OR within department selections; callers AND this with seniority and other dimensions. */
export async function departmentFilterCondition(selected: string[]): Promise<SQL | undefined> {
  if (!selected.length) return undefined;
  await ensureDepartmentTaxonomy();
  const nodes = await getDepartmentNodes();
  const known = selected.filter(id => nodes.some(n => n.id === id && n.isActive));
  const legacy = selected.filter(id => !known.includes(id));
  const ids = [...new Set(known.flatMap(id => descendants(nodes, id)))];
  const alternatives: SQL[] = [];
  if (ids.length) {
    alternatives.push(sql`exists (
      select 1 from ${classifications}
      where ${classifications.contactId} = ${contactsTable.id}
      and ${or(
        inArray(classifications.primaryDepartment, ids),
        inArray(classifications.primaryFunction, ids),
        inArray(classifications.primarySpecialization, ids),
        arrayOverlaps(classifications.secondaryDepartments, ids),
        arrayOverlaps(classifications.secondaryFunctions, ids),
        arrayOverlaps(classifications.secondarySpecializations, ids),
      )}
    )`);
  }
  // Preserve historical Role-based callers and unmapped saved values; never rewrite their source data.
  if (legacy.length) alternatives.push(or(
    inArray(contactsTable.roleId, db.select({ id: rolesTable.id }).from(rolesTable).where(inArray(rolesTable.name, legacy))),
    and(isNull(contactsTable.roleId), inArray(contactsTable.department, legacy)),
  )!);
  return or(...alternatives);
}
