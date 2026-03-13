import { pgTable, text, serial, integer, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const companiesTable = pgTable("companies", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  industry: varchar("industry", { length: 100 }),
  size: varchar("size", { length: 50 }),
  location: varchar("location", { length: 255 }),
  country: varchar("country", { length: 100 }),
  website: varchar("website", { length: 500 }),
  description: text("description"),
  employeeCount: integer("employee_count"),
  foundedYear: integer("founded_year"),
  linkedinUrl: varchar("linkedin_url", { length: 500 }),
});

export const insertCompanySchema = createInsertSchema(companiesTable).omit({ id: true });
export type InsertCompany = z.infer<typeof insertCompanySchema>;
export type Company = typeof companiesTable.$inferSelect;
