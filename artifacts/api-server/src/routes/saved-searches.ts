import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { savedSearchesTable } from "@workspace/db/schema";
import { eq, sql } from "drizzle-orm";

const router: IRouter = Router();

router.get("/", async (_req, res) => {
  try {
    const rows = await db
      .select()
      .from(savedSearchesTable)
      .orderBy(savedSearchesTable.createdAt);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch saved searches" });
  }
});

router.post("/", async (req, res) => {
  try {
    const { name, tab, search, filters } = req.body;
    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ error: "Name is required" });
    }
    const [row] = await db
      .insert(savedSearchesTable)
      .values({
        name: name.trim(),
        tab: tab ?? "contacts",
        search: search ?? null,
        filters: filters ?? {},
      })
      .returning();
    res.status(201).json(row);
  } catch (err: any) {
    if (err?.code === "23505") {
      return res.status(409).json({ error: "A saved search with that name already exists" });
    }
    console.error(err);
    res.status(500).json({ error: "Failed to save search" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    const [deleted] = await db
      .delete(savedSearchesTable)
      .where(eq(savedSearchesTable.id, id))
      .returning();
    if (!deleted) return res.status(404).json({ error: "Not found" });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete saved search" });
  }
});

export default router;
