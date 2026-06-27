import { pgTable, serial, integer, varchar, text } from "drizzle-orm/pg-core";
import { contactsTable } from "./contacts";

export const roleInsightsTable = pgTable("role_insights", {
  id: serial("id").primaryKey(),
  contactId: integer("contact_id").references(() => contactsTable.id).notNull(),
  title: varchar("title", { length: 500 }).notNull(),
  url: varchar("url", { length: 1000 }).notNull(),
  source: varchar("source", { length: 200 }).notNull(),
  mediaType: varchar("media_type", { length: 50 }).notNull(),
  description: text("description"),
  publishedDate: varchar("published_date", { length: 50 }),
});

export type RoleInsight = typeof roleInsightsTable.$inferSelect;
export type InsertRoleInsight = typeof roleInsightsTable.$inferInsert;
