import { Router, type IRouter, type Request } from "express";
import { db } from "@workspace/db";
import { savedSearchesTable } from "@workspace/db/schema";
import { eq, and, or, isNull } from "drizzle-orm";

const router: IRouter = Router();

function userId(req: Request): string | null {
  return req.dbUser?.id ?? null;
}

// GET /saved-searches — searches owned by current user (includes legacy NULL-owner rows)
router.get("/", async (req, res) => {
  try {
    const uid = userId(req);
    const rows = await db
      .select()
      .from(savedSearchesTable)
      .where(or(eq(savedSearchesTable.userId, uid!), isNull(savedSearchesTable.userId)))
      .orderBy(savedSearchesTable.createdAt);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch saved searches" });
  }
});

// POST /saved-searches — create a search for the current user
router.post("/", async (req, res) => {
  try {
    const uid = userId(req);
    const { name, tab, search, filters } = req.body;
    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ error: "Name is required" });
    }
    const [row] = await db
      .insert(savedSearchesTable)
      .values({
        userId: uid!,
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

// DELETE /saved-searches/:id — delete (ownership enforced)
router.delete("/:id", async (req, res) => {
  try {
    const uid = userId(req);
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    const [deleted] = await db
      .delete(savedSearchesTable)
      .where(and(eq(savedSearchesTable.id, id), eq(savedSearchesTable.userId, uid!)))
      .returning();
    if (!deleted) return res.status(404).json({ error: "Not found" });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete saved search" });
  }
});

export default router;
