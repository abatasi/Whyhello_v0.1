import { pgTable, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { contactsTable } from "./contacts";

/**
 * Stores the aggregate (meta) relevance score for a contact.
 * Computed automatically after each scoring run in /relevance/score.
 *
 * metaScore = round( mean(personalBest, companyBest, industryBest, roleBest) )
 *   where missing categories default to 0.
 *
 * Range: 0–100. A contact with rich, high-scoring signals across all four
 * categories approaches 100; a contact with signals in only one category
 * or weak signals across the board scores proportionally lower.
 */
export const contactMetaScoresTable = pgTable("contact_meta_scores", {
  id: serial("id").primaryKey(),
  contactId: integer("contact_id").references(() => contactsTable.id).notNull().unique(),
  metaScore: integer("meta_score").notNull(),        // 0–100
  personalBest: integer("personal_best").notNull(),  // best Personal signal score (0 if none)
  companyBest: integer("company_best").notNull(),    // best Company signal score (0 if none)
  industryBest: integer("industry_best").notNull(),  // best Industry signal score (0 if none)
  roleBest: integer("role_best").notNull(),          // best Role signal score (0 if none)
  signalCount: integer("signal_count").notNull(),    // total scored signals (all types)
  computedAt: timestamp("computed_at").notNull().defaultNow(),
});

export type ContactMetaScore = typeof contactMetaScoresTable.$inferSelect;
export type InsertContactMetaScore = typeof contactMetaScoresTable.$inferInsert;
