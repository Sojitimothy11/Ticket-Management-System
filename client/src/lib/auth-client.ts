import { createAuthClient } from "better-auth/react";

// VITE_API_URL is unset in local dev (defaults below) and explicitly set to "" in production,
// where the client is served from the same origin as the API — better-auth's baseURL must be
// omitted (not an empty string) for it to correctly default to the current origin.
const apiUrl = import.meta.env.VITE_API_URL;
const baseURL = apiUrl === undefined ? "http://localhost:3000" : apiUrl || undefined;

export const authClient = createAuthClient({ baseURL });
