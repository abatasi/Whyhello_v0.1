import { integer, pgTable, serial, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { contactsTable } from "./contacts";

export const messagesTable = pgTable("messages", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  contactId: integer("contact_id").references(() => contactsTable.id),
  toEmail: varchar("to_email", { length: 320 }).notNull(),
  toName: varchar("to_name", { length: 200 }),
  subject: text("subject").notNull().default(""),
  body: text("body").notNull().default(""),
  status: varchar("status", { length: 20 }).notNull().default("draft"),
  // Send metadata
  sentAt: timestamp("sent_at", { withTimezone: true }),
  sentFrom: varchar("sent_from", { length: 320 }),
  // Tracking
  trackingToken: varchar("tracking_token", { length: 64 }).unique(),
  openedAt: timestamp("opened_at", { withTimezone: true }),
  clickCount: integer("click_count").default(0).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type MessageRow = typeof messagesTable.$inferSelect;
export type InsertMessageRow = typeof messagesTable.$inferInsert;
