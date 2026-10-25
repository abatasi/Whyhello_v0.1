import { City, Country, State } from "country-state-city";
import { and, or, not, sql, type SQL, type AnyColumn } from "drizzle-orm";

type Kind = "city" | "state" | "country";
export interface LocationOption { value: string; label: string; kind: Kind }
interface Place extends LocationOption {
  name: string;
  countryCode: string;
  stateCode?: string;
  stateName?: string;
  countryName: string;
  search: string;
}

const COUNTRY_ALIASES: Record<string, string[]> = {
  US: ["USA", "US", "United States of America", "U.S.", "U.S.A."],
  GB: ["UK", "United Kingdom", "Great Britain", "U.K."],
  AE: ["UAE", "United Arab Emirates"],
  KR: ["South Korea"],
  RU: ["Russia"],
  VN: ["Vietnam"],
};
const CITY_ALIASES: Record<string, string[]> = {
  "US:NY:New York City": ["New York", "NYC"],
  "US:CA:San Francisco": ["SF"],
};
const foldAccents = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/ø/g, "o").replace(/ł/g, "l");
export const normalizeLocation = (value: string) => foldAccents(value).replace(/[^a-z0-9]+/g, " ").trim();

let library: Place[] | undefined;
let byValue: Map<string, Place>;
let cityStates: Map<string, Set<string>>;
let cityCountries: Map<string, Set<string>>;

function places(): Place[] {
  if (library) return library;
  const countries = new Map(Country.getAllCountries().map(c => [c.isoCode, c]));
  const states = new Map(State.getAllStates().map(s => [`${s.countryCode}:${s.isoCode}`, s]));
  cityStates = new Map();
  cityCountries = new Map();
  const result: Place[] = [];
  const add = (kind: Kind, name: string, countryCode: string, stateCode?: string) => {
    const countryName = countries.get(countryCode)?.name ?? countryCode;
    const stateName = stateCode ? states.get(`${countryCode}:${stateCode}`)?.name : undefined;
    const parts = kind === "country" ? [name, "", ""] : kind === "state" ? [name, "", countryName] : [name, stateName ?? "", countryName];
    const value = `geo:${kind}:${parts.map(encodeURIComponent).join(":")}`;
    const label = [...new Set(parts.filter(Boolean))].join(", ");
    result.push({
      value, label, kind, name, countryName, countryCode, stateCode, stateName,
      search: normalizeLocation([label, countryCode, stateCode, ...(COUNTRY_ALIASES[countryCode] ?? []), ...(CITY_ALIASES[`${countryCode}:${stateCode}:${name}`] ?? [])].join(" ")),
    });
    if (kind === "city") {
      const nameKey = normalizeLocation(name);
      const key = `${countryCode}:${nameKey}`;
      if (!cityStates.has(key)) cityStates.set(key, new Set());
      cityStates.get(key)!.add(stateCode ?? "");
      if (!cityCountries.has(nameKey)) cityCountries.set(nameKey, new Set());
      cityCountries.get(nameKey)!.add(countryCode);
    }
  };
  for (const c of countries.values()) add("country", c.name, c.isoCode);
  for (const s of states.values()) add("state", s.name, s.countryCode, s.isoCode);
  for (const c of City.getAllCities()) add("city", c.name, c.countryCode, c.stateCode);
  library = [...new Map(result.map(p => [p.value, p])).values()];
  byValue = new Map(library.map(p => [p.value, p]));
  return library;
}

export function searchLocations(query: string): LocationOption[] {
  const q = normalizeLocation(query.slice(0, 150));
  if (!q) return [];
  const all = places();
  const tokens = q.split(" ").filter(Boolean);
  const priority = { country: 0, state: 1, city: 2 };
  const score = (p: Place) => normalizeLocation(p.name) === q
    || (p.kind === "country" && [p.countryCode, ...(COUNTRY_ALIASES[p.countryCode] ?? [])].some(a => normalizeLocation(a) === q))
    ? 0 : normalizeLocation(p.name).startsWith(q) ? 1 : 2;
  return all.filter(p => tokens.every(t => p.search.split(" ").some(word => word.startsWith(t))))
    .sort((a, b) => score(a) - score(b) || priority[a.kind] - priority[b.kind] || a.label.localeCompare(b.label))
    .slice(0, 60).map(({ value, label, kind }) => ({ value, label, kind }));
}

const escaped = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function containsTerm(column: AnyColumn, values: string[]) {
  const terms = [...new Set(values.filter(Boolean).map(v => foldAccents(v).replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "")).filter(Boolean))];
  if (!terms.length) return sql<boolean>`false`;
  // Whole words avoid matching US/IN/CA inside unrelated place names.
  const regex = `\\m(${terms.map(escaped).join("|")})\\M`;
  const accents = "àáâãäåāăąçćčďèéêëēėęěìíîïīįłñńňòóôõöøōőřśšşťùúûüūůűųýÿžźż";
  const plain = [...accents].map(c => c === "ø" ? "o" : c === "ł" ? "l" : c.normalize("NFD")[0]).join("");
  return sql<boolean>`translate(lower(coalesce(${column}, '')), ${accents}, ${plain}) ~ ${regex}`;
}

function placeCondition(location: AnyColumn, country: AnyColumn, value: string): SQL {
  places();
  const place = byValue.get(value);
  // Preserve old saved searches without treating arbitrary strings as SQL patterns.
  if (!place) {
    if (value.startsWith("geo:")) return sql`false`;
    return containsTerm(location, [value]);
  }
  const countries = [place.countryName, place.countryCode, ...(COUNTRY_ALIASES[place.countryCode] ?? [])];
  // A populated country field is authoritative; CA in an address can mean California, not Canada.
  const countryInAddress = containsTerm(location, [place.countryName, ...(COUNTRY_ALIASES[place.countryCode] ?? [])]);
  const countryMatches = sql<boolean>`case when nullif(trim(${country}), '') is not null then ${containsTerm(country, countries)} else ${countryInAddress} end`;
  if (place.kind === "country") return countryMatches;
  const countryCompatible = sql`(nullif(trim(${country}), '') is null or ${containsTerm(country, countries)})`;
  const states = [place.stateName ?? place.name];
  // Short codes are useful for states only when the country is known.
  const stateMatches = place.stateCode
    ? or(containsTerm(location, states), and(containsTerm(location, [place.stateCode]), countryMatches))!
    : containsTerm(location, states);
  if (place.kind === "state") return and(stateMatches, countryCompatible)!;
  const cityMatches = containsTerm(location, [place.name, ...(CITY_ALIASES[`${place.countryCode}:${place.stateCode}:${place.name}`] ?? [])]);
  const uniqueInCountry = cityStates.get(`${place.countryCode}:${normalizeLocation(place.name)}`)?.size === 1;
  const uniqueWorldwide = cityCountries.get(normalizeLocation(place.name))?.size === 1;
  const qualification = or(
    stateMatches,
    uniqueInCountry ? countryMatches : undefined,
    uniqueWorldwide && uniqueInCountry ? sql`nullif(trim(${country}), '') is null` : undefined,
  )!;
  return and(cityMatches, countryCompatible, qualification)!;
}

/** Includes are OR'd; exclusions always win. Unknown locations survive exclusion-only filters. */
export function locationFilterCondition(location: AnyColumn, country: AnyColumn, includes: string[], excludes: string[]): SQL | undefined {
  const include = includes.length ? or(...includes.map(v => placeCondition(location, country, v))) : undefined;
  const exclude = excludes.length ? not(or(...excludes.map(v => placeCondition(location, country, v)))!) : undefined;
  return and(include, exclude);
}
