import { Router, type IRouter } from "express";
import { generateBattlecardBuffer } from "../lib/battlecard-generator.js";
import { db } from "@workspace/db";
import { contactsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const router: IRouter = Router({ mergeParams: true });

router.get("/", async (req, res) => {
  try {
    const contactId = parseInt(req.params.contactId);
    if (isNaN(contactId)) { res.status(400).json({ error: "Invalid contact ID" }); return; }

    const [contactRow] = await db.select().from(contactsTable).where(eq(contactsTable.id, contactId)).limit(1);
    if (!contactRow) { res.status(404).json({ error: "Contact not found" }); return; }

    const buffer = await generateBattlecardBuffer(contactId);

    const fullName = [contactRow.firstName, contactRow.lastName].filter(Boolean).join(" ") || "contact";
    const safeName = fullName.replace(/[^a-z0-9]/gi, "_").toLowerCase();

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.presentationml.presentation");
    res.setHeader("Content-Disposition", `attachment; filename="battlecard_${safeName}.pptx"`);
    res.send(buffer);
  } catch (err) {
    console.error("Battlecard generation error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
