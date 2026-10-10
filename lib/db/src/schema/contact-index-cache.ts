import { pgTable, text, integer, varchar, jsonb, timestamp, primaryKey } from "drizzle-orm/pg-core";
import { contactsTable } from "./contacts";

export const contactIndexCacheTable = pgTable("contact_index_cache", {
  userId: text("user_id").notNull(),
  contactId: integer("contact_id").notNull().references(() => contactsTable.id, { onDelete: "cascade" }),
  kind: varchar("kind", { length: 16 }).notNull(),
  hqFingerprint: text("hq_fingerprint").notNull(),
  results: jsonb("results").$type<unknown>().notNull(),
  indexedAt: timestamp("indexed_at", { withTimezone: true }).notNull(),
}, table => [primaryKey({ columns: [table.userId, table.contactId, table.kind] })]);
