const raw = import.meta.env.VITE_API_URL;

// Some env var dashboards store a literal `""` typed into a field as the two-character
// string `""` instead of an actually-empty value — strip that so "empty" really means empty.
const normalized = raw === undefined ? undefined : raw.trim().replace(/^['"]|['"]$/g, "");

// Vite always hardcodes import.meta.env.DEV to the literal boolean `false` in a real
// `vite build` (and `true` in its dev server) — so checking `=== false` only matches an
// actual production build. It's `undefined` under Bun's test runner and bare script
// execution (no Vite involved at all), which fall through to the dev-style localhost
// fallback below — never throwing on an unresolvable same-origin URL.
const isProdBuild = import.meta.env.DEV === false;

// Whether VITE_API_URL ends up unset or set to "", both must mean "same origin" in a
// production build — only fall back to localhost:3000 outside of one. Keying this off
// isProdBuild (rather than "was the var set at all") means a deploy can't accidentally
// point at localhost just because the variable was deleted instead of emptied.
export const API_URL = normalized || (isProdBuild ? "" : "http://localhost:3000");
export const AUTH_BASE_URL = normalized || (isProdBuild ? undefined : "http://localhost:3000");
