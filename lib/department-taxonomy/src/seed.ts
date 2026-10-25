import data from "./seed-data.json" with { type: "json" };
import type { DepartmentNode } from "./index.js";

// IDs are committed seed data, never derived from editable display labels.
export const DEPARTMENT_TAXONOMY_VERSION = 1;
export const DEPARTMENT_SEED = data as DepartmentNode[];
