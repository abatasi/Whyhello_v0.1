import { Router, type IRouter, type Request } from "express";
import { db } from "@workspace/db";
import {
  listsTable, listContactsTable, listCompaniesTable,
  contactsTable, companiesTable,
} from "@workspace/db/schema";
import { eq, sql, and, or, isNull } from "drizzle-orm";

const router: IRouter = Router();

function userId(req: Request): string | null {
  return req.dbUser?.id ?? null;
}

// GET /lists — lists owned by the current user (includes legacy NULL-owner lists)
router.get("/", async (req, res) => {
  try {
    const uid = userId(req);
    const rows = await db
      .select({
        id: listsTable.id,
        name: listsTable.name,
        type: listsTable.type,
        createdAt: listsTable.createdAt,
        memberCount: sql<number>`(
          CASE WHEN ${listsTable.type} = 'contacts'
            THEN (SELECT count(*)::int FROM list_contacts WHERE list_id = ${listsTable.id})
            ELSE (SELECT count(*)::int FROM list_companies WHERE list_id = ${listsTable.id})
          END
        )`,
      })
      .from(listsTable)
      .where(or(eq(listsTable.userId, uid!), isNull(listsTable.userId)))
      .orderBy(listsTable.createdAt);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch lists" });
  }
});

// POST /lists — create a list for the current user
router.post("/", async (req, res) => {
  try {
    const uid = userId(req);
    const { name, type } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: "Name is required" });
    if (type !== "contacts" && type !== "companies") return res.status(400).json({ error: "Type must be contacts or companies" });
    const [row] = await db.insert(listsTable).values({ userId: uid!, name: name.trim(), type }).returning();
    res.status(201).json({ ...row, memberCount: 0 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create list" });
  }
});

// DELETE /lists/:id — delete a list (ownership enforced)
router.delete("/:id", async (req, res) => {
  try {
    const uid = userId(req);
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    const [deleted] = await db.delete(listsTable)
      .where(and(eq(listsTable.id, id), eq(listsTable.userId, uid!)))
      .returning();
    if (!deleted) return res.status(404).json({ error: "Not found" });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete list" });
  }
});

// GET /lists/:id — list detail (ownership or legacy NULL)
router.get("/:id", async (req, res) => {
  try {
    const uid = userId(req);
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    const [list] = await db
      .select({
        id: listsTable.id,
        name: listsTable.name,
        type: listsTable.type,
        createdAt: listsTable.createdAt,
        memberCount: sql<number>`(
          CASE WHEN ${listsTable.type} = 'contacts'
            THEN (SELECT count(*)::int FROM list_contacts WHERE list_id = ${listsTable.id})
            ELSE (SELECT count(*)::int FROM list_companies WHERE list_id = ${listsTable.id})
          END
        )`,
      })
      .from(listsTable)
      .where(and(
        eq(listsTable.id, id),
        or(eq(listsTable.userId, uid!), isNull(listsTable.userId)),
      ));
    if (!list) return res.status(404).json({ error: "Not found" });
    res.json(list);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch list" });
  }
});

// GET /lists/:id/members — paginated members (ownership enforced via list lookup)
router.get("/:id/members", async (req, res) => {
  try {
    const uid = userId(req);
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    const raw = req.query as Record<string, string>;
    const page = Math.max(1, parseInt(raw.page ?? "1") || 1);
    const limit = Math.min(100, Math.max(1, parseInt(raw.limit ?? "20") || 20));
    const offset = (page - 1) * limit;

    const [list] = await db.select().from(listsTable)
      .where(and(
        eq(listsTable.id, id),
        or(eq(listsTable.userId, uid!), isNull(listsTable.userId)),
      ));
    if (!list) return res.status(404).json({ error: "Not found" });

    if (list.type === "contacts") {
      const [members, [{ count }]] = await Promise.all([
        db
          .select({
            id: contactsTable.id,
            firstName: contactsTable.firstName,
            lastName: contactsTable.lastName,
            jobTitle: contactsTable.jobTitle,
            department: contactsTable.department,
            seniority: contactsTable.seniority,
            location: contactsTable.location,
            companyId: contactsTable.companyId,
            companyName: companiesTable.name,
            email: contactsTable.email,
            insightCount: sql<number>`(SELECT count(*)::int FROM contact_insights WHERE contact_id = ${contactsTable.id})`,
          })
          .from(listContactsTable)
          .innerJoin(contactsTable, eq(listContactsTable.contactId, contactsTable.id))
          .leftJoin(companiesTable, eq(contactsTable.companyId, companiesTable.id))
          .where(eq(listContactsTable.listId, id))
          .orderBy(contactsTable.firstName, contactsTable.lastName)
          .limit(limit)
          .offset(offset),
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(listContactsTable)
          .where(eq(listContactsTable.listId, id)),
      ]);
      const totalPages = Math.max(1, Math.ceil(count / limit));
      return res.json({ data: members, total: count, page, limit, totalPages });
    } else {
      const [members, [{ count }]] = await Promise.all([
        db
          .select({
            id: companiesTable.id,
            name: companiesTable.name,
            industry: companiesTable.industry,
            size: companiesTable.size,
            location: companiesTable.location,
            website: companiesTable.website,
          })
          .from(listCompaniesTable)
          .innerJoin(companiesTable, eq(listCompaniesTable.companyId, companiesTable.id))
          .where(eq(listCompaniesTable.listId, id))
          .orderBy(companiesTable.name)
          .limit(limit)
          .offset(offset),
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(listCompaniesTable)
          .where(eq(listCompaniesTable.listId, id)),
      ]);
      const totalPages = Math.max(1, Math.ceil(count / limit));
      return res.json({ data: members, total: count, page, limit, totalPages });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch list members" });
  }
});

// POST /lists/:id/members — add members (ownership enforced)
router.post("/:id/members", async (req, res) => {
  try {
    const uid = userId(req);
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: "ids must be a non-empty array" });

    const [list] = await db.select().from(listsTable)
      .where(and(
        eq(listsTable.id, id),
        or(eq(listsTable.userId, uid!), isNull(listsTable.userId)),
      ));
    if (!list) return res.status(404).json({ error: "Not found" });

    if (list.type === "contacts") {
      await db
        .insert(listContactsTable)
        .values(ids.map((cid: number) => ({ listId: id, contactId: cid })))
        .onConflictDoNothing();
    } else {
      await db
        .insert(listCompaniesTable)
        .values(ids.map((cid: number) => ({ listId: id, companyId: cid })))
        .onConflictDoNothing();
    }
    res.json({ ok: true, added: ids.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to add members" });
  }
});

// DELETE /lists/:id/members/:memberId — remove a member (ownership enforced)
router.delete("/:id/members/:memberId", async (req, res) => {
  try {
    const uid = userId(req);
    const id = parseInt(req.params.id);
    const memberId = parseInt(req.params.memberId);
    if (isNaN(id) || isNaN(memberId)) return res.status(400).json({ error: "Invalid id" });

    const [list] = await db.select().from(listsTable)
      .where(and(
        eq(listsTable.id, id),
        or(eq(listsTable.userId, uid!), isNull(listsTable.userId)),
      ));
    if (!list) return res.status(404).json({ error: "Not found" });

    if (list.type === "contacts") {
      await db.delete(listContactsTable).where(
        and(eq(listContactsTable.listId, id), eq(listContactsTable.contactId, memberId))
      );
    } else {
      await db.delete(listCompaniesTable).where(
        and(eq(listCompaniesTable.listId, id), eq(listCompaniesTable.companyId, memberId))
      );
    }
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to remove member" });
  }
});

export default router;
