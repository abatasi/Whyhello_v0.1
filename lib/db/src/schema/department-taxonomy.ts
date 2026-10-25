import { pgTable, text, integer, boolean, timestamp, real, type AnyPgColumn, check, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { contactsTable } from "./contacts";

export const departmentTaxonomyTable = pgTable("department_taxonomy", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  parentId: text("parent_id").references((): AnyPgColumn => departmentTaxonomyTable.id),
  level: integer("level").notNull(),
  aliases: text("aliases").array().notNull().default(sql`'{}'::text[]`),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  relatedNodeIds: text("related_node_ids").array().notNull().default(sql`'{}'::text[]`),
}, t => [
  check("department_taxonomy_level_check", sql`${t.level} between 1 and 3`),
  check("department_taxonomy_parent_check", sql`(${t.level} = 1 and ${t.parentId} is null) or (${t.level} > 1 and ${t.parentId} is not null and ${t.parentId} <> ${t.id})`),
  index("department_taxonomy_parent_idx").on(t.parentId),
]);

export const contactDepartmentClassificationsTable = pgTable("contact_department_classifications", {
  contactId: integer("contact_id").primaryKey().references(() => contactsTable.id, { onDelete: "cascade" }),
  primaryDepartment: text("primary_department").references(() => departmentTaxonomyTable.id),
  primaryFunction: text("primary_function").references(() => departmentTaxonomyTable.id),
  primarySpecialization: text("primary_specialization").references(() => departmentTaxonomyTable.id),
  secondaryDepartments: text("secondary_departments").array().notNull().default(sql`'{}'::text[]`),
  secondaryFunctions: text("secondary_functions").array().notNull().default(sql`'{}'::text[]`),
  secondarySpecializations: text("secondary_specializations").array().notNull().default(sql`'{}'::text[]`),
  classificationConfidence: real("classification_confidence"),
  needsReview: boolean("needs_review").notNull().default(true),
  rawValues: text("raw_values").array().notNull().default(sql`'{}'::text[]`),
  taxonomyVersion: integer("taxonomy_version").notNull(),
  sourceSignature: text("source_signature").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [
  index("contact_department_primary_idx").on(t.primaryDepartment),
  check("contact_department_confidence_check", sql`${t.classificationConfidence} is null or ${t.classificationConfidence} between 0 and 1`),
]);

export const departmentTaxonomyMigrationsTable = pgTable("department_taxonomy_migrations", {
  version: integer("version").primaryKey(),
  appliedAt: timestamp("applied_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertDepartmentTaxonomySchema = createInsertSchema(departmentTaxonomyTable);
export const insertContactDepartmentClassificationSchema = createInsertSchema(contactDepartmentClassificationsTable);
export type DepartmentTaxonomyRecord = typeof departmentTaxonomyTable.$inferSelect;
export type InsertDepartmentTaxonomy = z.infer<typeof insertDepartmentTaxonomySchema>;
export type ContactDepartmentClassificationRecord = typeof contactDepartmentClassificationsTable.$inferSelect;
