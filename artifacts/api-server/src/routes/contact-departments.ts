import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { contactsTable, contactDepartmentClassificationsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { UpdateContactDepartmentsBody } from "@workspace/api-zod";
import { ensureDepartmentTaxonomy, getDepartmentNodes, saveContactClassification } from "../lib/department-taxonomy";
import { validateClassification } from "@workspace/department-taxonomy";

const router: IRouter = Router({ mergeParams: true });

router.get("/", async (req, res, next): Promise<void> => {
  try {
    await ensureDepartmentTaxonomy();
    const id = Number((req.params as Record<string, string>).contactId);
    if (!Number.isSafeInteger(id) || id <= 0) { res.status(400).json({ error: "Invalid contact ID" }); return; }
    const [classification] = await db.select().from(contactDepartmentClassificationsTable).where(eq(contactDepartmentClassificationsTable.contactId, id));
    if (!classification) { res.status(404).json({ error: "Contact classification not found" }); return; }
    res.json(classification);
  } catch (error) { next(error); }
});

router.put("/", async (req, res, next): Promise<void> => {
  try {
    const id = Number((req.params as Record<string, string>).contactId);
    if (!Number.isSafeInteger(id) || id <= 0) { res.status(400).json({ error: "Invalid contact ID" }); return; }
    const parsed = UpdateContactDepartmentsBody.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "Invalid classification", details: parsed.error.issues }); return; }
    await ensureDepartmentTaxonomy();
    const [contact] = await db.select().from(contactsTable).where(eq(contactsTable.id, id));
    if (!contact) { res.status(404).json({ error: "Contact not found" }); return; }
    try { validateClassification(await getDepartmentNodes(), parsed.data); }
    catch (error) { res.status(400).json({ error: error instanceof Error ? error.message : "Invalid hierarchy" }); return; }
    const [previous] = await db.select().from(contactDepartmentClassificationsTable).where(eq(contactDepartmentClassificationsTable.contactId, id));
    const classification = {
      ...parsed.data,
      rawValues: [...new Set([...(previous?.rawValues ?? []), ...parsed.data.rawValues, ...(contact.department ? [contact.department] : [])])],
    };
    await saveContactClassification(id, classification, JSON.stringify({ department: contact.department, jobTitle: contact.jobTitle }));
    res.json(classification);
  } catch (error) { next(error); }
});

export default router;
