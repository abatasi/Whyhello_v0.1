import { Router, type IRouter } from "express";
import { requireAuth } from "../middlewares/requireAuth";
import healthRouter from "./health";
import contactsRouter from "./contacts";
import companiesRouter from "./companies";
import filtersRouter from "./filters";
import insightsRouter from "./insights";
import industryInsightsRouter from "./industry-insights";
import roleInsightsRouter from "./role-insights";
import colleagueInsightsRouter from "./colleague-insights";
import counterpartInsightsRouter from "./counterpart-insights";
import contactChatRouter from "./contact-chat";
import savedSearchesRouter from "./saved-searches";
import listsRouter from "./lists";
import exportsRouter from "./exports";
import creditsRouter from "./credits";
import companyInsightsRouter from "./company-insights";
import messagesRouter from "./messages";
import insightDropsRouter from "./insight-drops";
import { contactJobsRouter, jobsRouter } from "./outreach-jobs";
import battlecardRouter from "./battlecard";
import contactChatMessagesRouter from "./contact-chat-messages";
import insightSummarizeRouter from "./insight-summarize";
import relevanceRouter from "./relevance";
import quotesRouter from "./quotes";
import dnaRouter from "./dna";
import emailAccountsRouter from "./email-accounts";
import bulkUploadRouter from "./bulk-upload";
import industriesRouter from "./industries";
import rolesRouter from "./roles";
import proxyRouter from "./proxy";
import metaRouter from "./meta";
import trackRouter from "./track";
import { contactMessagesRouter } from "./messages";
import { sequencesRouter } from "./sequences";

const router: IRouter = Router();

// ── Tracking (public — pixel/redirect loaded by email clients without cookies) ──
router.use("/track", trackRouter);

// ── Public routes (no auth required) ────────────────────────────────────────
router.use(healthRouter);
// Contacts and companies are publicly readable (public profile pages for unauthenticated users)
router.use("/contacts", contactsRouter);
router.use("/companies", companiesRouter);
// Reference data — filters are read-only and publicly accessible
router.use("/filters", filtersRouter);
// Proxy for external requests (no sensitive data)
router.use("/proxy", proxyRouter);

// ── Private routes (requireAuth enforces Clerk session + JIT provisioning) ───
router.use("/contacts/:contactId/insights", requireAuth, insightsRouter);
router.use("/contacts/:contactId/industry-insights", requireAuth, industryInsightsRouter);
router.use("/contacts/:contactId/role-insights", requireAuth, roleInsightsRouter);
router.use("/contacts/:contactId/colleague-insights", requireAuth, colleagueInsightsRouter);
router.use("/contacts/:contactId/counterpart-insights", requireAuth, counterpartInsightsRouter);
router.use("/contacts/:contactId/chat", requireAuth, contactChatRouter);
router.use("/companies/:companyId/insights", requireAuth, companyInsightsRouter);
router.use("/saved-searches", requireAuth, savedSearchesRouter);
router.use("/lists", requireAuth, listsRouter);
router.use("/exports", requireAuth, exportsRouter);
router.use("/credits", requireAuth, creditsRouter);
router.use("/messages", requireAuth, messagesRouter);
router.use("/insight-drops", requireAuth, insightDropsRouter);
router.use("/contacts/:contactId/outreach-jobs", requireAuth, contactJobsRouter);
router.use("/contacts/:contactId/battlecard", requireAuth, battlecardRouter);
router.use("/contacts/:contactId/chat-messages", requireAuth, contactChatMessagesRouter);
router.use("/contacts/:contactId/insights", requireAuth, relevanceRouter);
router.use("/contacts/:contactId/insights", requireAuth, quotesRouter);
router.use("/outreach-jobs", requireAuth, jobsRouter);
router.use("/insights/summarize", requireAuth, insightSummarizeRouter);
router.use("/hq", requireAuth, dnaRouter);
router.use("/email-accounts", requireAuth, emailAccountsRouter);
router.use("/bulk-upload", requireAuth, bulkUploadRouter);
router.use("/meta", requireAuth, metaRouter);
// Reference data mutations require auth; reads are also behind auth (reference data for authenticated UI only)
router.use("/industries", requireAuth, industriesRouter);
router.use("/roles", requireAuth, rolesRouter);
router.use("/contacts/:contactId/sent-messages", requireAuth, contactMessagesRouter);
router.use("/sequences", requireAuth, sequencesRouter);

export default router;
