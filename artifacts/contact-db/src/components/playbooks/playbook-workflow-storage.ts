/** Restore persisted workflow data without inserting retired graph scaffolding. */
export function readStoredWorkflow<Node, Edge, Prospect>(raw: string): {
  nodes: Node[]; edges: Edge[]; prospects: Prospect[];
} {
  const value = JSON.parse(raw);
  if (!value || !Array.isArray(value.nodes)) throw new Error("Saved workflow has no step list.");
  if (value.edges != null && !Array.isArray(value.edges)) throw new Error("Saved workflow edges are invalid.");
  if (value.prospects != null && !Array.isArray(value.prospects)) throw new Error("Saved workflow prospects are invalid.");
  return { nodes: value.nodes, edges: value.edges ?? [], prospects: value.prospects ?? [] };
}