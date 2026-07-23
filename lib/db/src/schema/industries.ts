import { pgTable, serial, varchar, text } from "drizzle-orm/pg-core";

export const industriesTable = pgTable("industries", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
});

export type Industry = typeof industriesTable.$inferSelect;
export type InsertIndustry = typeof industriesTable.$inferInsert;
