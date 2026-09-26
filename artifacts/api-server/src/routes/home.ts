import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  companiesTable,
  contactMetaScoresTable,
  contactsTable,
  contactRevealsTable,
  dnaProfilesTable,
  messagesTable,
  sequencesTable,
} from "@workspace/db/schema";
import { getAuth } from "@clerk/express";
import { and, desc, eq, ilike, inArray, isNull, or, sql, type SQL } from "drizzle-orm";
import {
  parseDnaProfile,
  selectedTargetMarket,
  targetMarketLocationMatches,
  type LiveTargetMarket,
} from "../lib/live-audience";

const router: IRouter = Router();

type ActivityType = "message" | "contact-activated" | "playbook" | "hq";
type Activity = {
  id: string;
  type: ActivityType;
  title: string;
  detail: string;
  occurredAt: string;
  href?: string;
};

function activityContact(firstName: string | null, lastName: string | null, jobTitle?: string | null, company?: string | null) {
  const name = [firstName, lastName].filter(Boolean).join(" ");
  const role = [jobTitle, company ? `at ${company}` : ""].filter(Boolean).join(" ");
  return [name, role].filter(Boolean).join(" · ");
}

function currentUserId(req: Parameters<typeof getAuth>[0]): string | null {
  const auth = getAuth(req);
  return (auth?.sessionClaims?.userId as string | undefined) ?? auth?.userId ?? null;
}

function scoreCategory(score: number): string {
  if (score >= 90) return "Excellent";
  if (score >= 75) return "Strong";
  if (score >= 50) return "Potential";
  return "Low Fit";
}

function normalized(value: string | null): string {
  return (value ?? "").trim().toLocaleLowerCase();
}

function matchesAny(value: string | null, options: string[]): boolean {
  const candidate = normalized(value);
  return candidate.length > 0 && options.some((option) => normalized(option) === candidate);
}

function targetMarketScoreSql(market: LiveTargetMarket): SQL<number> {
  const dimensions: SQL<number>[] = [];
  if (market.industries.length > 0) {
    dimensions.push(sql<number>`case when ${inArray(
      sql<string>`lower(trim(coalesce(${companiesTable.industry}, '')))`,
      market.industries.map((value) => normalized(value)),
    )} then 1 else 0 end`);
  }
  if (market.companySizes.length > 0) {
    dimensions.push(sql<number>`case when ${inArray(
      sql<string>`lower(trim(coalesce(${companiesTable.size}, '')))`,
      market.companySizes.map((value) => normalized(value)),
    )} then 1 else 0 end`);
  }
  if (market.locations.length > 0) {
    const locationChecks = market.locations.map((value) =>
      ilike(companiesTable.location, `%${value}%`),
    );
    dimensions.push(sql<number>`case when ${or(...locationChecks)!} then 1 else 0 end`);
  }
  return sql<number>`round(((${sql.join(dimensions, sql` + `)})::numeric / ${dimensions.length}) * 100)`;
}

router.get("/top-leads", async (req, res) => {
  const userId = currentUserId(req);
  if (!userId) { res.status(401).json({ error: "Authentication required" }); return; }
  try {
    const requestedLimit = Number.parseInt(String(req.query.limit ?? "10"), 10);
    const limit = Number.isFinite(requestedLimit) ? Math.min(10, Math.max(1, requestedLimit)) : 10;
    const rows = await db
      .select({
        id: contactsTable.id,
        firstName: contactsTable.firstName,
        lastName: contactsTable.lastName,
        email: contactsTable.email,
        jobTitle: contactsTable.jobTitle,
        companyName: companiesTable.name,
        location: contactsTable.location,
        score: contactMetaScoresTable.metaScore,
        revealId: contactRevealsTable.id,
      })
      .from(contactMetaScoresTable)
      .innerJoin(contactsTable, eq(contactMetaScoresTable.contactId, contactsTable.id))
      .leftJoin(companiesTable, eq(contactsTable.companyId, companiesTable.id))
      .leftJoin(contactRevealsTable, and(
        eq(contactRevealsTable.contactId, contactsTable.id),
        eq(contactRevealsTable.userId, userId),
      ))
      .orderBy(desc(contactMetaScoresTable.metaScore), desc(contactsTable.id))
      .limit(limit);

    res.json(rows.map(({ revealId, ...row }) => ({
      ...row,
      email: revealId ? row.email : null,
      scoreCategory: scoreCategory(row.score),
    })));
  } catch (error) {
    console.error("Top leads GET error:", error);
    res.status(500).json({ error: "Failed to load top leads" });
  }
});

