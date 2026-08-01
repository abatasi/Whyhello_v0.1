import { pgTable, serial, integer, varchar, text, timestamp } from "drizzle-orm/pg-core";
import { contactsTable } from "./contacts";

export const insightQuotesTable = pgTable("insight_quotes", {
  id: serial("id").primaryKey(),
  contactId: integer("contact_id").references(() => contactsTable.id).notNull(),
  signalType: varchar("signal_type", { length: 50 }).notNull(),
  signalId: integer("signal_id").notNull(),
  quote: text("quote").notNull(),
  attribution: varchar("attribution", { length: 300 }).notNull(),
  attributionRole: varchar("attribution_role", { length: 300 }),
  hqBridge: text("hq_bridge"),
  matchedHqSignals: text("matched_hq_signals"), // JSON-serialised string[]
  computedAt: timestamp("computed_at").notNull().defaultNow(),
});

export type InsightQuote = typeof insightQuotesTable.$inferSelect;
export type InsertInsightQuote = typeof insightQuotesTable.$inferInsert;
