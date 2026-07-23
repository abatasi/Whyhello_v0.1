import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { industriesTable, industryInsightsTable } from "@workspace/db/schema";
import { eq, ilike, sql } from "drizzle-orm";

const router: IRouter = Router();

router.get("/", async (req, res) => {
  try {
    const raw = req.query as Record<string, string>;
    const page = Math.max(1, parseInt(raw.page ?? "1") || 1);
    const limit = Math.min(100, Math.max(1, parseInt(raw.limit ?? "20") || 20));
    const offset = (page - 1) * limit;

    const where = raw.search
      ? ilike(industriesTable.name, `%${raw.search}%`)
      : undefined;

    const [rows, [{ count }]] = await Promise.all([
      db.select({
        id: industriesTable.id,
        name: industriesTable.name,
        description: industriesTable.description,
        insightCount: sql<number>`(SELECT COUNT(*)::int FROM industry_insights WHERE industry_insights.industry_id = industries.id)`,
      }).from(industriesTable).where(where).orderBy(industriesTable.name).limit(limit).offset(offset),
      db.select({ count: sql<number>`count(*)::int` }).from(industriesTable).where(where),
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

    const [industry] = await db.select().from(industriesTable).where(eq(industriesTable.id, id)).limit(1);
    if (!industry) { res.status(404).json({ error: "Industry not found" }); return; }

    const insights = await db.select().from(industryInsightsTable)
      .where(eq(industryInsightsTable.industryId, id))
      .orderBy(industryInsightsTable.id);

    res.json({ ...industry, insights });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", async (req, res) => {
  try {
    const { name, description } = req.body ?? {};
    if (!name?.trim()) { res.status(400).json({ error: "name is required" }); return; }
    const [row] = await db.insert(industriesTable).values({ name: name.trim(), description: description || null }).returning();
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
    const updates: Partial<typeof industriesTable.$inferInsert> = {};
    if (name !== undefined) updates.name = name.trim();
    if (description !== undefined) updates.description = description || null;
    if (Object.keys(updates).length === 0) { res.status(400).json({ error: "No fields to update" }); return; }
    const [row] = await db.update(industriesTable).set(updates).where(eq(industriesTable.id, id)).returning();
    if (!row) { res.status(404).json({ error: "Industry not found" }); return; }
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
    await db.delete(industriesTable).where(eq(industriesTable.id, id));
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
