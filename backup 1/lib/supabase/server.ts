// Server-side Supabase client for route handlers and server components —
// reads the session from cookies via Next's cookies() API. proxy.ts
// (the app's middleware) has its own copy of this pattern because
// middleware can't import next/headers; see lib/supabase/middleware.ts.

import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

type CookieToSet = { name: string; value: string; options: CookieOptions };

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component render, where cookies can't
            // be written — fine as long as proxy.ts is also refreshing
            // the session, which it is.
          }
        },
      },
    }
  );
}
