import { pgTable, text, serial, integer, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { companiesTable } from "./companies";
import { roleInsightsTable } from "./role-insights";

export const contactsTable = pgTable("contacts", {
  id: serial("id").primaryKey(),
  firstName: varchar("first_name", { length: 100 }).notNull(),
  lastName: varchar("last_name", { length: 100 }).notNull(),
  roleId: integer("role_id").references(() => roleInsightsTable.id),
  jobTitle: varchar("job_title", { length: 200 }),
  department: varchar("department", { length: 100 }),
  seniority: varchar("seniority", { length: 50 }),
  email: varchar("email", { length: 255 }),
  phone: varchar("phone", { length: 50 }),
  location: varchar("location", { length: 255 }),
  country: varchar("country", { length: 100 }),
  linkedinUrl: varchar("linkedin_url", { length: 500 }),
  twitterHandle: varchar("twitter_handle", { length: 100 }),
  bio: text("bio"),
  companyId: integer("company_id").references(() => companiesTable.id),
});

export const insertContactSchema = createInsertSchema(contactsTable).omit({ id: true });
export type InsertContact = z.infer<typeof insertContactSchema>;
export type Contact = typeof contactsTable.$inferSelect;
