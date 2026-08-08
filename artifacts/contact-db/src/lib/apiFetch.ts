/**
 * apiFetch — drop-in replacement for fetch() for all /api/* calls.
 *
 * Ensures Clerk session cookies are always included in API requests.
 * Web auth uses cookies (set for the domain by the Clerk SDK via the
 * clerkProxyUrl mechanism). Do NOT use getToken() / Authorization: Bearer
 * for web — that pattern is only for Expo/mobile clients.
 */
export function apiFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  return fetch(input, { credentials: "include", ...init });
}
