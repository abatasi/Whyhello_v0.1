import assert from "node:assert/strict";
import { test } from "node:test";
import { DEPARTMENT_SEED } from "@workspace/department-taxonomy/seed";
import { validateHierarchy, descendants, pathFor, resolveAlias, selectionState, toggleSelection, compactSelection, searchNodes, normalizeClassification, classifyContact, validateClassification, type DepartmentNode } from "@workspace/department-taxonomy";

const nodes = DEPARTMENT_SEED;
const enterprise = "sales__enterprise_sales";

test("seed contains every requested department/function with unique stable IDs", () => {
  validateHierarchy(nodes);
  assert.equal(nodes.filter(n => n.level === 1).length, 24);
  assert.equal(nodes.filter(n => n.level === 2).length, 387);
  assert(!nodes.some(n => n.name === "C-Suite"));
});

test("hierarchy rejects duplicate, missing, invalid and circular parents", () => {
  assert.throws(() => validateHierarchy([...nodes, nodes[0]!]));
  assert.throws(() => validateHierarchy([{ ...nodes[0]!, parentId: "missing" }]));
  assert.throws(() => validateHierarchy([{ ...nodes[0]!, parentId: nodes[0]!.id }]));
});

test("parent selection covers descendants; unchecking a child makes parent mixed", () => {
  let selection = toggleSelection(nodes, [], "sales");
  assert.deepEqual(selection, ["sales"]);
  assert.equal(selectionState(nodes, selection, enterprise), true);
  selection = toggleSelection(nodes, selection, enterprise);
  assert.equal(selectionState(nodes, selection, "sales"), "indeterminate");
  assert.equal(selectionState(nodes, selection, enterprise), false);
  selection = toggleSelection(nodes, selection, enterprise);
  assert.deepEqual(selection, ["sales"]);
  selection = toggleSelection(nodes, selection, "sales");
  assert.deepEqual(selection, []);
});

test("multiple departments compact without losing unknown saved values", () => {
  const selection = toggleSelection(nodes, ["sales", "Legacy raw department"], "marketing");
  assert.deepEqual(new Set(selection), new Set(["sales", "marketing", "Legacy raw department"]));
  assert.deepEqual(compactSelection(nodes, descendants(nodes, "sales")), ["sales"]);
});

test("aliases resolve contextually; ambiguous labels are never guessed", () => {
  assert.equal(resolveAlias(nodes, "HR")?.id, "human_resources_people");
  assert.equal(resolveAlias(nodes, "People & Culture")?.id, "human_resources_people");
  assert.equal(resolveAlias(nodes, "RevOps")?.id, "sales__revenue_operations");
  assert.equal(resolveAlias(nodes, "FP&A")?.parentId, "finance_accounting");
  assert.equal(resolveAlias(nodes, "IT")?.id, "information_technology");
  assert.equal(resolveAlias(nodes, "InfoSec")?.id, "information_technology__information_security");
  assert.equal(resolveAlias(nodes, "Regulatory Affairs"), undefined);
  assert.equal(resolveAlias(nodes, "Regulatory Affairs", "legal_compliance")?.parentId, "legal_compliance");
  assert.equal(resolveAlias(nodes, "QA"), undefined);
});

test("search matches aliases and hierarchy can preserve ancestor context", () => {
  const found = searchNodes(nodes, "SDR");
  assert(found.some(n => n.id === "sales__sales_development_sdr_bdr"));
  assert.equal(pathFor(nodes, found[0]!.id)[0]!.id, "sales");
  assert.equal(searchNodes(nodes, "QA").length, 2);
});

test("classification preserves unknown raw sources and does not invent confidence", () => {
  const unknown = normalizeClassification(nodes, ["Private Wealth"]);
  assert.deepEqual(unknown.rawValues, ["Private Wealth"]);
  assert.equal(unknown.primaryDepartment, null);
  assert.equal(unknown.needsReview, true);
  assert.equal(unknown.classificationConfidence, null);
  validateClassification(nodes, unknown);
  const known = normalizeClassification(nodes, ["Sales", "Enterprise Sales", "Strategic Partnerships"]);
  assert.equal(known.primaryFunction, enterprise);
  assert.deepEqual(known.secondaryDepartments, ["business_development_partnerships"]);
  validateClassification(nodes, known);
  const contextual = normalizeClassification(nodes, ["Sales", "Quality & Regulatory", "Regulatory Affairs"]);
  assert(contextual.secondaryFunctions.includes("quality_regulatory__regulatory_affairs"));
  assert.equal(contextual.needsReview, false);
});

test("title evidence supports cross-department functions without changing title/seniority", () => {
  const input = { jobTitle: "VP, Global Enterprise Sales & Strategic Partnerships" };
  const classification = classifyContact(nodes, input);
  assert.equal(classification.primaryDepartment, "sales");
  assert.equal(classification.primaryFunction, enterprise);
  assert(classification.secondaryDepartments.includes("business_development_partnerships"));
  assert.equal(input.jobTitle, "VP, Global Enterprise Sales & Strategic Partnerships");
  assert.equal(classifyContact(nodes, { jobTitle: "Chief Technology Officer" }).needsReview, true);
  assert.equal(classifyContact(nodes, { jobTitle: "QA Engineer" }).needsReview, true);
});

test("level three specialization selection and path validation are reusable", () => {
  const tree: DepartmentNode[] = [...nodes, { id: "sales-enterprise-global", name: "Global Enterprise", slug: "global-enterprise", parentId: enterprise, level: 3, aliases: [], isActive: true, sortOrder: 1 }];
  validateHierarchy(tree);
  assert(descendants(tree, "sales").includes("sales-enterprise-global"));
  const c = normalizeClassification(tree, ["Global Enterprise"]);
  validateClassification(tree, c);
  assert.equal(c.primarySpecialization, "sales-enterprise-global");
  assert.throws(() => validateClassification(tree, { ...c, primaryDepartment: "marketing" }));
  assert.throws(() => validateClassification(tree, { ...c, primaryFunction: null }));
});
