import { Router, type IRouter } from "express";
import multer from "multer";
import { db } from "@workspace/db";
import {
  companiesTable,
  contactsTable,
  contactInsightsTable,
  companyInsightsTable,
  industriesTable,
  rolesTable,
  industryInsightsTable,
  roleInsightsTable,
} from "@workspace/db/schema";
import { eq, ilike } from "drizzle-orm";

const router: IRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

// ── CSV parser ────────────────────────────────────────────────────────────────

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let inQuotes = false;
  let current = "";
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (ch === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

function parseCSV(buffer: Buffer): Record<string, string>[] {
  const text = buffer.toString("utf-8").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = text.trim().split("\n").filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = parseCSVLine(lines[0]).map(h => h.trim());
  return lines.slice(1).map(line => {
    const vals = parseCSVLine(line);
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h] = (vals[i] ?? "").trim(); });
    return obj;
  });
}

// ── Template definitions ──────────────────────────────────────────────────────

export interface ColumnDef {
  name: string;
  required: boolean;
  type: string;
  example: string;
  notes: string;
}

export interface TemplateConfig {
  key: string;
  label: string;
  description: string;
  columns: ColumnDef[];
}

const TEMPLATES: TemplateConfig[] = [
  {
    key: "industries",
    label: "Industries",
    description: "Top-level industry classifications. Upload these first; companies reference them via industryId.",
    columns: [
      { name: "name",        required: true,  type: "text", example: "B2B SaaS",                           notes: "Industry name — must be unique" },
      { name: "description", required: false, type: "text", example: "Cloud-based software sold to businesses", notes: "Optional description" },
    ],
  },
  {
    key: "roles",
    label: "Roles",
    description: "Top-level role classifications. Upload these first; contacts reference them via roleId.",
    columns: [
      { name: "name",        required: true,  type: "text", example: "VP of Sales",          notes: "Role name — must be unique" },
      { name: "description", required: false, type: "text", example: "Leads revenue and GTM strategy", notes: "Optional description" },
    ],
  },
  {
    key: "companies",
    label: "Companies",
    description: "Bulk import companies. Rows with a 'name' that already exists (case-insensitive) are skipped.",
    columns: [
      { name: "name",          required: true,  type: "text",   example: "Acme Corp",          notes: "Company name — must be unique" },
      { name: "industryId",    required: false, type: "number", example: "3",                  notes: "Numeric ID of an existing Industry — links this company to its industry" },
      { name: "industry",      required: false, type: "text",   example: "Technology",          notes: "Free-text industry label (separate from industryId)" },
      { name: "size",          required: false, type: "text",   example: "51-200",              notes: "1-10, 11-50, 51-200, 201-500, 501-1000, 1001-5000, 5001+" },
      { name: "location",      required: false, type: "text",   example: "San Francisco, CA",   notes: "City and/or state" },
      { name: "country",       required: false, type: "text",   example: "United States",       notes: "Full country name" },
      { name: "website",       required: false, type: "url",    example: "https://acme.com",    notes: "Include https://" },
      { name: "description",   required: false, type: "text",   example: "Builds great things", notes: "Short company bio" },
      { name: "employeeCount", required: false, type: "number", example: "250",                 notes: "Numeric headcount" },
      { name: "foundedYear",   required: false, type: "number", example: "2015",                notes: "4-digit year" },
      { name: "linkedinUrl",   required: false, type: "url",    example: "https://linkedin.com/company/acme", notes: "Full LinkedIn URL" },
    ],
  },
  {
    key: "contacts",
    label: "Contacts",
    description: "Bulk import contacts. Rows whose 'email' already exists are skipped. Use 'companyName' to link to an existing company.",
    columns: [
      { name: "firstName",     required: true,  type: "text",   example: "Jane",                notes: "First name" },
      { name: "lastName",      required: true,  type: "text",   example: "Smith",               notes: "Last name" },
      { name: "roleId",        required: false, type: "number", example: "2",                   notes: "Numeric ID of an existing Role — links this contact to their role" },
      { name: "jobTitle",      required: false, type: "text",   example: "VP of Sales",         notes: "" },
      { name: "department",    required: false, type: "text",   example: "Sales",               notes: "e.g. Sales, Marketing, Engineering" },
      { name: "seniority",     required: false, type: "text",   example: "VP",                  notes: "C-Suite, VP, Director, Manager, IC" },
      { name: "email",         required: false, type: "email",  example: "jane@acme.com",       notes: "Used to detect duplicates" },
      { name: "phone",         required: false, type: "text",   example: "+1 415 555 0100",     notes: "" },
      { name: "location",      required: false, type: "text",   example: "New York, NY",        notes: "City and/or state" },
      { name: "country",       required: false, type: "text",   example: "United States",       notes: "" },
      { name: "linkedinUrl",   required: false, type: "url",    example: "https://linkedin.com/in/janesmith", notes: "" },
      { name: "twitterHandle", required: false, type: "text",   example: "@janesmith",          notes: "With or without @" },
      { name: "bio",           required: false, type: "text",   example: "B2B sales leader...", notes: "Short bio or notes" },
      { name: "companyId",     required: false, type: "number", example: "7",                   notes: "Numeric ID of an existing Company — links this contact to their company" },
    ],
  },
  {
    key: "contact_insights",
    label: "Contact Insights",
    description: "Bulk import news, articles, or data points linked to contacts. 'contactId' must be the numeric ID of an existing contact.",
    columns: [
      { name: "contactId",    required: true,  type: "number", example: "42",                              notes: "Numeric contact ID from the Directory" },
      { name: "title",        required: true,  type: "text",   example: "Jane Smith joins board of Acme",  notes: "Headline or title" },
      { name: "url",          required: true,  type: "url",    example: "https://techcrunch.com/...",      notes: "Source article URL" },
      { name: "source",       required: true,  type: "text",   example: "TechCrunch",                     notes: "Publication or source name" },
      { name: "mediaType",    required: true,  type: "text",   example: "article",                        notes: "article, podcast, video, press_release, social" },
      { name: "category",     required: false, type: "text",   example: "news",                           notes: "news, funding, promotion, social (default: personal)" },
      { name: "description",  required: false, type: "text",   example: "Jane was appointed...",          notes: "Brief summary of the insight" },
      { name: "publishedDate",required: false, type: "date",   example: "2024-06-15",                     notes: "ISO date YYYY-MM-DD" },
    ],
  },
  {
    key: "company_insights",
    label: "Company Insights",
    description: "Bulk import news, articles, or data points linked to companies. 'companyId' must be the numeric ID of an existing company.",
    columns: [
      { name: "companyId",    required: true,  type: "number", example: "7",                              notes: "Numeric company ID from the Directory" },
      { name: "title",        required: true,  type: "text",   example: "Acme Corp raises $50M Series B", notes: "Headline or title" },
      { name: "url",          required: true,  type: "url",    example: "https://bloomberg.com/...",       notes: "Source article URL" },
      { name: "source",       required: true,  type: "text",   example: "Bloomberg",                      notes: "Publication or source name" },
      { name: "mediaType",    required: true,  type: "text",   example: "article",                        notes: "article, podcast, video, press_release, social" },
      { name: "description",  required: false, type: "text",   example: "Acme Corp announced...",         notes: "Brief summary of the insight" },
      { name: "publishedDate",required: false, type: "date",   example: "2024-06-15",                     notes: "ISO date YYYY-MM-DD" },
    ],
  },
  {
    key: "industry_insights",
    label: "Industry Insights",
    description: "Articles, reports, and content linked to an Industry. Must reference a parent Industry via industryId.",
    columns: [
      { name: "industryId",   required: true,  type: "number", example: "1",                                      notes: "Numeric ID of the parent Industry (upload Industries first)" },
      { name: "title",        required: true,  type: "text",   example: "The Future of B2B SaaS in 2025",         notes: "Article or content headline" },
      { name: "url",          required: true,  type: "url",    example: "https://gartner.com/saas-report-2024",   notes: "Source URL — required, all insight data is drawn from here" },
      { name: "source",       required: false, type: "text",   example: "Gartner",                               notes: "Publication or source name" },
      { name: "mediaType",    required: false, type: "text",   example: "report",                                notes: "article, podcast, video, press_release, report, social" },
      { name: "description",  required: false, type: "text",   example: "Analysis of SaaS growth trends...",     notes: "Brief summary" },
      { name: "publishedDate",required: false, type: "date",   example: "2024-06-15",                            notes: "ISO date YYYY-MM-DD" },
    ],
  },
  {
    key: "role_insights",
    label: "Role Insights",
    description: "Articles, podcasts, and content linked to a Role. Must reference a parent Role via roleId.",
    columns: [
      { name: "roleId",       required: true,  type: "number", example: "2",                                      notes: "Numeric ID of the parent Role (upload Roles first)" },
      { name: "title",        required: true,  type: "text",   example: "How CFOs Are Driving Transformation",   notes: "Article or content headline" },
      { name: "url",          required: true,  type: "url",    example: "https://linkedin.com/posts/cfo-2024",   notes: "Source URL — required, all insight data is drawn from here" },
      { name: "source",       required: false, type: "text",   example: "LinkedIn",                              notes: "Publication or source name" },
      { name: "mediaType",    required: false, type: "text",   example: "social",                                notes: "article, podcast, video, press_release, social" },
      { name: "description",  required: false, type: "text",   example: "CFO perspectives on transformation...", notes: "Brief summary" },
      { name: "publishedDate",required: false, type: "date",   example: "2024-06-15",                            notes: "ISO date YYYY-MM-DD" },
    ],
  },
];

