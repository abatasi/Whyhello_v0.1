import assert from "node:assert/strict";
import test from "node:test";
import {
  appendAudienceToProfile,
  matchingBuyingCenterSeats,
  parseDnaProfile,
  selectedBuyingCenter,
  selectedTargetMarket,
  targetMarketLocationMatches,
  targetMarketMatchesCompany,
  validateAudienceRequest,
} from "./live-audience";

test("live selections require an explicit matching id", () => {
  const profile = parseDnaProfile(JSON.stringify({
    buyingCenters: [{ id: "bc-1", name: "Sales", seats: [] }],
    targetMarkets: [{ id: "tm-1", name: "SaaS", industries: ["Software"] }],
  }));
  assert.equal(selectedBuyingCenter(profile), null);
  assert.equal(selectedTargetMarket(profile), null);
});

test("buying-center seat matching applies configured role and seniority together in standard order", () => {
  const center = {
    name: "Sales",
    seats: [
      { seat: "Economic Buyer", seniorities: ["VP"], departments: ["Finance"] },
      { seat: "Business Champion", seniorities: [], departments: ["Marketing"] },
      { seat: "Decision Maker", seniorities: ["VP"], departments: [] },
      { seat: "Coach", seniorities: [], departments: [] },
    ],
  };
  const matched = matchingBuyingCenterSeats(center, {
    roleName: "Finance",
    department: "Operations",
    seniority: "VP",
  });
  assert.deepEqual(matched, ["Economic Buyer", "Decision Maker"]);

  assert.deepEqual(matchingBuyingCenterSeats({
    seats: [{ seat: "Business Champion", seniorities: ["VP"], departments: ["Finance"] }],
  }, { roleName: "Finance", department: null, seniority: null }), []);
});

test("all five selected seniorities include unknown seniority; empty criteria never match", () => {
  const allSeniorities = ["C-Suite", "VP", "Director", "Manager", "Individual Contributor"];
  assert.deepEqual(matchingBuyingCenterSeats({
    seats: [
      { seat: "Business Champion", seniorities: allSeniorities, departments: [] },
      { seat: "Economic Buyer", seniorities: [], departments: [] },
    ],
  }, { roleName: null, department: null, seniority: null }), ["Business Champion"]);
});

test("target-market matching requires every configured dimension and uses location substring only", () => {
  const market = {
    id: "tm",
    name: "SaaS",
    industries: [" Software "],
    companySizes: ["11-50"],
    locations: ["Canada"],
  };
  assert.equal(targetMarketMatchesCompany(market, {
    industry: "software",
    size: " 11-50 ",
    location: "Greater Toronto, Canada",
    country: null,
  }), true);
  assert.equal(targetMarketMatchesCompany(market, {
    industry: "software",
    size: "11-50",
    location: null,
    country: "Canada",
  }), false);
  assert.equal(targetMarketMatchesCompany({ ...market, industries: [], companySizes: [], locations: [] }, {
    industry: null,
    size: null,
    location: null,
    country: null,
  }), false);
  assert.equal(targetMarketLocationMatches("New York City", ["york"]), true);
  assert.equal(targetMarketLocationMatches("New York City", ["LONDON"]), false);
});

test("audience creation validates configs and appends without losing other profile fields", () => {
  const request = validateAudienceRequest({
    type: "targetMarket",
    audience: {
      id: "tm-new",
      name: "North America",
      industries: ["Software"],
      companySizes: ["11-50"],
      locations: ["Canada"],
    },
  });
  assert.ok(request);
  const current = {
    company: { name: "Acme" },
    liveBuyingCenterId: "bc-old",
    liveTargetMarketId: "tm-old",
    targetMarkets: [{ id: "tm-old", name: "Existing", industries: [], companySizes: [], locations: [] }],
  };
  const updated = appendAudienceToProfile(current, request);
  assert.deepEqual(updated?.company, current.company);
  assert.equal(updated?.liveBuyingCenterId, "bc-old");
  assert.equal(updated?.liveTargetMarketId, "tm-old");
  assert.equal((updated?.targetMarkets as unknown[]).length, 2);
  assert.equal(appendAudienceToProfile(updated!, request), null);
});

test("audience creation rejects malformed structures, values, and types", () => {
  assert.equal(validateAudienceRequest({
    type: "buyingCenter",
    audience: { id: "bc", name: "Team", seats: [{ seat: "Unknown Seat", seniorities: [], departments: [] }] },
  }), null);
  assert.equal(validateAudienceRequest({
    type: "targetMarket",
    audience: { id: "tm", name: "Market", industries: [" "], companySizes: [], locations: [] },
  }), null);
  assert.equal(validateAudienceRequest({
    type: "targetMarket",
    audience: { id: "tm", name: "Market", industries: [], companySizes: [] },
  }), null);
});