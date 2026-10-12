import { boolean, index, integer, jsonb, pgTable, serial, timestamp, varchar } from "drizzle-orm/pg-core";
import { usersTable } from "./auth";

export type ImportJobError = { row: number; reason: string };

export const importJobsTable = pgTable("import_jobs", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id", { length: 255 }).notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  tableKey: varchar("table_key", { length: 64 }).notNull(),
  tableLabel: varchar("table_label", { length: 120 }).notNull(),
  filename: varchar("filename", { length: 300 }).notNull(),
  status: varchar("status", { enum: ["running", "completed", "partial", "failed"] }).notNull(),
  totalRows: integer("total_rows").notNull().default(0),
  inserted: integer("inserted").notNull().default(0),
  skipped: integer("skipped").notNull().default(0),
  errorCount: integer("error_count").notNull().default(0),
  errors: jsonb("errors").$type<ImportJobError[]>().notNull().default([]),
  errorsTruncated: boolean("errors_truncated").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
}, table => [
  index("import_jobs_user_created_idx").on(table.userId, table.createdAt),
]);

export type ImportJob = typeof importJobsTable.$inferSelect;
