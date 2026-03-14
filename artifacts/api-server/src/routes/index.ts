import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import contactsRouter from "./contacts";
import companiesRouter from "./companies";
import filtersRouter from "./filters";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use("/contacts", contactsRouter);
router.use("/companies", companiesRouter);
router.use("/filters", filtersRouter);

export default router;
