import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { counterpartInsightsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const router: IRouter = Router({ mergeParams: true });

router.get("/", async (req, res) => {
  try {
    const contactId = parseInt(req.params.contactId);
    if (isNaN(contactId)) {
      res.status(400).json({ error: "Invalid contact ID" });
      return;
    }
    const insights = await db
      .select()
      .from(counterpartInsightsTable)
      .where(eq(counterpartInsightsTable.contactId, contactId))
      .orderBy(counterpartInsightsTable.mediaType);
    res.json(insights);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
