import { Router, type Request, type Response, type NextFunction } from "express";
import { hasMasterAccess } from "../lib/master-access.js";
import {
  activateHqConfiguration, createHqConfiguration, deleteHqConfiguration,
  listHqConfigurations, readHqConfiguration, renameHqConfiguration,
  saveHqConfiguration, HqConfigurationError,
} from "../lib/hq-configurations.js";
import { prepareVoicePersonaProfile } from "../lib/voice-personas.js";

const router = Router();
router.use(async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (await hasMasterAccess(req)) { next(); return; }
    if (req.method === "GET" && req.path === "/") {
      res.json({ canManage: false, liveId: null, items: [] }); return;
    }
    res.status(403).json({ error: "Multiple HQs are available only to the master account" });
  } catch {
    res.status(503).json({ error: "Unable to verify master access. Try again." });
  }
});

function route(action: (req: Request) => Promise<unknown>) {
  return async (req: Request, res: Response) => {
    try { res.json(await action(req)); }
    catch (error) {
      res.status(error instanceof HqConfigurationError ? error.status : 500)
        .json({ error: error instanceof HqConfigurationError ? error.message : "Unable to update HQ configurations" });
    }
  };
}
router.get("/", route(req => listHqConfigurations(req.dbUser!.id)));
router.post("/", route(req => createHqConfiguration(req.dbUser!.id, req.body ?? {})));
router.patch("/:id", route(req => renameHqConfiguration(req.dbUser!.id, String(req.params.id), req.body?.name)));
router.delete("/:id", route(req => deleteHqConfiguration(req.dbUser!.id, String(req.params.id))));
router.post("/:id/activate", route(req => activateHqConfiguration(req.dbUser!.id, String(req.params.id), req.body?.expectedLiveId)));
router.get("/:id/profile", route(req => readHqConfiguration(req.dbUser!.id, String(req.params.id))));
router.put("/:id/profile", route(req => {
  if (!req.body?.data || typeof req.body.data !== "object" || Array.isArray(req.body.data))
    throw new HqConfigurationError(400, "HQ data must be an object");
  const prepared = prepareVoicePersonaProfile(req.body.data);
  if (!prepared.ok) throw new HqConfigurationError(400, prepared.error);
  return saveHqConfiguration(req.dbUser!.id, String(req.params.id), prepared.data, req.header("X-Profile-Revision"));
}));
export default router;
