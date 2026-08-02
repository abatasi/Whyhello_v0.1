const CONTACT_KEY = "wh_recent_contacts";
const COMPANY_KEY = "wh_recent_companies";
const MAX = 5;

export interface RecentContactVisit {
  id: number;
  name: string;
  title: string | null;
  companyName: string | null;
  visitedAt: number; // epoch ms
}

export interface RecentCompanyVisit {
  id: number;
  name: string;
  industry: string | null;
  visitedAt: number;
}

function readList<T extends { id: number }>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    return [];
  }
}

function writeList<T>(key: string, list: T[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(list));
  } catch {
    // storage full — silently ignore
  }
}

export function recordContactVisit(
  id: number,
  name: string,
  title: string | null,
  companyName: string | null,
): void {
  const existing = readList<RecentContactVisit>(CONTACT_KEY).filter(
    (v) => v.id !== id,
  );
  const updated: RecentContactVisit[] = [
    { id, name, title, companyName, visitedAt: Date.now() },
    ...existing,
  ].slice(0, MAX);
  writeList(CONTACT_KEY, updated);
}

export function recordCompanyVisit(
  id: number,
  name: string,
  industry: string | null,
): void {
  const existing = readList<RecentCompanyVisit>(COMPANY_KEY).filter(
    (v) => v.id !== id,
  );
  const updated: RecentCompanyVisit[] = [
    { id, name, industry, visitedAt: Date.now() },
    ...existing,
  ].slice(0, MAX);
  writeList(COMPANY_KEY, updated);
}

export function getRecentContactVisits(): RecentContactVisit[] {
  return readList<RecentContactVisit>(CONTACT_KEY);
}

export function getRecentCompanyVisits(): RecentCompanyVisit[] {
  return readList<RecentCompanyVisit>(COMPANY_KEY);
}
