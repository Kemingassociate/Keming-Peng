import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// 懒加载：只在浏览器运行时初始化，构建时不执行
let _client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (typeof window === "undefined") return null;

  if (!_client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key || url === "your-project.supabase.co") return null;
    _client = createClient(url, key);
  }
  return _client;
}

// 为方便使用，保留 named export（运行时调用）
export const supabase = {
  from: (table: string) => {
    const client = getSupabase();
    if (!client) {
      // 返回一个假的 query builder
      return {
        select: () => Promise.resolve({ data: [], error: null } as any),
        insert: () => Promise.resolve({ data: null, error: null } as any),
        single: () => Promise.resolve({ data: null, error: null } as any),
        eq: () => ({ select: () => Promise.resolve({ data: [], error: null } as any) }),
      } as any;
    }
    return client.from(table);
  },
  storage: {
    from: (bucket: string) => {
      const client = getSupabase();
      if (!client) {
        return {
          upload: () => Promise.resolve({ error: { message: "Supabase not configured" } } as any),
          getPublicUrl: () => ({ data: { publicUrl: "" } }),
        } as any;
      }
      return client.storage.from(bucket);
    },
  },
};
