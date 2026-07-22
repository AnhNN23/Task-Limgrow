import { createBrowserClient } from "@supabase/ssr";

export const createClient = () =>
  createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { cookies: { encode: "tokens-only" } },
  );

/** Remove obsolete chunked Supabase sessions before creating a fresh login. */
export function clearSupabaseAuthCookies() {
  if (typeof document === "undefined") return;

  for (const cookie of document.cookie.split(";")) {
    const separator = cookie.indexOf("=");
    const rawName = (
      separator >= 0 ? cookie.slice(0, separator) : cookie
    ).trim();

    if (
      !/^sb-.+-(?:auth-token|auth-token-code-verifier)(?:\.\d+)?$/.test(
        rawName,
      )
    ) {
      continue;
    }

    document.cookie = `${rawName}=; Path=/; Max-Age=0; SameSite=Lax`;
  }
}
