import { Router, type IRouter } from "express";
import { descendants, pathFor, searchNodes } from "@workspace/department-taxonomy";
import { ensureDepartmentTaxonomy, getDepartmentNodes } from "../lib/department-taxonomy";

const router: IRouter = Router();

router.get("/", async (req, res, next): Promise<void> => {
  try {
    await ensureDepartmentTaxonomy();
    const all = (await getDepartmentNodes()).filter(n => n.isActive);
    let nodes = all;
    if (typeof req.query.id === "string") {
      const ids = req.query.descendants === "true" ? descendants(all, req.query.id) : [req.query.id];
      nodes = nodes.filter(n => ids.includes(n.id));
    }
    if (typeof req.query.parentId === "string") nodes = nodes.filter(n => n.parentId === req.query.parentId);
    if (typeof req.query.q === "string" && req.query.q.trim()) {
      const ids = new Set(searchNodes(all, req.query.q).flatMap(n => pathFor(all, n.id).map(p => p.id)));
      nodes = nodes.filter(n => ids.has(n.id));
    }
    res.set("Cache-Control", "public, max-age=60").json(nodes);
  } catch (error) { next(error); }
});

export default router;