router.get("/top-buyers", async (req, res) => {
  const userId = currentUserId(req);
  if (!userId) { res.status(401).json({ error: "Authentication required" }); return; }
  try {
    const requestedLimit = Number.parseInt(String(req.query.limit ?? "10"), 10);
    const limit = Number.isFinite(requestedLimit) ? Math.min(10, Math.max(1, requestedLimit)) : 10;
    const [dnaProfile] = await db
      .select({ data: dnaProfilesTable.data })
      .from(dnaProfilesTable)
      .where(eq(dnaProfilesTable.userId, userId))
      .limit(1);
    const market = dnaProfile
      ? selectedTargetMarket(parseDnaProfile(dnaProfile.data))
      : null;
    if (!market || (
      market.industries.length === 0 &&
      market.companySizes.length === 0 &&
      market.locations.length === 0
    )) {
      res.json([]);
      return;
    }

    const fitScore = targetMarketScoreSql(market);
    const matchedContacts = sql<number>`count(${contactsTable.id})`.mapWith(Number);
    const rows = await db
      .select({
        id: companiesTable.id,
        name: companiesTable.name,
        industry: companiesTable.industry,
        size: companiesTable.size,
        location: companiesTable.location,
        country: companiesTable.country,
        score: fitScore.mapWith(Number),
        matchedContacts,
      })
      .from(companiesTable)
      .leftJoin(contactsTable, eq(contactsTable.companyId, companiesTable.id))
      .groupBy(
        companiesTable.id,
        companiesTable.name,
        companiesTable.industry,
        companiesTable.size,
        companiesTable.location,
        companiesTable.country,
      )
      .having(sql`${fitScore} > 0`)
      .orderBy(desc(fitScore), desc(matchedContacts), desc(companiesTable.id))
      .limit(limit);

    const ranked = rows.map((row) => {
      const checks = [
        market.industries.length > 0 ? matchesAny(row.industry, market.industries) : null,
        market.companySizes.length > 0 ? matchesAny(row.size, market.companySizes) : null,
        market.locations.length > 0
          ? targetMarketLocationMatches(row.location, market.locations)
          : null,
      ].filter((match): match is boolean => match !== null);
      const matchedDimensions = checks.filter(Boolean).length;
      const configuredDimensions = checks.length;
      return {
        ...row,
        scoreCategory: scoreCategory(row.score),
        matchedTargetMarket: market.name ?? "",
        matchedDimensions,
        configuredDimensions,
      };
    });

    res.json(ranked);
  } catch (error) {
    console.error("Top buyers GET error:", error);
    res.status(500).json({ error: "Failed to load top buyers" });
  }
});

router.get("/activity", async (req, res) => {
  const userId = currentUserId(req);
  if (!userId) { res.status(401).json({ error: "Authentication required" }); return; }
  try {
    const [messages, reveals, playbooks, hq] = await Promise.all([
      db.select({
        id: messagesTable.id,
        createdAt: messagesTable.createdAt,
        firstName: contactsTable.firstName,
        lastName: contactsTable.lastName,
        jobTitle: contactsTable.jobTitle,
        companyName: companiesTable.name,
      }).from(messagesTable)
        .leftJoin(contactsTable, eq(messagesTable.contactId, contactsTable.id))
        .leftJoin(companiesTable, eq(contactsTable.companyId, companiesTable.id))
        .where(and(
          eq(messagesTable.userId, userId),
          isNull(messagesTable.sequenceId),
        )).orderBy(desc(messagesTable.createdAt)).limit(6),
      db.select({
        id: contactRevealsTable.id,
        revealedAt: contactRevealsTable.revealedAt,
        firstName: contactsTable.firstName,
        lastName: contactsTable.lastName,
        jobTitle: contactsTable.jobTitle,
        companyName: companiesTable.name,
        contactId: contactRevealsTable.contactId,
      }).from(contactRevealsTable)
        .leftJoin(contactsTable, eq(contactRevealsTable.contactId, contactsTable.id))
        .leftJoin(companiesTable, eq(contactsTable.companyId, companiesTable.id))
        .where(eq(contactRevealsTable.userId, userId))
        .orderBy(desc(contactRevealsTable.revealedAt)).limit(6),
      db.select({
        id: sequencesTable.id,
        name: sequencesTable.name,
        createdAt: sequencesTable.createdAt,
      }).from(sequencesTable).where(eq(sequencesTable.userId, userId))
        .orderBy(desc(sequencesTable.createdAt)).limit(6),
      db.select({ updatedAt: dnaProfilesTable.updatedAt })
        .from(dnaProfilesTable).where(eq(dnaProfilesTable.userId, userId)).limit(1),
    ]);

    const activities: Activity[] = [
      ...messages.map((row) => ({
        id: `message:${row.id}`, type: "message" as const, title: "Single message created",
        detail: activityContact(row.firstName, row.lastName, row.jobTitle, row.companyName) || "Message draft",
        occurredAt: row.createdAt.toISOString(), href: "/messages",
      })),
      ...reveals.map((row) => ({
        id: `contact:${row.id}`, type: "contact-activated" as const, title: "Contact activated",
        detail: activityContact(row.firstName, row.lastName, row.jobTitle, row.companyName) || "Contact details unlocked",
        occurredAt: row.revealedAt.toISOString(), href: `/contacts/${row.contactId}`,
      })),
      ...playbooks.map((row) => ({
        id: `playbook:${row.id}`, type: "playbook" as const, title: "Playbook built",
        detail: row.name, occurredAt: row.createdAt.toISOString(), href: "/playbooks",
      })),
      ...hq.map((row) => ({
        id: "hq:profile", type: "hq" as const, title: "HQ elements updated",
        detail: "Workspace positioning and company context", occurredAt: row.updatedAt.toISOString(), href: "/hq",
      })),
    ].sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt)).slice(0, 6);
    res.json(activities);
  } catch (error) {
    console.error("Home activity GET error:", error);
    res.status(500).json({ error: "Failed to load recent activity" });
  }
});

export default router;