import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const dnaProfilesTable = pgTable("dna_profiles", {
  userId: text("user_id").primaryKey().notNull(),
  data: text("data").notNull().default("{}"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type DnaProfileRow = typeof dnaProfilesTable.$inferSelect;
