import { pgTable, serial, varchar, text } from "drizzle-orm/pg-core";

export const rolesTable = pgTable("roles", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
});

export type Role = typeof rolesTable.$inferSelect;
export type InsertRole = typeof rolesTable.$inferInsert;
