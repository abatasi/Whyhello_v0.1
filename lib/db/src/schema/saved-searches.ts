import { pgTable, serial, varchar, jsonb, timestamp, unique } from "drizzle-orm/pg-core";

export const savedSearchesTable = pgTable("saved_searches", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id", { length: 255 }), // nullable — pre-migration rows have null
  name: varchar("name", { length: 200 }).notNull(),
  tab: varchar("tab", { length: 20 }).notNull().default("contacts"),
  search: varchar("search", { length: 500 }),
  filters: jsonb("filters").notNull().default({}),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [unique().on(t.userId, t.name)]);

export type SavedSearch = typeof savedSearchesTable.$inferSelect;
export type InsertSavedSearch = typeof savedSearchesTable.$inferInsert;
