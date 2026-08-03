import { Router, type IRouter } from "express";
import { createRequire } from "node:module";
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
  insightRelevanceScoresTable,
} from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";

const router: IRouter = Router({ mergeParams: true });

function trunc(str: string | null | undefined, max: number): string {
  if (!str) return "";
  return str.length > max ? str.slice(0, max - 1) + "…" : str;
}

function normaliseUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  return `https://${url}`;
}

function scoreColor(s: number): string {
  if (s >= 75) return "16A34A";
  if (s >= 50) return "D97706";
  if (s >= 25) return "EA580C";
  return "94A3B8";
}

router.get("/", async (req, res) => {
  try {
    const contactId = parseInt(req.params.contactId);
    if (isNaN(contactId)) { res.status(400).json({ error: "Invalid contact ID" }); return; }

    // Fetch contact + company
    const [contactRow] = await db.select().from(contactsTable).where(eq(contactsTable.id, contactId)).limit(1);
    if (!contactRow) { res.status(404).json({ error: "Contact not found" }); return; }

    let companyRow: typeof companiesTable.$inferSelect | null = null;
    if (contactRow.companyId) {
      const [co] = await db.select().from(companiesTable).where(eq(companiesTable.id, contactRow.companyId)).limit(1);
      companyRow = co ?? null;
    }

    // Fetch ALL insights for each category + all relevance scores in parallel
    const [personalRows, companyInsRows, industryRows, roleRows, relevanceRows] = await Promise.all([
      db.select().from(contactInsightsTable)
        .where(and(eq(contactInsightsTable.contactId, contactId), eq(contactInsightsTable.category, "personal"))),
      contactRow.companyId
        ? db.select().from(companyInsightsTable).where(eq(companyInsightsTable.companyId, contactRow.companyId))
        : Promise.resolve([]),
      contactRow.industryId
        ? db.select().from(industryInsightsTable).where(eq(industryInsightsTable.industryId, contactRow.industryId))
        : Promise.resolve([]),
      contactRow.roleId
        ? db.select().from(roleInsightsTable).where(eq(roleInsightsTable.roleId, contactRow.roleId))
        : Promise.resolve([]),
      db.select().from(insightRelevanceScoresTable).where(eq(insightRelevanceScoresTable.contactId, contactId)),
    ]);

    // Build relevance lookup: "signalType-signalId" → score row
    const relMap = new Map<string, typeof insightRelevanceScoresTable.$inferSelect>();
    for (const r of relevanceRows) relMap.set(`${r.signalType}-${r.signalId}`, r);

    // Pick top insight per category (highest relevance score; fallback to first row)
    function topInsight<T extends { id: number }>(rows: T[], signalType: string): T | null {
      if (rows.length === 0) return null;
      let best = rows[0];
      let bestScore = relMap.get(`${signalType}-${rows[0].id}`)?.score ?? -1;
      for (const r of rows.slice(1)) {
        const s = relMap.get(`${signalType}-${r.id}`)?.score ?? -1;
        if (s > bestScore) { best = r; bestScore = s; }
      }
      return best;
    }

    const insights = {
      personal:  topInsight(personalRows,   "personal"),
      company:   topInsight(companyInsRows,  "company"),
      industry:  topInsight(industryRows,    "industry"),
      role:      topInsight(roleRows,        "role"),
    };

    // ─── Build PPTX ───────────────────────────────────────────────────────────
    const pptx = new PptxGenJS();
    const slide = pptx.addSlide();

    const W = 10;
    const H = 7.5;
    const PAD = 0.32;
    const IW = W - PAD * 2;

    const fullName = [contactRow.firstName, contactRow.lastName].filter(Boolean).join(" ") || "Unknown Contact";
    const titleLine = [contactRow.jobTitle, companyRow?.name].filter(Boolean).join("  ·  ");
    const metaLine  = [contactRow.seniority, contactRow.department, companyRow?.industry].filter(Boolean).join("   |   ");

    // ── Slide background ───────────────────────────────────────────────────
    slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: W, h: H, fill: { color: "F8FAFC" } });

    // ── Header band ────────────────────────────────────────────────────────
    const HDR_H = 1.22;
    slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: W, h: HDR_H, fill: { color: "0F172A" } });

    // "BATTLECARD" pill
    slide.addShape(pptx.ShapeType.rect, { x: W - 1.48, y: 0.16, w: 1.14, h: 0.24, fill: { color: "E11D48" } });
    slide.addText("BATTLECARD", {
      x: W - 1.48, y: 0.16, w: 1.14, h: 0.24,
      fontSize: 6.5, bold: true, color: "FFFFFF", align: "center", valign: "middle", charSpacing: 1,
    });

    slide.addText(fullName, {
      x: PAD, y: 0.12, w: IW - 1.25, h: 0.44,
      fontSize: 22, bold: true, color: "FFFFFF", valign: "bottom",
    });
    if (titleLine) {
      slide.addText(titleLine, {
        x: PAD, y: 0.58, w: IW - 1.25, h: 0.28,
        fontSize: 10, color: "94A3B8", valign: "middle",
      });
    }
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

    type DetailItem = { label: string; url?: string };
    const detailItems: DetailItem[] = [];

    if (contactRow.email) {
      detailItems.push({ label: `✉  ${contactRow.email}`, url: `mailto:${contactRow.email}` });
    }
    if (contactRow.phone) {
      detailItems.push({ label: `✆  ${contactRow.phone}` });
    }
    if (contactRow.location) {
      detailItems.push({ label: `⌖  ${contactRow.location}` });
    }
    if (contactRow.linkedinUrl) {
      const fullLi = normaliseUrl(contactRow.linkedinUrl)!;
      const display = contactRow.linkedinUrl.replace(/^https?:\/\/(www\.)?/i, "").replace(/\/$/, "");
      detailItems.push({ label: `in  ${trunc(display, 38)}`, url: fullLi });
    }
    if (companyRow?.website) {
      const fullWeb = normaliseUrl(companyRow.website)!;
      const display = companyRow.website.replace(/^https?:\/\/(www\.)?/i, "").replace(/\/$/, "");
      detailItems.push({ label: `⊕  ${trunc(display, 30)}`, url: fullWeb });
    }

    if (detailItems.length > 0) {
      const colW = IW / detailItems.length;
      detailItems.forEach(({ label, url }, i) => {
        const opts: Record<string, unknown> = {
          x: PAD + i * colW, y: DET_Y, w: colW, h: DET_H,
          fontSize: 7.5, color: url ? "1E40AF" : "334155", valign: "middle",
        };
        if (url) opts.hyperlink = { url };
        slide.addText(label, opts);
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
    const IPAD     = 0.14;

    const SECTION_LABEL_COLOR = "94A3B8";

    const cards = [
      { cat: "PERSONAL",  signalType: "personal",  item: insights.personal,  bg: "EEF2FF", border: "818CF8", label: "4338CA" },
      { cat: "COMPANY",   signalType: "company",   item: insights.company,   bg: "FFFBEB", border: "F59E0B", label: "92400E" },
      { cat: "INDUSTRY",  signalType: "industry",  item: insights.industry,  bg: "F0FDF4", border: "34D399", label: "065F46" },
      { cat: "ROLE",      signalType: "role",       item: insights.role,      bg: "F5F3FF", border: "A78BFA", label: "4C1D95" },
    ];

    cards.forEach(({ cat, signalType, item, bg, border, label }, i) => {
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
        x: cx + IPAD, y: cy + 0.11, w: CARD_W - IPAD * 2, h: 0.18,
        fontSize: 6.5, bold: true, color: label, charSpacing: 1.5,
      });

      if (!item) {
        slide.addText("No insight available", {
          x: cx + IPAD, y: cy + 0.38, w: CARD_W - IPAD * 2, h: 0.3,
          fontSize: 8, color: "CBD5E1", italic: true,
        });
        return;
      }

      const rel = relMap.get(`${signalType}-${item.id}`) ?? null;
      const insightUrl = normaliseUrl((item as any).url);

      // ── Title (hyperlink) ──────────────────────────────────────────────
      const titleOpts: Record<string, unknown> = {
        x: cx + IPAD, y: cy + 0.33, w: CARD_W - IPAD * 2, h: 0.56,
        fontSize: 8.5, bold: true, color: insightUrl ? "1E40AF" : "1E293B",
        wrap: true, valign: "top",
      };
      if (insightUrl) titleOpts.hyperlink = { url: insightUrl };
      slide.addText(trunc(item.title, 120), titleOpts);

      // ── SUMMARY section ────────────────────────────────────────────────
      const SUM_LABEL_Y = cy + 0.97;
      slide.addText("SUMMARY", {
        x: cx + IPAD, y: SUM_LABEL_Y, w: CARD_W - IPAD * 2, h: 0.16,
        fontSize: 5.5, bold: true, color: SECTION_LABEL_COLOR, charSpacing: 1.5,
      });
      // Thin rule under section label
      slide.addShape(pptx.ShapeType.line, {
        x: cx + IPAD, y: SUM_LABEL_Y + 0.16, w: CARD_W - IPAD * 2, h: 0,
        line: { color: border, width: 0.5, dashType: "solid" },
      });

      const summaryText = trunc((item as any).description, 340);
      slide.addText(summaryText || "No summary available.", {
        x: cx + IPAD, y: SUM_LABEL_Y + 0.2, w: CARD_W - IPAD * 2, h: 1.0,
        fontSize: 7.5, color: "475569", wrap: true, valign: "top",
      });

      // ── RELEVANCE section ──────────────────────────────────────────────
      const REL_LABEL_Y = cy + 2.26;
      slide.addText("RELEVANCE", {
        x: cx + IPAD, y: REL_LABEL_Y, w: CARD_W - IPAD * 2, h: 0.16,
        fontSize: 5.5, bold: true, color: SECTION_LABEL_COLOR, charSpacing: 1.5,
      });
      slide.addShape(pptx.ShapeType.line, {
        x: cx + IPAD, y: REL_LABEL_Y + 0.16, w: CARD_W - IPAD * 2, h: 0,
        line: { color: border, width: 0.5, dashType: "solid" },
      });

      if (rel) {
        const sc = rel.score;
        const scCol = scoreColor(sc);

        // Score number + description on same block
        slide.addText([
          { text: `${sc}`, options: { fontSize: 13, bold: true, color: scCol } },
          { text: " /100   ", options: { fontSize: 7, color: "94A3B8" } },
          { text: trunc(rel.description, 220), options: { fontSize: 7.5, color: "475569" } },
        ], {
          x: cx + IPAD, y: REL_LABEL_Y + 0.21, w: CARD_W - IPAD * 2, h: 1.1,
          wrap: true, valign: "top",
        });

        // Matched HQ signals as small tags (comma-separated)
        const signals: string[] = rel.matchedHqSignals
          ? (() => { try { return JSON.parse(rel.matchedHqSignals) as string[]; } catch { return []; } })()
          : [];
        if (signals.length > 0) {
          slide.addText(signals.map(s => `· ${s}`).join("   "), {
            x: cx + IPAD, y: REL_LABEL_Y + 1.38, w: CARD_W - IPAD * 2, h: 0.36,
            fontSize: 6, color: label, wrap: true, valign: "top",
          });
        }
      } else {
        slide.addText("No relevance score computed yet.", {
          x: cx + IPAD, y: REL_LABEL_Y + 0.21, w: CARD_W - IPAD * 2, h: 0.3,
          fontSize: 7.5, color: "CBD5E1", italic: true,
        });
      }

      // ── Source + date footer ───────────────────────────────────────────
      const src = [item.source, (item as any).publishedDate].filter(Boolean).join("  ·  ");
      if (src) {
        slide.addText(trunc(src, 48), {
          x: cx + IPAD, y: cy + CARD_H - 0.26, w: CARD_W - IPAD * 2, h: 0.2,
          fontSize: 6, color: "94A3B8", italic: true,
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
