import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";

export const insightDropsTable = pgTable("insight_drops", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  mediaType: text("media_type"),
  insightTitle: text("insight_title"),
  subInsightText: text("sub_insight_text"),
  contactId: integer("contact_id"),
  droppedAt: timestamp("dropped_at").defaultNow().notNull(),
});
