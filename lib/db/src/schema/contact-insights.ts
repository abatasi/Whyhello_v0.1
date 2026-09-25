import { pgTable, serial, integer, varchar, text } from "drizzle-orm/pg-core";
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
});

export type ContactInsight = typeof contactInsightsTable.$inferSelect;
export type InsertContactInsight = typeof contactInsightsTable.$inferInsert;
