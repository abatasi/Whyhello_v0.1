import { pgTable, serial, varchar, text, integer } from "drizzle-orm/pg-core";
import { rolesTable } from "./roles";

export const roleInsightsTable = pgTable("role_insights", {
  id: serial("id").primaryKey(),
  roleId: integer("role_id").references(() => rolesTable.id),
  title: varchar("title", { length: 500 }).notNull(),
  url: varchar("url", { length: 1000 }).notNull(),
  source: varchar("source", { length: 200 }),
  mediaType: varchar("media_type", { length: 50 }),
  description: text("description"),
  publishedDate: varchar("published_date", { length: 50 }),
});

export type RoleInsight = typeof roleInsightsTable.$inferSelect;
export type InsertRoleInsight = typeof roleInsightsTable.$inferInsert;
