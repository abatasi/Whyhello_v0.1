import { pgTable, serial, varchar, integer, text, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./auth";
import { listsTable } from "./lists";

export const listExportsTable = pgTable("list_exports", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => usersTable.id),
  listId: integer("list_id").references(() => listsTable.id, { onDelete: "set null" }),
  listName: varchar("list_name", { length: 200 }).notNull(),
  listType: varchar("list_type", { length: 20 }).notNull(),
  filename: varchar("filename", { length: 300 }).notNull(),
  csvData: text("csv_data").notNull(),
  memberCount: integer("member_count").notNull().default(0),
  requestedAt: timestamp("requested_at").notNull().defaultNow(),
});

export type ListExport = typeof listExportsTable.$inferSelect;
