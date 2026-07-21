import { pgTable, serial, text, varchar, timestamp, unique } from "drizzle-orm/pg-core";

export const userEmailAccountsTable = pgTable("user_email_accounts", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  provider: varchar("provider", { length: 20 }).notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  displayName: varchar("display_name", { length: 200 }),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token"),
  tokenExpiry: timestamp("token_expiry", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  uniqueUserProvider: unique("uq_user_email_accounts_user_provider").on(t.userId, t.provider),
}));

export type UserEmailAccountRow = typeof userEmailAccountsTable.$inferSelect;
