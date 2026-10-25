import { ilike, or, sql } from "drizzle-orm";
import { contactsTable, companiesTable } from "@workspace/db/schema";

/** Shared by autocomplete/directory searches and the revealed-recipient picker. */
export function contactTextSearchCondition(query: unknown, includeProfessionalFields = false) {
  if (typeof query !== "string") return undefined;
  const normalized = query.trim().replace(/\s+/g, " ");
  if (!normalized) return undefined;
  const pattern = `%${normalized.replace(/[\\%_]/g, "\\$&")}%`;
  const fullName = sql<string>`regexp_replace(trim(concat_ws(' ', ${contactsTable.firstName}, ${contactsTable.lastName})), '\\s+', ' ', 'g')`;
  return or(
    ilike(fullName, pattern),
    ilike(contactsTable.email, pattern),
    ...(includeProfessionalFields ? [
      ilike(contactsTable.jobTitle, pattern),
      ilike(companiesTable.name, pattern),
    ] : []),
  );
}
