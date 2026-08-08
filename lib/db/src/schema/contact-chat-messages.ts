import { pgTable, serial, integer, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { contactsTable } from "./contacts";

export const contactChatMessagesTable = pgTable("contact_chat_messages", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id", { length: 255 }), // nullable — pre-migration rows have null; scoped per user
  contactId: integer("contact_id").notNull().references(() => contactsTable.id, { onDelete: "cascade" }),
  role: varchar("role", { length: 20 }).notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type ContactChatMessage = typeof contactChatMessagesTable.$inferSelect;
