import { pgTable, serial, varchar, text, integer } from "drizzle-orm/pg-core";
import { industriesTable } from "./industries";

export const industryInsightsTable = pgTable("industry_insights", {
  id: serial("id").primaryKey(),
  industryId: integer("industry_id").references(() => industriesTable.id),
  title: varchar("title", { length: 500 }).notNull(),
  url: varchar("url", { length: 1000 }).notNull(),
  source: varchar("source", { length: 200 }),
  mediaType: varchar("media_type", { length: 50 }),
  description: text("description"),
  publishedDate: varchar("published_date", { length: 50 }),
});

export type IndustryInsight = typeof industryInsightsTable.$inferSelect;
export type InsertIndustryInsight = typeof industryInsightsTable.$inferInsert;
