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
