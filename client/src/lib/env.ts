const raw = import.meta.env.VITE_API_URL;

// Some env var dashboards store a literal `""` typed into a field as the two-character
// string `""` instead of an actually-empty value — strip that so "empty" really means empty.
const normalized = raw === undefined ? undefined : raw.trim().replace(/^['"]|['"]$/g, "");

// Same-origin production deploys: relative fetch paths via API_URL = "", and AUTH_BASE_URL
// omitted (undefined) so better-auth defaults to the current origin instead of throwing
// on an empty-string baseURL.
export const API_URL = normalized === undefined ? "http://localhost:3000" : normalized;
export const AUTH_BASE_URL = normalized === undefined ? "http://localhost:3000" : normalized || undefined;
