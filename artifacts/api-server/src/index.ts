import app from "./app";
import { seedIfEmpty, seedInsightsIfEmpty, seedCompanyInsightsIfEmpty } from "./lib/seed";

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
    .catch((err) => {
      console.error("Seed failed:", err);
    });
});
