"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase, type Profile } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { ShieldAlert, Loader2, UserPlus, Trash2, CheckCircle, XCircle, Mail, Users } from "lucide-react";

export default function SuperAdminPage() {
  const { user, profile, isSuperadmin, loading: authLoading } = useAuth();
  const router = useRouter();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [newAdminName, setNewAdminName] = useState("");
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user || !isSuperadmin) {
      router.replace("/login");
      return;
    }
    loadProfiles();
  }, [user, isSuperadmin, authLoading, router]);

  const loadProfiles = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .order("role", { ascending: true })
      .order("email", { ascending: true });

    if (!error && data) setProfiles(data as Profile[]);
    setLoading(false);
  };

  const handlePromote = async (profileId: string, newRole: "admin" | "superadmin") => {
    const { error } = await supabase
      .from("profiles")
      .update({ role: newRole })
      .eq("id", profileId);

    if (error) {
      setMsg({ type: "error", text: "操作失败：" + error.message });
    } else {
      setMsg({ type: "success", text: "角色更新成功" });
      loadProfiles();
    }
  };

  const handleDemote = async (profileId: string) => {
    const { error } = await supabase
      .from("profiles")
      .update({ role: "student" })
      .eq("id", profileId);

    if (error) {
      setMsg({ type: "error", text: "操作失败：" + error.message });
    } else {
      setMsg({ type: "success", text: "已降级为学生" });
      loadProfiles();
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-800" />
      </div>
    );
  }

  const admins = profiles.filter(p => p.role === "admin" || p.role === "superadmin");
  const students = profiles.filter(p => p.role === "student");

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
      {/* 导航 */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <a href="/" className="flex items-center gap-3">
              <div className="w-9 h-9 bg-blue-800 rounded-xl flex items-center justify-center text-white font-bold text-lg">
                🎧
              </div>
              <span className="text-xl font-bold text-slate-900 tracking-tight">IELTS Mock</span>
            </a>
          </div>
          <nav className="flex items-center gap-4 text-sm">
            <a href="/admin" className="text-slate-500 hover:text-blue-700 transition">管理后台</a>
            <button
              onClick={() => supabase.auth.signOut().then(() => router.push("/"))}
              className="text-slate-500 hover:text-red-600 transition"
            >
              退出登录
            </button>
          </nav>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-black text-slate-900 mb-1">超级管理员面板</h1>
        <p className="text-slate-500 mb-8">管理管理员账号与学生账号</p>

        {msg && (
          <div className={`mb-6 px-4 py-3 rounded-xl text-sm flex items-center gap-2 ${
            msg.type === "success" ? "bg-green-50 border border-green-200 text-green-700" : "bg-red-50 border border-red-200 text-red-700"
          }`}>
            {msg.type === "success" ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
            {msg.text}
          </div>
        )}

        {/* 管理员列表 */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-8">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-bold text-slate-900 flex items-center gap-2">
              <Users className="w-4 h-4" />
              管理员账号 ({admins.length})
            </h2>
          </div>

          {admins.length === 0 ? (
            <div className="px-6 py-8 text-center text-slate-400">暂无管理员账号</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {admins.map(p => (
                <div key={p.id} className="flex items-center gap-4 px-6 py-4">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold ${
                    p.role === "superadmin" ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700"
                  }`}>
                    {p.role === "superadmin" ? "S" : "A"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-900 truncate">{p.full_name || "—"}</p>
                    <p className="text-xs text-slate-400">{p.email}</p>
                  </div>
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                    p.role === "superadmin" ? "bg-red-50 text-red-700" : "bg-blue-50 text-blue-700"
                  }`}>
                    {p.role === "superadmin" ? "超级管理员" : "管理员"}
                  </span>
                  {p.id !== user?.id && (
                    <button
                      onClick={() => handleDemote(p.id)}
                      className="text-xs text-red-500 hover:text-red-700 transition"
                      title="降级为学生"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 学生列表（可提升为管理员） */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <h2 className="font-bold text-slate-900 flex items-center gap-2">
              <Mail className="w-4 h-4" />
              学生账号 ({students.length}) — 点击提升为管理员
            </h2>
          </div>

          {students.length === 0 ? (
            <div className="px-6 py-8 text-center text-slate-400">暂无学生账号</div>
          ) : (
            <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
              {students.map(p => (
                <div key={p.id} className="flex items-center gap-4 px-6 py-4 hover:bg-slate-50 transition">
                  <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 text-sm font-bold">
                    S
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-900 truncate">{p.full_name || "—"}</p>
                    <p className="text-xs text-slate-400">{p.email}</p>
                  </div>
                  <button
                    onClick={() => handlePromote(p.id, "admin")}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    提升为管理员
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <p className="text-xs text-slate-400 mt-6">
          💡 提示：管理员账号由超级管理员手动提升。学生注册后默认角色为 student。
        </p>
      </div>
    </div>
  );
}
