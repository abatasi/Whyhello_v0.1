import { pgTable, serial, varchar, integer, timestamp, unique } from "drizzle-orm/pg-core";
import { contactsTable } from "./contacts";
import { companiesTable } from "./companies";

export const listsTable = pgTable("lists", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  type: varchar("type", { length: 20 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const listContactsTable = pgTable("list_contacts", {
  id: serial("id").primaryKey(),
  listId: integer("list_id").notNull().references(() => listsTable.id, { onDelete: "cascade" }),
  contactId: integer("contact_id").notNull().references(() => contactsTable.id, { onDelete: "cascade" }),
}, (t) => [unique().on(t.listId, t.contactId)]);

export const listCompaniesTable = pgTable("list_companies", {
  id: serial("id").primaryKey(),
  listId: integer("list_id").notNull().references(() => listsTable.id, { onDelete: "cascade" }),
  companyId: integer("company_id").notNull().references(() => companiesTable.id, { onDelete: "cascade" }),
}, (t) => [unique().on(t.listId, t.companyId)]);

export type List = typeof listsTable.$inferSelect;
export type ListContact = typeof listContactsTable.$inferSelect;
export type ListCompany = typeof listCompaniesTable.$inferSelect;
