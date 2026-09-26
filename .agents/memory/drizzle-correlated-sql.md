---
name: Drizzle correlated SQL qualifiers
description: Avoid ambiguous column references in correlated subqueries inside aggregate projections.
---

When a Drizzle SQL template interpolates a table column inside an aggregate SELECT projection with a correlated EXISTS subquery, inspect the generated SQL: the column may be emitted as an unqualified name. In a subquery that joins other tables containing the same column, PostgreSQL can reject it as ambiguous.

**Why:** A saved-record count worked for anonymous requests but failed for signed-in users because the authenticated aggregate branch included correlated subqueries and the outer record ID lost its table qualifier.

**How to apply:** For correlated aggregate counts, use an explicitly qualified outer-table reference in the SQL fragment (only a known, fixed identifier, never user input) and verify the authenticated branch, not just the anonymous response.