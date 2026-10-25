---
name: Drizzle parameterized grouping
description: PostgreSQL grouping of repeated SQL expressions with bound parameters
---

Group a parameterized computed SELECT expression by its selected alias or ordinal rather than interpolating the expression again.

**Why:** Drizzle emits different parameter positions for each interpolation. PostgreSQL can then treat otherwise identical CASE expressions in SELECT and GROUP BY as different expressions and reject the aggregate.

**How to apply:** For aggregate counts over a computed category, select the category first and group by that selected result, or calculate it in a subquery before aggregating.
