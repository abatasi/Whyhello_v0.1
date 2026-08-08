import app from "./app";
import { seedIfEmpty, seedInsightsIfEmpty, seedCompanyInsightsIfEmpty, seedCategoryInsightsIfEmpty, seedIndustriesAndRolesIfEmpty } from "./lib/seed";
import { seedProductionContactsIfNeeded } from "./lib/seed-contacts";
import { seedProductionContactInsightsIfNeeded } from "./lib/seed-contact-insights";
import { seedFaisalKarmali } from "./lib/seed-faisal";

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
    console.log("\n📞 Twilio Voice — Webhook URLs to configure in Twilio Console:");
    console.log("   TwiML App Voice URL:  <your-domain>/api/calls/outbound-twiml  (POST)");
    console.log("   Status Callback:      set per-call automatically");
    console.log("   Recording Callback:   set per-call automatically");
    console.log("   TwiML App SID:", process.env.TWILIO_TWIML_APP_SID);
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
    .catch((err) => {
      console.error("Seed failed:", err);
    });
});
