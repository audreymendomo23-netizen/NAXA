import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";

export function supabaseServer(response?: NextResponse, sessionOptions?: { remember?: boolean }) {
  // Next.js 15+ exposes cookies() asynchronously. Keep this factory synchronous
  // for existing callers, but make the Supabase SSR cookie adapter async so it
  // always reads and writes the resolved request cookie store.
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: async () => (await cookieStore).getAll(),
        setAll: async (
          list: { name: string; value: string; options: CookieOptions }[],
        ) => {
          try {
            const store = await cookieStore;
            list.forEach(({ name, value, options }) => {
              const effectiveOptions = { ...options };
              // A non-persistent login must use a browser-session cookie.
              // Omitting both lifetime attributes avoids turning "remember me"
              // off into an immediately expired cookie.
              if (sessionOptions?.remember === false) {
                delete effectiveOptions.maxAge;
                delete effectiveOptions.expires;
              }
              if (response) response.cookies.set(name, value, effectiveOptions);
              else store.set(name, value, effectiveOptions);
            });
          } catch {
            // Server Components cannot mutate response cookies while rendering.
          }
        },
      },
    },
  );
}

export function supabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  // Preview/Development must use a secret created in their own Replay project.
  // The legacy Production service-role key is a fallback only inside a
  // Production deployment; it must never be inherited by tests or previews.
  const supabaseSecretKey =
    process.env.SUPABASE_SECRET_KEY ||
    (process.env.VERCEL_ENV === "production"
      ? process.env.SUPABASE_SERVICE_ROLE_KEY
      : undefined);

  if (!supabaseUrl || !supabaseSecretKey) {
    throw new Error("Supabase Admin is not configured on the server.");
  }

  // New sb_secret_* API keys are opaque keys, not JWTs. Send them only
  // through the apikey header; never mirror them into Authorization: Bearer.
  const globalOptions = supabaseSecretKey.startsWith("sb_secret_")
    ? {
        fetch: (input: RequestInfo | URL, init?: RequestInit) => {
          const headers = new Headers(init?.headers);
          headers.delete("Authorization");
          headers.set("apikey", supabaseSecretKey);
          return fetch(input, { ...init, headers });
        },
      }
    : undefined;

  return createClient(
    supabaseUrl,
    supabaseSecretKey,
    {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      ...(globalOptions ? { global: globalOptions } : {}),
    }
  );
}

export function supabasePublic(revalidateSecondes = 600) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: { persistSession: false },
      global: {
        fetch: (url, init) =>
          fetch(url, { ...init, next: { revalidate: revalidateSecondes } }),
      },
    },
  );
}
