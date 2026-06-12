"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth";
import { supabase, type Profile, type UserRole } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import {
  ShieldAlert, Loader2, UserPlus, Trash2, CheckCircle, XCircle,
  Mail, Users, Shield, GraduationCap, ChevronDown, Search, Ban, RotateCcw, AlertTriangle
} from "lucide-react";

const ROLE_CONFIG: Record<UserRole, { label: string; color: string; bg: string; icon: typeof ShieldAlert }> = {
  superadmin: { label: "超级管理员", color: "text-red-700", bg: "bg-red-50", icon: ShieldAlert },
  admin: { label: "管理员", color: "text-blue-700", bg: "bg-blue-50", icon: Shield },
  student: { label: "学生", color: "text-slate-600", bg: "bg-slate-50", icon: GraduationCap },
};

const ROLE_ORDER: UserRole[] = ["superadmin", "admin", "student"];

export default function SuperAdminPage() {
  const { user, profile, isSuperadmin, signOut, loading: authLoading } = useAuth();
  const router = useRouter();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<UserRole | "all">("all");
  const [confirmAction, setConfirmAction] = useState<{
    type: "role" | "delete";
    profileId: string;
    profileName: string;
    newRole?: UserRole;
  } | null>(null);

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
      .order("created_at", { ascending: false });

    if (!error && data) setProfiles(data as Profile[]);
    setLoading(false);
  };

  const showMessage = useCallback((type: "success" | "error", text: string) => {
    setMsg({ type, text });
    setTimeout(() => setMsg(null), 4000);
  }, []);

  const handleRoleChange = async (profileId: string, newRole: UserRole) => {
    setConfirmAction(null);
    const { error } = await supabase
      .from("profiles")
      .update({ role: newRole, updated_at: new Date().toISOString() })
      .eq("id", profileId);

    if (error) {
      showMessage("error", "操作失败：" + error.message);
    } else {
      showMessage("success", `角色已更新为 ${ROLE_CONFIG[newRole].label}`);
      loadProfiles();
    }
  };

  const handleDelete = async (profileId: string) => {
    setConfirmAction(null);
    // Delete from auth.users will cascade to profiles
    const { error } = await supabase
      .from("profiles")
      .delete()
      .eq("id", profileId);

    if (error) {
      showMessage("error", "删除失败：" + error.message);
    } else {
      showMessage("success", "用户已删除");
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

  // Stats
  const stats = {
    superadmin: profiles.filter(p => p.role === "superadmin").length,
    admin: profiles.filter(p => p.role === "admin").length,
    student: profiles.filter(p => p.role === "student").length,
    total: profiles.length,
  };

  // Filtered profiles
  const filtered = profiles.filter(p => {
    const matchRole = roleFilter === "all" || p.role === roleFilter;
    const matchSearch = search === "" ||
      p.email.toLowerCase().includes(search.toLowerCase()) ||
      (p.full_name || "").toLowerCase().includes(search.toLowerCase());
    return matchRole && matchSearch;
  });

  const getNextRoles = (currentRole: UserRole): UserRole[] => {
    const idx = ROLE_ORDER.indexOf(currentRole);
    return ROLE_ORDER.filter((_, i) => i !== idx);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
      {/* 导航 */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
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
            <a href="/dashboard" className="text-slate-500 hover:text-blue-700 transition">学习记录</a>
            <button
              onClick={() => signOut()}
              className="text-slate-500 hover:text-red-600 transition"
            >
              退出登录
            </button>
          </nav>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-black text-slate-900 mb-1">超级管理员面板</h1>
        <p className="text-slate-500 mb-8">管理所有用户角色与权限</p>

        {/* 消息提示 */}
        {msg && (
          <div className={`mb-6 px-4 py-3 rounded-xl text-sm flex items-center gap-2 ${
            msg.type === "success" ? "bg-green-50 border border-green-200 text-green-700" : "bg-red-50 border border-red-200 text-red-700"
          }`}>
            {msg.type === "success" ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
            {msg.text}
          </div>
        )}

        {/* 确认弹窗 */}
        {confirmAction && (
          <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  confirmAction.type === "delete" ? "bg-red-100" : "bg-amber-100"
                }`}>
                  {confirmAction.type === "delete" ?
                    <Trash2 className="w-5 h-5 text-red-600" /> :
                    <AlertTriangle className="w-5 h-5 text-amber-600" />
                  }
                </div>
                <h3 className="font-bold text-slate-900">
                  {confirmAction.type === "delete" ? "确认删除" : "确认修改角色"}
                </h3>
              </div>
              <p className="text-sm text-slate-600 mb-6">
                {confirmAction.type === "delete"
                  ? `确定要删除用户「${confirmAction.profileName}」吗？此操作不可恢复。`
                  : `确定要将「${confirmAction.profileName}」的角色修改为「${ROLE_CONFIG[confirmAction.newRole!].label}」吗？`
                }
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmAction(null)}
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 transition"
                >
                  取消
                </button>
                <button
                  onClick={() => {
                    if (confirmAction.type === "delete") {
                      handleDelete(confirmAction.profileId);
                    } else if (confirmAction.newRole) {
                      handleRoleChange(confirmAction.profileId, confirmAction.newRole);
                    }
                  }}
                  className={`flex-1 px-4 py-2.5 text-sm font-medium text-white rounded-xl transition ${
                    confirmAction.type === "delete"
                      ? "bg-red-600 hover:bg-red-700"
                      : "bg-blue-600 hover:bg-blue-700"
                  }`}
                >
                  确认
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 统计卡片 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: "总用户", count: stats.total, color: "text-slate-900", bg: "bg-slate-50", icon: Users },
            { label: "超级管理员", count: stats.superadmin, color: "text-red-700", bg: "bg-red-50", icon: ShieldAlert },
            { label: "管理员", count: stats.admin, color: "text-blue-700", bg: "bg-blue-50", icon: Shield },
            { label: "学生", count: stats.student, color: "text-slate-600", bg: "bg-slate-50", icon: GraduationCap },
          ].map(stat => (
            <div key={stat.label} className={`${stat.bg} rounded-2xl p-5 border border-slate-100`}>
              <div className="flex items-center gap-2 mb-2">
                <stat.icon className={`w-4 h-4 ${stat.color}`} />
                <span className="text-xs text-slate-500 font-medium">{stat.label}</span>
              </div>
              <p className={`text-3xl font-black ${stat.color}`}>{stat.count}</p>
            </div>
          ))}
        </div>

        {/* 筛选栏 */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="搜索邮箱或姓名..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition"
            />
          </div>
          <div className="flex gap-2">
            {(["all", ...ROLE_ORDER] as const).map(role => (
              <button
                key={role}
                onClick={() => setRoleFilter(role)}
                className={`px-3.5 py-2 text-xs font-medium rounded-lg transition ${
                  roleFilter === role
                    ? "bg-blue-800 text-white"
                    : "bg-white text-slate-500 border border-slate-200 hover:bg-slate-50"
                }`}
              >
                {role === "all" ? "全部" : ROLE_CONFIG[role].label}
              </button>
            ))}
          </div>
        </div>

        {/* 用户列表 */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {/* 表头 */}
          <div className="grid grid-cols-12 gap-4 px-6 py-3 border-b border-slate-100 text-xs font-semibold text-slate-400 uppercase tracking-wider">
            <div className="col-span-1">角色</div>
            <div className="col-span-3">姓名</div>
            <div className="col-span-3">邮箱</div>
            <div className="col-span-2">注册时间</div>
            <div className="col-span-3 text-right">操作</div>
          </div>

          {filtered.length === 0 ? (
            <div className="px-6 py-12 text-center text-slate-400">
              <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>没有找到匹配的用户</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {filtered.map(p => {
                const roleCfg = ROLE_CONFIG[p.role];
                const RoleIcon = roleCfg.icon;
                const isSelf = p.id === user?.id;
                const nextRoles = getNextRoles(p.role);

                return (
                  <div key={p.id} className={`grid grid-cols-12 gap-4 px-6 py-4 items-center hover:bg-slate-50/50 transition ${isSelf ? "bg-blue-50/30" : ""}`}>
                    {/* 角色图标 */}
                    <div className="col-span-1">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${roleCfg.bg} ${roleCfg.color}`}>
                        <RoleIcon className="w-4 h-4" />
                      </div>
                    </div>

                    {/* 姓名 */}
                    <div className="col-span-3">
                      <p className="font-medium text-slate-900 truncate">
                        {p.full_name || "—"}
                        {isSelf && <span className="ml-1.5 text-[10px] text-blue-500 font-normal">(你)</span>}
                      </p>
                    </div>

                    {/* 邮箱 */}
                    <div className="col-span-3">
                      <p className="text-sm text-slate-500 truncate">{p.email}</p>
                    </div>

                    {/* 注册时间 */}
                    <div className="col-span-2">
                      <p className="text-xs text-slate-400">
                        {new Date(p.created_at).toLocaleDateString("zh-CN", { month: "short", day: "numeric" })}
                      </p>
                    </div>

                    {/* 操作 */}
                    <div className="col-span-3 flex items-center justify-end gap-2">
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${roleCfg.bg} ${roleCfg.color}`}>
                        {roleCfg.label}
                      </span>

                      {!isSelf && (
                        <>
                          {/* 角色切换下拉 */}
                          <div className="relative group">
                            <button className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-500 bg-slate-50 rounded-lg hover:bg-slate-100 transition">
                              切换角色
                              <ChevronDown className="w-3 h-3" />
                            </button>
                            <div className="absolute right-0 top-full mt-1 w-40 bg-white border border-slate-200 rounded-xl shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                              {nextRoles.map(nr => {
                                const nrCfg = ROLE_CONFIG[nr];
                                const NrIcon = nrCfg.icon;
                                return (
                                  <button
                                    key={nr}
                                    onClick={() => setConfirmAction({
                                      type: "role",
                                      profileId: p.id,
                                      profileName: p.full_name || p.email,
                                      newRole: nr,
                                    })}
                                    className={`w-full text-left px-4 py-2.5 text-sm flex items-center gap-2 hover:bg-slate-50 transition first:rounded-t-xl last:rounded-b-xl ${nrCfg.color}`}
                                  >
                                    <NrIcon className="w-3.5 h-3.5" />
                                    设为{nrCfg.label}
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          {/* 删除按钮 */}
                          <button
                            onClick={() => setConfirmAction({
                              type: "delete",
                              profileId: p.id,
                              profileName: p.full_name || p.email,
                            })}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                            title="删除用户"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <p className="text-xs text-slate-400 mt-6">
          💡 提示：学生注册后默认角色为 student，可在此页面提升为管理员。只有超级管理员可以访问此页面。
        </p>
      </div>
    </div>
  );
}
