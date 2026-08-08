import { pgTable, serial, integer, text, timestamp, jsonb, varchar, unique } from "drizzle-orm/pg-core";
import { contactsTable } from "./contacts";

export const sequencesTable = pgTable("sequences", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  status: varchar("status", { length: 20 }).notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sequenceStepsTable = pgTable("sequence_steps", {
  id: serial("id").primaryKey(),
  sequenceId: integer("sequence_id").notNull().references(() => sequencesTable.id, { onDelete: "cascade" }),
  position: integer("position").notNull().default(0),
  delayDays: integer("delay_days").notNull().default(0),
  subject: text("subject").notNull().default(""),
  body: text("body").notNull().default(""),
  generationParams: jsonb("generation_params"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sequenceEnrollmentsTable = pgTable("sequence_enrollments", {
  id: serial("id").primaryKey(),
  sequenceId: integer("sequence_id").notNull().references(() => sequencesTable.id, { onDelete: "cascade" }),
  contactId: integer("contact_id").notNull().references(() => contactsTable.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull(),
  currentStep: integer("current_step").notNull().default(0),
  status: varchar("status", { length: 20 }).notNull().default("active"),
  enrolledAt: timestamp("enrolled_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [unique().on(t.sequenceId, t.contactId)]);

export type Sequence = typeof sequencesTable.$inferSelect;
export type SequenceStep = typeof sequenceStepsTable.$inferSelect;
export type SequenceEnrollment = typeof sequenceEnrollmentsTable.$inferSelect;
