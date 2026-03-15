import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { companyInsightsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const router: IRouter = Router({ mergeParams: true });

router.get("/", async (req, res) => {
  try {
    const companyId = parseInt(req.params.companyId);
    if (isNaN(companyId)) {
      res.status(400).json({ error: "Invalid company ID" });
      return;
    }
    const insights = await db
      .select()
      .from(companyInsightsTable)
      .where(eq(companyInsightsTable.companyId, companyId))
      .orderBy(companyInsightsTable.mediaType);
    res.json(insights);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
