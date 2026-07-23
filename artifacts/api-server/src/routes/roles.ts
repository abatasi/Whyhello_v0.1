import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { rolesTable, roleInsightsTable } from "@workspace/db/schema";
import { eq, ilike, sql } from "drizzle-orm";

const router: IRouter = Router();

router.get("/", async (req, res) => {
  try {
    const raw = req.query as Record<string, string>;
    const page = Math.max(1, parseInt(raw.page ?? "1") || 1);
    const limit = Math.min(100, Math.max(1, parseInt(raw.limit ?? "20") || 20));
    const offset = (page - 1) * limit;

    const where = raw.search
      ? ilike(rolesTable.name, `%${raw.search}%`)
      : undefined;

    const [rows, [{ count }]] = await Promise.all([
      db.select({
        id: rolesTable.id,
        name: rolesTable.name,
        description: rolesTable.description,
        insightCount: sql<number>`(SELECT COUNT(*)::int FROM role_insights WHERE role_insights.role_id = roles.id)`,
      }).from(rolesTable).where(where).orderBy(rolesTable.name).limit(limit).offset(offset),
      db.select({ count: sql<number>`count(*)::int` }).from(rolesTable).where(where),
    ]);

    res.json({ data: rows, total: count, page, limit, totalPages: Math.ceil(count / limit) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

    const [role] = await db.select().from(rolesTable).where(eq(rolesTable.id, id)).limit(1);
    if (!role) { res.status(404).json({ error: "Role not found" }); return; }

    const insights = await db.select().from(roleInsightsTable)
      .where(eq(roleInsightsTable.roleId, id))
      .orderBy(roleInsightsTable.id);

    res.json({ ...role, insights });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", async (req, res) => {
  try {
    const { name, description } = req.body ?? {};
    if (!name?.trim()) { res.status(400).json({ error: "name is required" }); return; }
    const [row] = await db.insert(rolesTable).values({ name: name.trim(), description: description || null }).returning();
    res.status(201).json(row);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
    const { name, description } = req.body ?? {};
    const updates: Partial<typeof rolesTable.$inferInsert> = {};
    if (name !== undefined) updates.name = name.trim();
    if (description !== undefined) updates.description = description || null;
    if (Object.keys(updates).length === 0) { res.status(400).json({ error: "No fields to update" }); return; }
    const [row] = await db.update(rolesTable).set(updates).where(eq(rolesTable.id, id)).returning();
    if (!row) { res.status(404).json({ error: "Role not found" }); return; }
    res.json(row);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
    await db.delete(rolesTable).where(eq(rolesTable.id, id));
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
