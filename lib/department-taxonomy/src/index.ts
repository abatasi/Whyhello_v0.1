export interface DepartmentNode {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  level: 1 | 2 | 3;
  aliases: string[];
  isActive: boolean;
  sortOrder: number;
  relatedNodeIds?: string[];
}

export const normalizeTerm = (value: string): string =>
  value.normalize("NFKD").toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");

export function validateHierarchy(nodes: DepartmentNode[]): void {
  const index = new Map(nodes.map(n => [n.id, n]));
  if (index.size !== nodes.length) throw new Error("Duplicate taxonomy ID");
  for (const node of nodes) {
    if (!node.id || !node.name.trim() || node.level < 1 || node.level > 3) throw new Error("Invalid taxonomy node");
    const parent = node.parentId ? index.get(node.parentId) : undefined;
    if (node.parentId && (!parent || parent.level !== node.level - 1)) throw new Error(`Invalid parent for ${node.id}`);
    if (!node.parentId && node.level !== 1) throw new Error(`Missing parent for ${node.id}`);
    const seen = new Set([node.id]);
    let current = parent;
    while (current) {
      if (seen.has(current.id)) throw new Error("Circular taxonomy");
      seen.add(current.id);
      current = current.parentId ? index.get(current.parentId) : undefined;
    }
  }
}

export function descendants(nodes: DepartmentNode[], id: string): string[] {
  const result = new Set<string>();
  const visit = (next: string) => {
    if (result.has(next)) return;
    result.add(next);
    nodes.filter(n => n.parentId === next).forEach(n => visit(n.id));
  };
  if (nodes.some(n => n.id === id)) visit(id);
  return [...result];
}

export function pathFor(nodes: DepartmentNode[], id: string): DepartmentNode[] {
  const path: DepartmentNode[] = [];
  const seen = new Set<string>();
  let node = nodes.find(n => n.id === id);
  while (node && !seen.has(node.id)) {
    seen.add(node.id);
    path.unshift(node);
    node = nodes.find(n => n.id === node!.parentId);
  }
  return path;
}

export function resolveAlias(nodes: DepartmentNode[], value: string, departmentId?: string): DepartmentNode | undefined {
  const term = normalizeTerm(value);
  const matches = nodes.filter(n => n.isActive &&
    (!departmentId || pathFor(nodes, n.id)[0]?.id === departmentId) &&
    [n.id, n.slug, n.name, ...n.aliases, pathFor(nodes, n.id).map(p => p.name).join(" / ")].some(v => normalizeTerm(v) === term));
  // Ambiguous cross-department labels require context rather than a guess.
  return matches.length === 1 ? matches[0] : undefined;
}

export function searchNodes(nodes: DepartmentNode[], query: string): DepartmentNode[] {
  const terms = normalizeTerm(query).split(" ").filter(Boolean);
  return nodes.filter(n => n.isActive && terms.every(term =>
    normalizeTerm([n.name, n.slug, ...n.aliases].join(" ")).split(" ").some(word => word.startsWith(term))));
}

/** Expand compact parent selections to all covered IDs, retaining unknown legacy values. */
export function expandSelection(nodes: DepartmentNode[], selected: string[]): Set<string> {
  return new Set(selected.flatMap(id => descendants(nodes, id).length ? descendants(nodes, id) : [id]));
}

export function selectionState(nodes: DepartmentNode[], selected: string[], id: string): boolean | "indeterminate" {
  const covered = expandSelection(nodes, selected);
  const branch = descendants(nodes, id);
  const leaves = branch.filter(key => !nodes.some(n => n.parentId === key));
  const count = leaves.filter(key => covered.has(key)).length;
  return count === leaves.length && count > 0 ? true : count > 0 ? "indeterminate" : false;
}

/** Store highest complete parents; never generate hundreds of selected chips. */
export function compactSelection(nodes: DepartmentNode[], ids: Iterable<string>): string[] {
  const selected = new Set(ids);
  const result: string[] = [];
  const visit = (node: DepartmentNode) => {
    if (selectionState(nodes, [...selected], node.id) === true) result.push(node.id);
    else nodes.filter(n => n.parentId === node.id).forEach(visit);
  };
  nodes.filter(n => !n.parentId).forEach(visit);
  for (const id of selected) if (!nodes.some(n => n.id === id)) result.push(id);
  return result;
}

export function toggleSelection(nodes: DepartmentNode[], selected: string[], id: string): string[] {
  const expanded = expandSelection(nodes, selected);
  const removing = selectionState(nodes, selected, id) === true;
  const branch = descendants(nodes, id);
  // Parent markers must not reselect a child that is being unchecked.
  const leaves = new Set([...expanded].filter(key => !nodes.some(n => n.parentId === key)));
  for (const key of branch.filter(key => !nodes.some(n => n.parentId === key))) {
    if (removing) leaves.delete(key); else leaves.add(key);
  }
  return compactSelection(nodes, leaves);
}

export interface DepartmentClassification {
  primaryDepartment: string | null;
  primaryFunction: string | null;
  primarySpecialization: string | null;
  secondaryDepartments: string[];
  secondaryFunctions: string[];
  secondarySpecializations: string[];
  classificationConfidence: number | null;
  needsReview: boolean;
  rawValues: string[];
}