// ── Routes ────────────────────────────────────────────────────────────────────

router.get("/templates", (_req, res) => {
  res.json(TEMPLATES);
});

router.get("/template/:table", (req, res) => {
  const tpl = TEMPLATES.find(t => t.key === req.params.table);
  if (!tpl) { res.status(404).json({ error: "Unknown table" }); return; }

  const headers = tpl.columns.map(c => c.name);
  const examples = tpl.columns.map(c => c.example);
  const csv = [headers.join(","), examples.join(",")].join("\n");

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="${tpl.key}_template.csv"`);
  res.send(csv);
});

router.post("/:table/preview", upload.single("file"), (req, res) => {
  const tpl = TEMPLATES.find(t => t.key === req.params.table);
  if (!tpl) { res.status(404).json({ error: "Unknown table" }); return; }
  if (!req.file) { res.status(400).json({ error: "No file uploaded" }); return; }

  const rows = parseCSV(req.file.buffer);
  const headers = rows.length > 0 ? Object.keys(rows[0]) : tpl.columns.map(c => c.name);
  res.json({ headers, rows: rows.slice(0, 5), total: rows.length });
});

router.post("/:table", upload.single("file"), async (req, res) => {
  const tableKey = req.params.table;
  const tpl = TEMPLATES.find(t => t.key === tableKey);
  if (!tpl) { res.status(404).json({ error: "Unknown table" }); return; }
  if (!req.file) { res.status(400).json({ error: "No file uploaded" }); return; }

  const rows = parseCSV(req.file.buffer);
  if (rows.length === 0) { res.status(400).json({ error: "File has no data rows" }); return; }

  const results = { inserted: 0, skipped: 0, errors: [] as { row: number; reason: string }[] };

  if (tableKey === "companies") {
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const name = r.name?.trim();
      if (!name) { results.errors.push({ row: i + 2, reason: "Missing required field: name" }); continue; }
      try {
        const existing = await db.select({ id: companiesTable.id }).from(companiesTable)
          .where(ilike(companiesTable.name, name)).limit(1);
        if (existing.length > 0) { results.skipped++; continue; }
        await db.insert(companiesTable).values({
          name,
          industryId: r.industryId ? (parseInt(r.industryId) || null) : null,
          industry: r.industry || null,
          size: r.size || null,
          location: r.location || null,
          country: r.country || null,
          website: r.website || null,
          description: r.description || null,
          employeeCount: r.employeeCount ? (parseInt(r.employeeCount) || null) : null,
          foundedYear: r.foundedYear ? (parseInt(r.foundedYear) || null) : null,
          linkedinUrl: r.linkedinUrl || null,
        });
        results.inserted++;
      } catch (err) {
        results.errors.push({ row: i + 2, reason: String(err) });
      }
    }
  } else if (tableKey === "contacts") {
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const firstName = r.firstName?.trim();
      const lastName = r.lastName?.trim();
      if (!firstName || !lastName) {
        results.errors.push({ row: i + 2, reason: "Missing required fields: firstName and/or lastName" });
        continue;
      }
      try {
        const email = r.email?.trim() || null;
        if (email) {
          const existing = await db.select({ id: contactsTable.id }).from(contactsTable)
            .where(eq(contactsTable.email, email)).limit(1);
          if (existing.length > 0) { results.skipped++; continue; }
        }
        await db.insert(contactsTable).values({
          firstName, lastName,
          roleId: r.roleId ? (parseInt(r.roleId) || null) : null,
          jobTitle: r.jobTitle || null,
          department: r.department || null,
          seniority: r.seniority || null,
          email,
          phone: r.phone || null,
          location: r.location || null,
          country: r.country || null,
          linkedinUrl: r.linkedinUrl || null,
          twitterHandle: r.twitterHandle || null,
          bio: r.bio || null,
          companyId: r.companyId ? (parseInt(r.companyId) || null) : null,
        });
        results.inserted++;
      } catch (err) {
        results.errors.push({ row: i + 2, reason: String(err) });
      }
    }
  } else if (tableKey === "contact_insights") {
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const contactId = parseInt(r.contactId ?? "");
      const title = r.title?.trim();
      if (!contactId || !title) {
        results.errors.push({ row: i + 2, reason: "Missing required fields: contactId and/or title" });
        continue;
      }
      try {
        await db.insert(contactInsightsTable).values({
          contactId,
          title,
          url: r.url?.trim() || "",
          source: r.source?.trim() || "",
          mediaType: r.mediaType?.trim() || "article",
          category: r.category?.trim() || "personal",
          description: r.description || null,
          publishedDate: r.publishedDate || null,
        });
        results.inserted++;
      } catch (err) {
        results.errors.push({ row: i + 2, reason: String(err) });
      }
    }
  } else if (tableKey === "company_insights") {
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const companyId = parseInt(r.companyId ?? "");
      const title = r.title?.trim();
      if (!companyId || !title) {
        results.errors.push({ row: i + 2, reason: "Missing required fields: companyId and/or title" });
        continue;
      }
      try {
        await db.insert(companyInsightsTable).values({
          companyId,
          title,
          url: r.url?.trim() || "",
          source: r.source?.trim() || "",
          mediaType: r.mediaType?.trim() || "article",
          description: r.description || null,
          publishedDate: r.publishedDate || null,
        });
        results.inserted++;
      } catch (err) {
        results.errors.push({ row: i + 2, reason: String(err) });
      }
    }
  } else if (tableKey === "industries") {
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const name = r.name?.trim();
      if (!name) {
        results.errors.push({ row: i + 2, reason: "Missing required field: name" });
        continue;
      }
      try {
        await db.insert(industriesTable).values({
          name,
          description: r.description || null,
        });
        results.inserted++;
      } catch (err) {
        results.errors.push({ row: i + 2, reason: String(err) });
      }
    }
  } else if (tableKey === "roles") {
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const name = r.name?.trim();
      if (!name) {
        results.errors.push({ row: i + 2, reason: "Missing required field: name" });
        continue;
      }
      try {
        await db.insert(rolesTable).values({
          name,
          description: r.description || null,
        });
        results.inserted++;
      } catch (err) {
        results.errors.push({ row: i + 2, reason: String(err) });
      }
    }
  } else if (tableKey === "industry_insights") {
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const industryId = parseInt(r.industryId ?? "");
      const title = r.title?.trim();
      const url = r.url?.trim();
      if (!industryId || !title || !url) {
        results.errors.push({ row: i + 2, reason: "Missing required fields: industryId, title, and/or url" });
        continue;
      }
      try {
        await db.insert(industryInsightsTable).values({
          industryId,
          title,
          url,
          source: r.source?.trim() || null,
          mediaType: r.mediaType?.trim() || null,
          description: r.description || null,
          publishedDate: r.publishedDate || null,
        });
        results.inserted++;
      } catch (err) {
        results.errors.push({ row: i + 2, reason: String(err) });
      }
    }
  } else if (tableKey === "role_insights") {
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const roleId = parseInt(r.roleId ?? "");
      const title = r.title?.trim();
      const url = r.url?.trim();
      if (!roleId || !title || !url) {
        results.errors.push({ row: i + 2, reason: "Missing required fields: roleId, title, and/or url" });
        continue;
      }
      try {
        await db.insert(roleInsightsTable).values({
          roleId,
          title,
          url,
          source: r.source?.trim() || null,
          mediaType: r.mediaType?.trim() || null,
          description: r.description || null,
          publishedDate: r.publishedDate || null,
        });
        results.inserted++;
      } catch (err) {
        results.errors.push({ row: i + 2, reason: String(err) });
      }
    }
  }

  res.json(results);
});

export default router;
