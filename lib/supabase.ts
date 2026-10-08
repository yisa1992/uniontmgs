import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!url || !anonKey) {
  console.warn(
    "[TMS] Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY"
  );
}

/** Public client (browser-safe) */
export const supabase = createClient(
  url || "https://placeholder.supabase.co",
  anonKey || "placeholder"
);

/**
 * Admin client — uses service role key.
 * ONLY use in server-side API routes / server components.
 * Bypasses RLS.
 */
export const supabaseAdmin = createClient(
  url || "https://placeholder.supabase.co",
  serviceKey || anonKey || "placeholder",
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);
