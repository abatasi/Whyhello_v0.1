import { pgTable, serial, integer, text, timestamp, jsonb, varchar } from "drizzle-orm/pg-core";
import { contactsTable } from "./contacts";

export const outreachJobsTable = pgTable("outreach_jobs", {
  id: serial("id").primaryKey(),
  contactId: integer("contact_id").notNull().references(() => contactsTable.id),
  userId: text("user_id"),
  type: varchar("type", { length: 50 }).notNull(),
  status: varchar("status", { length: 20 }).notNull().default("generating"),
  title: varchar("title", { length: 255 }).notNull(),
  params: jsonb("params").notNull(),
  result: text("result"),
  prompt: text("prompt"),
  sources: jsonb("sources"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type OutreachJob = typeof outreachJobsTable.$inferSelect;
