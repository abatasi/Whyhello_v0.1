import { pgTable, serial, varchar, integer, text, timestamp } from "drizzle-orm/pg-core";
import { contactsTable } from "./contacts";

export const messagesTable = pgTable("messages", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id", { length: 255 }).notNull(),
  contactId: integer("contact_id").references(() => contactsTable.id, { onDelete: "set null" }),
  toEmail: varchar("to_email", { length: 255 }).notNull(),
  toName: varchar("to_name", { length: 255 }),
  subject: varchar("subject", { length: 500 }).notNull().default(""),
  body: text("body").notNull().default(""),
  status: varchar("status", { length: 20 }).notNull().default("draft"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
