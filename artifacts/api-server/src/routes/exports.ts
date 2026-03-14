import { Router, type IRouter, type Request } from "express";
import { db } from "@workspace/db";
import {
  listExportsTable, listsTable,
  listContactsTable, listCompaniesTable,
  contactsTable, companiesTable,
} from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";

type AuthedReq = Request & { user: { id: string } };

function getUserId(req: Request): string | null {
  return (req as AuthedReq).user?.id ?? null;
}

const router: IRouter = Router();

function escapeCSV(val: unknown): string {
  if (val == null) return "";
  const str = String(val);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

async function buildCSV(listId: number, listType: string): Promise<{ csv: string; memberCount: number }> {
  if (listType === "contacts") {
    const rows = await db
      .select({
        firstName: contactsTable.firstName,
        lastName: contactsTable.lastName,
        email: contactsTable.email,
        phone: contactsTable.phone,
        jobTitle: contactsTable.jobTitle,
        department: contactsTable.department,
        seniority: contactsTable.seniority,
        location: contactsTable.location,
        country: contactsTable.country,
        linkedinUrl: contactsTable.linkedinUrl,
        twitterHandle: contactsTable.twitterHandle,
        bio: contactsTable.bio,
        companyName: companiesTable.name,
        companyIndustry: companiesTable.industry,
        companySize: companiesTable.size,
        companyWebsite: companiesTable.website,
        companyLocation: companiesTable.location,
      })
      .from(listContactsTable)
      .innerJoin(contactsTable, eq(listContactsTable.contactId, contactsTable.id))
      .leftJoin(companiesTable, eq(contactsTable.companyId, companiesTable.id))
      .where(eq(listContactsTable.listId, listId))
      .orderBy(contactsTable.firstName, contactsTable.lastName);

    const headers = [
      "First Name", "Last Name", "Email", "Phone", "Job Title", "Department", "Seniority",
      "Location", "Country", "LinkedIn URL", "Twitter Handle", "Bio",
      "Company", "Company Industry", "Company Size", "Company Website", "Company Location",
    ];
    const dataRows = rows.map((r) =>
      [
        r.firstName, r.lastName, r.email, r.phone, r.jobTitle, r.department, r.seniority,
        r.location, r.country, r.linkedinUrl, r.twitterHandle, r.bio,
        r.companyName, r.companyIndustry, r.companySize, r.companyWebsite, r.companyLocation,
      ].map(escapeCSV).join(","),
    );
    return { csv: [headers.join(","), ...dataRows].join("\n"), memberCount: rows.length };
  } else {
    const rows = await db
      .select({
        name: companiesTable.name,
        industry: companiesTable.industry,
        website: companiesTable.website,
        location: companiesTable.location,
        country: companiesTable.country,
        size: companiesTable.size,
        employeeCount: companiesTable.employeeCount,
        foundedYear: companiesTable.foundedYear,
        description: companiesTable.description,
      })
      .from(listCompaniesTable)
      .innerJoin(companiesTable, eq(listCompaniesTable.companyId, companiesTable.id))
      .where(eq(listCompaniesTable.listId, listId))
      .orderBy(companiesTable.name);

    const headers = [
      "Company Name", "Industry", "Website", "Location", "Country",
      "Employee Size", "Employee Count", "Founded Year", "Description",
    ];
    const dataRows = rows.map((r) =>
      [
        r.name, r.industry, r.website, r.location, r.country,
        r.size, r.employeeCount, r.foundedYear, r.description,
      ].map(escapeCSV).join(","),
    );
    return { csv: [headers.join(","), ...dataRows].join("\n"), memberCount: rows.length };
  }
}

router.post("/", async (req, res) => {
  const userId = getUserId(req);
  if (!userId) { res.status(401).json({ error: "Authentication required" }); return; }
  try {
    const listId = parseInt(req.body?.listId);
    if (isNaN(listId)) { res.status(400).json({ error: "listId is required" }); return; }

    const [list] = await db.select().from(listsTable).where(eq(listsTable.id, listId));
    if (!list) { res.status(404).json({ error: "List not found" }); return; }

    const { csv, memberCount } = await buildCSV(listId, list.type);

    const safeName = list.name.replace(/[^a-z0-9]/gi, "_").toLowerCase();
    const date = new Date().toISOString().split("T")[0];
    const filename = `${safeName}_${date}.csv`;

    const [record] = await db.insert(listExportsTable).values({
      userId,
      listId,
      listName: list.name,
      listType: list.type,
      filename,
      csvData: csv,
      memberCount,
    }).returning();

    res.status(201).json(record);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create export" });
  }
});

router.get("/", async (req, res) => {
  const userId = getUserId(req);
  if (!userId) { res.status(401).json({ error: "Authentication required" }); return; }
  try {
    const rows = await db
      .select({
        id: listExportsTable.id,
        userId: listExportsTable.userId,
        listId: listExportsTable.listId,
        listName: listExportsTable.listName,
        listType: listExportsTable.listType,
        filename: listExportsTable.filename,
        memberCount: listExportsTable.memberCount,
        requestedAt: listExportsTable.requestedAt,
      })
      .from(listExportsTable)
      .where(eq(listExportsTable.userId, userId))
      .orderBy(desc(listExportsTable.requestedAt));
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch exports" });
  }
});

router.get("/:id/download", async (req, res) => {
  const userId = getUserId(req);
  if (!userId) { res.status(401).json({ error: "Authentication required" }); return; }
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

    const [record] = await db.select().from(listExportsTable).where(eq(listExportsTable.id, id));
    if (!record) { res.status(404).json({ error: "Export not found" }); return; }
    if (record.userId !== userId) { res.status(403).json({ error: "Forbidden" }); return; }

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${record.filename}"`);
    res.send(record.csvData);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to download export" });
  }
});

export default router;
