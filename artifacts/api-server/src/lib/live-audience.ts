export type DnaProfile = Record<string, unknown>;

export type LiveTargetMarket = {
  id: string;
  name: string | null;
  industries: string[];
  companySizes: string[];
  locations: string[];
};

export type ValidatedAudienceRequest =
  | {
      type: "buyingCenter";
      audience: {
        id: string;
        name: string;
        seats: Array<{ seat: string; seniorities: string[]; departments: string[] }>;
      };
    }
  | {
      type: "targetMarket";
      audience: LiveTargetMarket & { name: string };
    };

const SENIORITIES = ["C-Suite", "VP", "Director", "Manager", "Individual Contributor"];

export const BUYING_CENTER_SEAT_ORDER = [
  "Business Champion",
  "Economic Buyer",
  "Decision Maker",
  "Executive Sponsor",
  "Business Owner",
  "Technical Buyer",
  "Security or Compliance Reviewer",
  "Procurement",
  "Legal",
  "Finance",
  "End User",
  "Implementer",
  "Influencer",
  "Blocker",
  "Coach",
];

export function parseDnaProfile(data: string): DnaProfile | null {
  try {
    const value: unknown = JSON.parse(data);
    return value && typeof value === "object" && !Array.isArray(value)
      ? value as DnaProfile
      : null;
  } catch {
    return null;
  }
}

function cleanStrings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
      .map((item) => item.trim())
    : [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function validatedStringArray(value: unknown, allowed?: string[]): string[] | null {
  if (!Array.isArray(value)) return null;
  const values: string[] = [];
  for (const item of value) {
    const string = nonEmptyString(item);
    if (string === null || (allowed && !allowed.includes(string)) || values.includes(string)) return null;
    values.push(string);
  }
  return values;
}

export function validateAudienceRequest(value: unknown): ValidatedAudienceRequest | null {
  if (!isRecord(value) || !isRecord(value.audience)) return null;
  const id = nonEmptyString(value.audience.id);
  const name = nonEmptyString(value.audience.name);
  if (!id || !name) return null;

  if (value.type === "buyingCenter") {
    if (!Array.isArray(value.audience.seats)) return null;
    const seats: Array<{ seat: string; seniorities: string[]; departments: string[] }> = [];
    const seenSeats = new Set<string>();
    for (const item of value.audience.seats) {
      if (!isRecord(item)) return null;
      const seat = nonEmptyString(item.seat);
      const seniorities = validatedStringArray(item.seniorities, SENIORITIES);
      const departments = validatedStringArray(item.departments);
      if (!seat || !BUYING_CENTER_SEAT_ORDER.includes(seat) || seenSeats.has(seat) ||
          seniorities === null || departments === null) return null;
      seenSeats.add(seat);
      seats.push({ seat, seniorities, departments });
    }
    return { type: "buyingCenter", audience: { id, name, seats } };
  }

  if (value.type === "targetMarket") {
    const industries = validatedStringArray(value.audience.industries);
    const companySizes = validatedStringArray(value.audience.companySizes);
    const locations = validatedStringArray(value.audience.locations);
    if (industries === null || companySizes === null || locations === null) return null;
    return {
      type: "targetMarket",
      audience: { id, name, industries, companySizes, locations },
    };
  }
  return null;
}

export function appendAudienceToProfile(
  profile: DnaProfile,
  request: ValidatedAudienceRequest,
): DnaProfile | null {
  const collectionKey = request.type === "buyingCenter" ? "buyingCenters" : "targetMarkets";
  const current = profile[collectionKey];
  if (current !== undefined && !Array.isArray(current)) {
    throw new TypeError(`Stored ${collectionKey} must be an array`);
  }
  const audiences = (current ?? []) as Array<unknown>;
  if (audiences.some((item) => isRecord(item) && item.id === request.audience.id)) return null;
  return {
    ...profile,
    [collectionKey]: [...audiences, request.audience],
  };
}

function selectedConfig(profile: DnaProfile | null, key: string, listKey: string): Record<string, unknown> | null {
  const id = profile?.[key];
  const list = profile?.[listKey];
  if (typeof id !== "string" || !id || !Array.isArray(list)) return null;
  const item = list.find((candidate) =>
    candidate && typeof candidate === "object" &&
    (candidate as Record<string, unknown>).id === id,
  );
  return item && typeof item === "object" ? item as Record<string, unknown> : null;
}

export function selectedBuyingCenter(profile: DnaProfile | null): Record<string, unknown> | null {
  return selectedConfig(profile, "liveBuyingCenterId", "buyingCenters");
}

export function selectedTargetMarket(profile: DnaProfile | null): LiveTargetMarket | null {
  const item = selectedConfig(profile, "liveTargetMarketId", "targetMarkets");
  if (!item) return null;
  return {
    id: item.id as string,
    name: typeof item.name === "string" && item.name.trim() ? item.name.trim() : null,
    industries: cleanStrings(item.industries),
    companySizes: cleanStrings(item.companySizes),
    locations: cleanStrings(item.locations),
  };
}

export function matchingBuyingCenterSeats(
  buyingCenter: Record<string, unknown> | null,
  contact: { roleName: string | null; department: string | null; seniority: string | null },
): string[] {
  if (!buyingCenter || !Array.isArray(buyingCenter.seats)) return [];
  const configuredSeats = new Map<string, Record<string, unknown>>();
  for (const seat of buyingCenter.seats) {
    if (seat && typeof seat === "object" && typeof (seat as Record<string, unknown>).seat === "string") {
      configuredSeats.set((seat as Record<string, unknown>).seat as string, seat as Record<string, unknown>);
    }
  }

  return BUYING_CENTER_SEAT_ORDER.filter((seatName) => {
    const config = configuredSeats.get(seatName);
    if (!config) return false;
    const seniorities = cleanStrings(config.seniorities);
    const departments = cleanStrings(config.departments);
    if (seniorities.length === 0 && departments.length === 0) return false;

    const seniorityIsUnrestricted = SENIORITIES.every((seniority) => seniorities.includes(seniority));
    const seniorityMatches = seniorities.length === 0 || seniorityIsUnrestricted ||
      (contact.seniority !== null && seniorities.includes(contact.seniority));
    const contactRole = contact.roleName ?? contact.department;
    const roleMatches = departments.length === 0 ||
      (contactRole !== null && departments.includes(contactRole));
    return seniorityMatches && roleMatches;
  });
}

function normalized(value: string | null): string {
  return (value ?? "").trim().toLocaleLowerCase();
}

function matchesAny(value: string | null, options: string[]): boolean {
  const candidate = normalized(value);
  return candidate.length > 0 && options.some((option) => normalized(option) === candidate);
}

export function targetMarketLocationMatches(value: string | null, options: string[]): boolean {
  const candidate = value ?? "";
  return candidate.length > 0 && options.some((option) =>
    option.trim().length > 0 && candidate.toLocaleLowerCase().includes(option.trim().toLocaleLowerCase()),
  );
}

export function targetMarketMatchesCompany(
  market: LiveTargetMarket,
  company: {
    industry: string | null;
    size: string | null;
    location: string | null;
    country: string | null;
  },
): boolean {
  const dimensions: boolean[] = [];
  if (market.industries.length > 0) {
    dimensions.push(matchesAny(company.industry, market.industries));
  }
  if (market.companySizes.length > 0) {
    dimensions.push(matchesAny(company.size, market.companySizes));
  }
  if (market.locations.length > 0) {
    dimensions.push(targetMarketLocationMatches(company.location, market.locations));
  }
  return dimensions.length > 0 && dimensions.every(Boolean);
}