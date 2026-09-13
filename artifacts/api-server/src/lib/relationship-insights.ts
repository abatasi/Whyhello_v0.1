import { db } from "@workspace/db";
import {
  companiesTable,
  contactInsightsTable,
  contactsTable,
} from "@workspace/db/schema";
import { and, eq, inArray, ne } from "drizzle-orm";

export type RelationshipKind = "colleague" | "counterpart";
export type RelationshipGroup = 1 | 2;

export type RelationshipSourceContact = {
  id: number;
  name: string;
  jobTitle: string | null;
  companyName: string | null;
};

export async function loadRelationshipInsights(
  contactId: number,
  kind: RelationshipKind,
): Promise<{
  items: (typeof contactInsightsTable.$inferSelect)[];
  sourceContacts: Map<number, RelationshipSourceContact>;
  groups: Map<number, RelationshipGroup>;
  sourceContactIds: number[];
}> {
  const [target] = await db
    .select({
      companyId: contactsTable.companyId,
      industryId: contactsTable.industryId,
      roleId: contactsTable.roleId,
    })
    .from(contactsTable)
    .where(eq(contactsTable.id, contactId))
    .limit(1);

  if (!target) {
    return { items: [], sourceContacts: new Map(), groups: new Map(), sourceContactIds: [] };
  }

  const peers = kind === "colleague"
    ? await db
        .select({
          id: contactsTable.id,
          firstName: contactsTable.firstName,
          lastName: contactsTable.lastName,
          jobTitle: contactsTable.jobTitle,
          companyId: contactsTable.companyId,
          industryId: contactsTable.industryId,
        })
        .from(contactsTable)
        .where(
          and(
            target.companyId
              ? eq(contactsTable.companyId, target.companyId)
              : eq(contactsTable.id, -1),
            ne(contactsTable.id, contactId),
          ),
        )
    : target.roleId
      ? await db
          .select({
            id: contactsTable.id,
            firstName: contactsTable.firstName,
            lastName: contactsTable.lastName,
            jobTitle: contactsTable.jobTitle,
            companyId: contactsTable.companyId,
            industryId: contactsTable.industryId,
          })
          .from(contactsTable)
          .where(
            and(
              eq(contactsTable.roleId, target.roleId),
              ne(contactsTable.id, contactId),
              ...(target.companyId ? [ne(contactsTable.companyId, target.companyId)] : []),
            ),
          )
      : [];

  if (peers.length === 0) {
    return { items: [], sourceContacts: new Map(), groups: new Map(), sourceContactIds: [] };
  }

  const peerIds = peers.map((peer) => peer.id);
  const [items, companies] = await Promise.all([
    db
      .select()
      .from(contactInsightsTable)
      .where(
        and(
          inArray(contactInsightsTable.contactId, peerIds),
          eq(contactInsightsTable.category, "personal"),
        ),
      ),
    db
      .select({ id: companiesTable.id, name: companiesTable.name })
      .from(companiesTable)
      .where(inArray(companiesTable.id, [...new Set(peers.map((peer) => peer.companyId).filter(Boolean))] as number[])),
  ]);

  const companyNameMap = new Map(companies.map((company) => [company.id, company.name]));
  const sourceContacts = new Map<number, RelationshipSourceContact>(
    peers.map((peer) => [
      peer.id,
      {
        id: peer.id,
        name: [peer.firstName, peer.lastName].filter(Boolean).join(" "),
        jobTitle: peer.jobTitle ?? null,
        companyName: peer.companyId ? companyNameMap.get(peer.companyId) ?? null : null,
      },
    ]),
  );

  const groups = new Map<number, RelationshipGroup>();
  if (kind === "counterpart") {
    for (const peer of peers) {
      groups.set(
        peer.id,
        target.industryId != null && peer.industryId === target.industryId ? 1 : 2,
      );
    }
  }

  return { items, sourceContacts, groups, sourceContactIds: peerIds };
}