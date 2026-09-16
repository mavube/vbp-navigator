// Browser-side Supabase client — for use in "use client" components.
// Server code (proxy.ts, route handlers, server components) uses
// lib/supabase/server.ts instead, which reads/writes the auth cookie.

import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
