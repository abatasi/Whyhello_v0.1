import { pgTable, serial, integer, text, varchar, timestamp } from "drizzle-orm/pg-core";
import { contactsTable } from "./contacts";

export const callsTable = pgTable("calls", {
  id: serial("id").primaryKey(),
  contactId: integer("contact_id").notNull().references(() => contactsTable.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull(),
  twilioCallSid: text("twilio_call_sid"),
  direction: varchar("direction", { length: 20 }).notNull().default("outbound"),
  status: varchar("status", { length: 30 }).notNull().default("initiated"),
  callMode: varchar("call_mode", { length: 20 }).notNull().default("browser"), // 'browser' | 'phone'
  durationSeconds: integer("duration_seconds"),
  recordingUrl: text("recording_url"),
  recordingSid: text("recording_sid"),
  transcription: text("transcription"),
  aiSummary: text("ai_summary"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Call = typeof callsTable.$inferSelect;
export type NewCall = typeof callsTable.$inferInsert;
