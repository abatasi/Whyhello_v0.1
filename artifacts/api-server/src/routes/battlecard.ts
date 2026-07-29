import { Router, type IRouter } from "express";
import { createRequire } from "node:module";
// pptxgenjs exports its constructor as module.exports (CJS style).
// In an ESM package we need createRequire to load it as a proper constructor.
const _require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const PptxGenJS = _require("pptxgenjs") as any;
import { db } from "@workspace/db";
import {
  contactsTable,
  companiesTable,
  contactInsightsTable,
  companyInsightsTable,
  industryInsightsTable,
  roleInsightsTable,
} from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";

const router: IRouter = Router({ mergeParams: true });

function trunc(str: string | null | undefined, max: number): string {
  if (!str) return "";
  return str.length > max ? str.slice(0, max - 1) + "…" : str;
}

router.get("/", async (req, res) => {
  try {
    const contactId = parseInt(req.params.contactId);
    if (isNaN(contactId)) { res.status(400).json({ error: "Invalid contact ID" }); return; }

    // Fetch contact (all fields, so we get industryId + roleId)
    const [contactRow] = await db.select().from(contactsTable).where(eq(contactsTable.id, contactId)).limit(1);
    if (!contactRow) { res.status(404).json({ error: "Contact not found" }); return; }

    // Fetch company separately if linked
    let companyRow: typeof companiesTable.$inferSelect | null = null;
    if (contactRow.companyId) {
      const [co] = await db.select().from(companiesTable).where(eq(companiesTable.id, contactRow.companyId)).limit(1);
      companyRow = co ?? null;
    }

    // Fetch top insight from each of the four categories in parallel
    const [personalRows, companyInsRows, industryRows, roleRows] = await Promise.all([
      db.select().from(contactInsightsTable)
        .where(and(eq(contactInsightsTable.contactId, contactId), eq(contactInsightsTable.category, "personal")))
        .limit(1),
      contactRow.companyId
        ? db.select().from(companyInsightsTable).where(eq(companyInsightsTable.companyId, contactRow.companyId)).limit(1)
        : Promise.resolve([]),
      contactRow.industryId
        ? db.select().from(industryInsightsTable).where(eq(industryInsightsTable.industryId, contactRow.industryId)).limit(1)
        : Promise.resolve([]),
      contactRow.roleId
        ? db.select().from(roleInsightsTable).where(eq(roleInsightsTable.roleId, contactRow.roleId)).limit(1)
        : Promise.resolve([]),
    ]);

    const insights = {
      personal:  personalRows[0]  ?? null,
      company:   companyInsRows[0] ?? null,
      industry:  industryRows[0]  ?? null,
      role:      roleRows[0]      ?? null,
    };

    // ─── Build PPTX ───────────────────────────────────────────────────────────
    const pptx = new PptxGenJS();

    const slide = pptx.addSlide();

    // Slide is 10" × 7.5" (default)
    const W = 10;
    const H = 7.5;
    const PAD = 0.32;
    const IW = W - PAD * 2; // inner width

    const fullName = [contactRow.firstName, contactRow.lastName].filter(Boolean).join(" ") || "Unknown Contact";
    const titleLine = [contactRow.jobTitle, companyRow?.name].filter(Boolean).join("  ·  ");
    const metaLine  = [contactRow.seniority, contactRow.department, companyRow?.industry].filter(Boolean).join("   |   ");

    // ── Slide background ───────────────────────────────────────────────────
    slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: W, h: H, fill: { color: "F8FAFC" } });

    // ── Header band ────────────────────────────────────────────────────────
    const HDR_H = 1.22;
    slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: W, h: HDR_H, fill: { color: "0F172A" } });

    // "BATTLECARD" pill (top-right)
    slide.addShape(pptx.ShapeType.rect, { x: W - 1.48, y: 0.16, w: 1.14, h: 0.24, fill: { color: "E11D48" } });
    slide.addText("BATTLECARD", {
      x: W - 1.48, y: 0.16, w: 1.14, h: 0.24,
      fontSize: 6.5, bold: true, color: "FFFFFF", align: "center", valign: "middle",
      charSpacing: 1,
    });

    // Contact name
    slide.addText(fullName, {
      x: PAD, y: 0.12, w: IW - 1.25, h: 0.44,
      fontSize: 22, bold: true, color: "FFFFFF", valign: "bottom",
    });

    // Title · Company
    if (titleLine) {
      slide.addText(titleLine, {
        x: PAD, y: 0.58, w: IW - 1.25, h: 0.28,
        fontSize: 10, color: "94A3B8", valign: "middle",
      });
    }

    // Seniority | Dept | Industry
    if (metaLine) {
      slide.addText(metaLine, {
        x: PAD, y: 0.88, w: IW, h: 0.22,
        fontSize: 7.5, color: "475569", valign: "middle",
      });
    }

    // ── Contact details bar ────────────────────────────────────────────────
    const DET_Y = HDR_H;
    const DET_H = 0.52;
    slide.addShape(pptx.ShapeType.rect, { x: 0, y: DET_Y, w: W, h: DET_H, fill: { color: "E2E8F0" } });

    const details: string[] = [];
    if (contactRow.email)       details.push(`✉  ${contactRow.email}`);
    if (contactRow.phone)       details.push(`✆  ${contactRow.phone}`);
    if (contactRow.location)    details.push(`⌖  ${contactRow.location}`);
    if (contactRow.linkedinUrl) details.push(`in  ${trunc(contactRow.linkedinUrl.replace(/^https?:\/\/(www\.)?linkedin\.com\/in\//, ""), 32)}`);
    if (companyRow?.website)    details.push(`⊕  ${trunc(companyRow.website.replace(/^https?:\/\/(www\.)?/, ""), 30)}`);

    if (details.length > 0) {
      const colW = IW / details.length;
      details.forEach((d, i) => {
        slide.addText(d, {
          x: PAD + i * colW, y: DET_Y, w: colW, h: DET_H,
          fontSize: 7.5, color: "334155", valign: "middle",
        });
      });
    }

    // ── "KEY INSIGHTS" label ───────────────────────────────────────────────
    const INS_LABEL_Y = DET_Y + DET_H + 0.1;
    slide.addText("KEY INSIGHTS", {
      x: PAD, y: INS_LABEL_Y, w: IW, h: 0.2,
      fontSize: 7, bold: true, color: "94A3B8", charSpacing: 2,
    });

    // ── Four insight cards ─────────────────────────────────────────────────
    const CARD_TOP = INS_LABEL_Y + 0.22;
    const CARD_H   = H - CARD_TOP - 0.18;
    const GAP      = 0.12;
    const CARD_W   = (IW - GAP * 3) / 4;
    const IPAD     = 0.14; // inner card padding

    const cards = [
      { cat: "PERSONAL",  item: insights.personal,  bg: "EEF2FF", border: "818CF8", label: "4338CA" },
      { cat: "COMPANY",   item: insights.company,   bg: "FFFBEB", border: "F59E0B", label: "92400E" },
      { cat: "INDUSTRY",  item: insights.industry,  bg: "F0FDF4", border: "34D399", label: "065F46" },
      { cat: "ROLE",      item: insights.role,      bg: "F5F3FF", border: "A78BFA", label: "4C1D95" },
    ];

    cards.forEach(({ cat, item, bg, border, label }, i) => {
      const cx = PAD + i * (CARD_W + GAP);
      const cy = CARD_TOP;

      // Card background + border
      slide.addShape(pptx.ShapeType.rect, {
        x: cx, y: cy, w: CARD_W, h: CARD_H,
        fill: { color: bg },
        line: { color: border, width: 1 },
      });

      // Category label
      slide.addText(cat, {
        x: cx + IPAD, y: cy + 0.12, w: CARD_W - IPAD * 2, h: 0.18,
        fontSize: 6.5, bold: true, color: label, charSpacing: 1.5,
      });

      if (item) {
        // Insight title
        const title = trunc(item.title, 100);
        slide.addText(title, {
          x: cx + IPAD, y: cy + 0.33, w: CARD_W - IPAD * 2, h: 0.82,
          fontSize: 8.5, bold: true, color: "1E293B", wrap: true, valign: "top",
        });

        // Description
        const desc = trunc(item.description, 280);
        if (desc) {
          slide.addText(desc, {
            x: cx + IPAD, y: cy + 1.2, w: CARD_W - IPAD * 2, h: CARD_H - 1.6,
            fontSize: 7.5, color: "475569", wrap: true, valign: "top",
          });
        }

        // Source + date footer
        const src = [item.source, (item as any).publishedDate].filter(Boolean).join("  ·  ");
        if (src) {
          slide.addText(trunc(src, 48), {
            x: cx + IPAD, y: cy + CARD_H - 0.26, w: CARD_W - IPAD * 2, h: 0.2,
            fontSize: 6, color: "94A3B8", italic: true,
          });
        }
      } else {
        slide.addText("No insight available", {
          x: cx + IPAD, y: cy + 0.38, w: CARD_W - IPAD * 2, h: 0.3,
          fontSize: 8, color: "CBD5E1", italic: true,
        });
      }
    });

    // ── Footer ─────────────────────────────────────────────────────────────
    slide.addText("Generated by Whyhello", {
      x: 0, y: H - 0.14, w: W - PAD, h: 0.13,
      fontSize: 5.5, color: "CBD5E1", align: "right",
    });

    // ── Stream PPTX back ───────────────────────────────────────────────────
    const buffer = await pptx.write("nodebuffer") as Buffer;
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
