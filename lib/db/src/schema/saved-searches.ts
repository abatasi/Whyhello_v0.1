import { pgTable, serial, varchar, jsonb, timestamp } from "drizzle-orm/pg-core";

export const savedSearchesTable = pgTable("saved_searches", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 200 }).notNull().unique(),
  tab: varchar("tab", { length: 20 }).notNull().default("contacts"),
  search: varchar("search", { length: 500 }),
  filters: jsonb("filters").notNull().default({}),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type SavedSearch = typeof savedSearchesTable.$inferSelect;
export type InsertSavedSearch = typeof savedSearchesTable.$inferInsert;
