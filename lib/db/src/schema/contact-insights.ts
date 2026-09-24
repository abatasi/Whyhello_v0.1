import { pgTable, serial, integer, varchar, text, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { contactsTable } from "./contacts";

export const contactInsightsTable = pgTable("contact_insights", {
  id: serial("id").primaryKey(),
  contactId: integer("contact_id").references(() => contactsTable.id).notNull(),
  category: varchar("category", { length: 50 }).notNull().default("personal"),
  title: varchar("title", { length: 500 }).notNull(),
  url: varchar("url", { length: 1000 }).notNull(),
  source: varchar("source", { length: 200 }),
  mediaType: varchar("media_type", { length: 50 }).notNull(),
  description: text("description"),
  publishedDate: varchar("published_date", { length: 50 }),
}, (table) => [
  // The same source may belong to multiple contacts, but not twice to one contact.
  uniqueIndex("contact_insights_contact_url_unique")
    .on(table.contactId, table.url)
    .where(sql`${table.url} <> ''`),
]);

export type ContactInsight = typeof contactInsightsTable.$inferSelect;
export type InsertContactInsight = typeof contactInsightsTable.$inferInsert;
