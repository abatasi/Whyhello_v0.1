import { pgTable, serial, integer, varchar, text, timestamp } from "drizzle-orm/pg-core";
import { contactsTable } from "./contacts";

export const insightRelevanceScoresTable = pgTable("insight_relevance_scores", {
  id: serial("id").primaryKey(),
  contactId: integer("contact_id").references(() => contactsTable.id).notNull(),
  signalType: varchar("signal_type", { length: 50 }).notNull(), // personal|company|industry|role|colleague|counterpart
  signalId: integer("signal_id").notNull(),
  score: integer("score").notNull(), // 0–100
  description: text("description").notNull(),
  matchedHqSignals: text("matched_hq_signals"), // JSON-encoded string[]
  computedAt: timestamp("computed_at").notNull().defaultNow(),
});

export type InsightRelevanceScore = typeof insightRelevanceScoresTable.$inferSelect;
export type InsertInsightRelevanceScore = typeof insightRelevanceScoresTable.$inferInsert;
