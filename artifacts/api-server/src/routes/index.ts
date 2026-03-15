import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import contactsRouter from "./contacts";
import companiesRouter from "./companies";
import filtersRouter from "./filters";
import insightsRouter from "./insights";
import savedSearchesRouter from "./saved-searches";
import listsRouter from "./lists";
import exportsRouter from "./exports";
import creditsRouter from "./credits";
import companyInsightsRouter from "./company-insights";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use("/contacts", contactsRouter);
router.use("/contacts/:contactId/insights", insightsRouter);
router.use("/companies", companiesRouter);
router.use("/companies/:companyId/insights", companyInsightsRouter);
router.use("/filters", filtersRouter);
router.use("/saved-searches", savedSearchesRouter);
router.use("/lists", listsRouter);
router.use("/exports", exportsRouter);
router.use("/credits", creditsRouter);

export default router;
