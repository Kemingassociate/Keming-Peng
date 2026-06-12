import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

// ============================================================
//  Browser-side singleton client (with Auth support)
// ============================================================
let _browserClient: SupabaseClient | null = null;

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function isConfigured(): boolean {
  return !!(SUPABASE_URL && SUPABASE_ANON_KEY && !SUPABASE_URL.includes("your-project"));
}

export function getSupabaseClient(): SupabaseClient {
  if (!_browserClient) {
    if (!isConfigured()) {
      throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
    }
    _browserClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    });
  }
  return _browserClient;
}

// Lazy-access supabase: safe during SSR (won't throw until actual use)
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    if (!isBrowser()) return undefined;
    const client = getSupabaseClient();
    const val = (client as any)[prop];
    return typeof val === "function" ? val.bind(client) : val;
  },
});

// ============================================================
//  Type helpers
// ============================================================
export type UserRole = "superadmin" | "admin" | "student";

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  created_at: string;
  updated_at: string;
}
