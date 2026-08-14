import { createClient } from "@supabase/supabase-js";

const SERVICE_ROLE_CONFIG = {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
} as const;

/** Server-only client with service role — never import in client components. */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
    );
  }

  return createClient(url, serviceRoleKey, SERVICE_ROLE_CONFIG);
}

export function tryCreateAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    return null;
  }

  return createClient(url, serviceRoleKey, SERVICE_ROLE_CONFIG);
}

export const SERVICE_ROLE_MISSING_MESSAGE =
  "SUPABASE_SERVICE_ROLE_KEY is not configured on the server. Add it in Vercel project settings.";
