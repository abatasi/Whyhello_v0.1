import app from "./app";
import { seedIfEmpty, seedInsightsIfEmpty, seedCompanyInsightsIfEmpty, seedCategoryInsightsIfEmpty, seedIndustriesAndRolesIfEmpty } from "./lib/seed";
import { seedProductionContactsIfNeeded } from "./lib/seed-contacts";
import { seedProductionContactInsightsIfNeeded } from "./lib/seed-contact-insights";
import { seedFaisalKarmali } from "./lib/seed-faisal";
import { ensureDepartmentTaxonomy } from "./lib/department-taxonomy";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);

  // ── Twilio webhook setup info ────────────────────────────────────────────
  const twilioConfigured = !!(
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_API_KEY &&
    process.env.TWILIO_API_SECRET &&
    process.env.TWILIO_TWIML_APP_SID &&
    process.env.TWILIO_PHONE_NUMBER
  );
  if (twilioConfigured) {
    const base = process.env.TWILIO_WEBHOOK_BASE_URL?.replace(/\/$/, "")
      ?? `https://${process.env.REPLIT_DEV_DOMAIN ?? "<your-domain>"}`;
    console.log("\n📞 Twilio Voice — configure these in the Twilio Console:");
    console.log(`   TwiML App Voice URL:  ${base}/api/calls/outbound-twiml  (HTTP POST)`);
    console.log(`   TwiML App SID: ${process.env.TWILIO_TWIML_APP_SID}`);
    if (!process.env.TWILIO_WEBHOOK_BASE_URL) {
      console.log("   ⚠️  Set TWILIO_WEBHOOK_BASE_URL to your public domain for reliable webhook signature validation.");
      console.log(`      e.g. TWILIO_WEBHOOK_BASE_URL=https://${process.env.REPLIT_DEV_DOMAIN ?? "<your-domain>"}`);
    }
    console.log("");
  } else {
    console.log("\n📞 Twilio Voice: Not configured. Add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN,");
    console.log("   TWILIO_PHONE_NUMBER, TWILIO_API_KEY, TWILIO_API_SECRET, TWILIO_TWIML_APP_SID\n");
  }
  seedIfEmpty()
    .then(() => seedInsightsIfEmpty())
    .then(() => seedCompanyInsightsIfEmpty())
    .then(() => seedCategoryInsightsIfEmpty())
    .then(() => seedIndustriesAndRolesIfEmpty())
    .then(() => seedProductionContactsIfNeeded())
    .then(() => seedProductionContactInsightsIfNeeded())
    .then(() => seedFaisalKarmali())
    .then(() => ensureDepartmentTaxonomy())
    .catch((err) => {
      console.error("Seed failed:", err);
    });
});