export function validateClassification(nodes: DepartmentNode[], c: DepartmentClassification): void {
  const check = (id: string | null, level: number) => {
    if (!id) return;
    if (!nodes.some(n => n.id === id && n.level === level && n.isActive)) throw new Error(`Invalid level ${level} node: ${id}`);
  };
  check(c.primaryDepartment, 1); check(c.primaryFunction, 2); check(c.primarySpecialization, 3);
  c.secondaryDepartments.forEach(id => check(id, 1));
  c.secondaryFunctions.forEach(id => check(id, 2));
  c.secondarySpecializations.forEach(id => check(id, 3));
  if ((c.primaryFunction || c.primarySpecialization || c.secondaryDepartments.length || c.secondaryFunctions.length || c.secondarySpecializations.length) && !c.primaryDepartment) throw new Error("Primary department is required");
  if (!c.primaryDepartment && !c.needsReview) throw new Error("Unclassified contacts must be flagged for review");
  if (c.primaryFunction && pathFor(nodes, c.primaryFunction)[0]?.id !== c.primaryDepartment) throw new Error("Function belongs to another department");
  if (c.primarySpecialization && nodes.find(n => n.id === c.primarySpecialization)?.parentId !== c.primaryFunction) throw new Error("Specialization belongs to another function");
  for (const id of c.secondaryFunctions) {
    if (![c.primaryDepartment, ...c.secondaryDepartments].includes(pathFor(nodes, id)[0]?.id)) throw new Error("Secondary function requires its department");
  }
  for (const id of c.secondarySpecializations) {
    if (![c.primaryFunction, ...c.secondaryFunctions].includes(nodes.find(n => n.id === id)?.parentId ?? null)) throw new Error("Secondary specialization requires its function");
  }
}

export function normalizeClassification(nodes: DepartmentNode[], values: string[]): DepartmentClassification {
  const rawValues = values.filter(v => v.trim());
  const found: DepartmentNode[] = [];
  let needsReview = false;
  const contextDepartments = [...new Set(rawValues.flatMap(value => {
    const known = resolveAlias(nodes, value);
    return known ? [pathFor(nodes, known.id)[0]!.id] : [];
  }))];
  for (const value of rawValues) {
    const contextual = contextDepartments.map(id => resolveAlias(nodes, value, id)).filter((n): n is DepartmentNode => !!n);
    const node = resolveAlias(nodes, value, found[0] ? pathFor(nodes, found[0].id)[0]?.id : undefined)
      ?? (contextual.length === 1 ? contextual[0] : resolveAlias(nodes, value));
    if (node) found.push(node); else needsReview = true;
  }
  const paths = found.map(n => pathFor(nodes, n.id));
  const root = paths[0]?.[0]?.id;
  const primary = paths.filter(p => p[0]?.id === root).sort((a, b) => b.length - a.length)[0] ?? [];
  const unique = (level: number) => [...new Set(paths.flatMap(p => p.filter(n => n.level === level && !primary.some(x => x.id === n.id)).map(n => n.id)))];
  return {
    primaryDepartment: primary[0]?.id ?? null,
    primaryFunction: primary[1]?.id ?? null,
    primarySpecialization: primary[2]?.id ?? null,
    secondaryDepartments: unique(1), secondaryFunctions: unique(2), secondarySpecializations: unique(3),
    classificationConfidence: null,
    needsReview: needsReview || !primary.length, rawValues,
  };
}

/** Only unambiguous evidence is inferred; raw titles and department values remain untouched. */
export function classifyContact(nodes: DepartmentNode[], input: { department?: string | null; jobTitle?: string | null; additionalValues?: string[] }): DepartmentClassification {
  const values = [input.department ?? "", ...input.additionalValues ?? []].filter(Boolean);
  const base = normalizeClassification(nodes, values);
  const title = ` ${normalizeTerm(input.jobTitle ?? "")} `;
  const matches = nodes.filter(n => n.isActive && n.level > 1 && [n.name, ...n.aliases].some(label =>
    normalizeTerm(label).length >= 3 && title.includes(` ${normalizeTerm(label)} `)));
  const position = (node: DepartmentNode) => Math.min(...[node.name, ...node.aliases].map(label => {
    const at = title.indexOf(` ${normalizeTerm(label)} `);
    return at < 0 ? Infinity : at;
  }));
  for (const match of matches.sort((a, b) => position(a) - position(b) || b.name.length - a.name.length)) {
    const ambiguous = nodes.filter(n => n.isActive && normalizeTerm(n.name) === normalizeTerm(match.name)).length > 1;
    if (ambiguous && pathFor(nodes, match.id)[0]?.id !== base.primaryDepartment) continue;
    if (!values.includes(match.id)) values.push(match.id);
  }
  if (!values.length) {
    const departments = nodes.filter(n => n.isActive && n.level === 1 && [n.name, ...n.aliases].some(label =>
      normalizeTerm(label).length >= 3 && title.includes(` ${normalizeTerm(label)} `)));
    if (departments.length === 1) values.push(departments[0]!.id);
  }
  const result = normalizeClassification(nodes, values);
  result.rawValues = [input.department ?? "", ...input.additionalValues ?? []].filter(Boolean);
  return result;
}
