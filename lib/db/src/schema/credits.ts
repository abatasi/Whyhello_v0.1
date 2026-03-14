import { integer, pgTable, serial, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core";
import { usersTable } from "./auth";

export const contactRevealsTable = pgTable(
  "contact_reveals",
  {
    id: serial("id").primaryKey(),
    userId: varchar("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    contactId: integer("contact_id").notNull(),
    revealedAt: timestamp("revealed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("contact_reveals_user_contact_unique").on(table.userId, table.contactId),
  ],
);

export type ContactReveal = typeof contactRevealsTable.$inferSelect;
