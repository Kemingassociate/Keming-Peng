"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import type { Exam, IELTSModule } from "@/types";
import {
  Headphones, Clock, FileText, ArrowRight, BookOpen,
  Mic, PenTool, LogIn, LogOut, LayoutDashboard, Settings
} from "lucide-react";

const MODULES: { key: IELTSModule; label: string; icon: React.ReactNode; color: string; bg: string; desc: string }[] = [
  {
    key: "listening",
    label: "听力 Listening",
    icon: <Headphones className="w-6 h-6" />,
    color: "text-blue-700",
    bg: "bg-blue-50",
    desc: "音频播放 + 填空/选择，自动评分 Band Score",
  },
  {
    key: "reading",
    label: "阅读 Reading",
    icon: <BookOpen className="w-6 h-6" />,
    color: "text-emerald-700",
    bg: "bg-emerald-50",
    desc: "长文阅读理解，限时作答与批改",
  },
  {
    key: "writing",
    label: "写作 Writing",
    icon: <PenTool className="w-6 h-6" />,
    color: "text-orange-700",
    bg: "bg-orange-50",
    desc: "Task 1 & Task 2 作文，按雅思标准评分",
  },
  {
    key: "speaking",
    label: "口语 Speaking",
    icon: <Mic className="w-6 h-6" />,
    color: "text-purple-700",
    bg: "bg-purple-50",
    desc: "Part 1-3 模拟面试，录音回放与点评",
  },
];

export default function HomePage() {
  const { user, profile, isAdmin, isStudent, signOut } = useAuth();
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeModule, setActiveModule] = useState<IELTSModule>("listening");

  useEffect(() => {
    supabase
      .from("exams")
      .select("id, title, description, module, duration, created_at, is_published")
      .eq("is_published", true)
      .order("created_at", { ascending: false })
      .then(({ data, error }: { data: unknown; error: unknown }) => {
        if (!error && data) {
          setExams(data as unknown as Exam[]);
        }
        setLoading(false);
      });
  }, []);

  // 当前模块的试卷
  const filteredExams = exams.filter(e => e.module === activeModule);
  const activeConfig = MODULES.find(m => m.key === activeModule)!;

  return (
    <div className="min-h-screen flex flex-col">
      {/* 顶部导航 — Auth-aware */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-800 rounded-xl flex items-center justify-center text-white font-bold text-lg">
              🎧
            </div>
            <span className="text-xl font-bold text-slate-900 tracking-tight">
              IELTS Mock
            </span>
          </div>
          <nav className="flex items-center gap-4 text-sm">
            <a href="/" className="text-blue-700 font-medium">首页</a>
            {isAdmin && (
              <a href="/admin" className="text-slate-500 hover:text-slate-900 transition flex items-center gap-1">
                <Settings className="w-3.5 h-3.5" />
                管理后台
              </a>
            )}
            {user ? (
              <>
                {isStudent && (
                  <a href="/dashboard" className="text-slate-500 hover:text-blue-700 transition flex items-center gap-1">
                    <LayoutDashboard className="w-3.5 h-3.5" />
                    学习记录
                  </a>
                )}
                <span className="text-slate-400 hidden sm:inline">
                  {profile?.full_name || user.email?.split("@")[0]}
                </span>
                <button
                  onClick={() => signOut()}
                  className="text-slate-500 hover:text-red-600 transition flex items-center gap-1"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  退出
                </button>
              </>
            ) : (
              <a
                href="/login"
                className="flex items-center gap-1.5 px-4 py-2 bg-blue-800 text-white rounded-xl font-medium hover:bg-blue-900 transition shadow-sm"
              >
                <LogIn className="w-3.5 h-3.5" />
                登录
              </a>
            )}
          </nav>
        </div>
      </header>

      {/* Hero 区域 */}
      <section className="bg-gradient-to-br from-blue-900 via-blue-800 to-blue-950 text-white py-16 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-4 py-1.5 text-sm mb-6">
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
            在线模考 · 四大模块 · 雅思官方评分标准
          </div>
          <h1 className="text-3xl md:text-4xl font-black mb-4 leading-tight">
            雅思分手大师
          </h1>
          <p className="text-blue-100 text-base md:text-lg max-w-2xl mx-auto leading-relaxed">
            广东外语外贸大学国际学院<br />
            雅思，拜拜了您内
          </p>
          {!user && (
            <div className="mt-8 flex items-center justify-center gap-4">
              <a
                href="/register"
                className="px-8 py-3 bg-white text-blue-900 rounded-xl font-bold hover:bg-blue-50 transition shadow-lg"
              >
                免费注册
              </a>
              <a
                href="/login"
                className="px-8 py-3 border-2 border-white/30 text-white rounded-xl font-medium hover:bg-white/10 transition"
              >
                登录
              </a>
            </div>
          )}
        </div>
      </section>

      {/* 四模块 Tab 切换 */}
      <section className="max-w-6xl mx-auto px-6 w-full -mt-6">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-lg p-2 flex gap-1 overflow-x-auto">
          {MODULES.map(m => (
            <button
              key={m.key}
              onClick={() => setActiveModule(m.key)}
              className={`flex-1 min-w-[140px] flex items-center justify-center gap-2.5 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                activeModule === m.key
                  ? `${m.bg} ${m.color} shadow-sm`
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
              }`}
            >
              {m.icon}
              <span className="hidden sm:inline">{m.label.split(" ")[0]}</span>
              <span className="sm:hidden">{m.label.split(" ")[0]}</span>
            </button>
          ))}
        </div>
      </section>

      {/* 模块描述 + 试卷列表 */}
      <main className="flex-1 max-w-6xl mx-auto px-6 py-8 w-full">
        {/* 当前模块介绍 */}
        <div className={`${activeConfig.bg} rounded-2xl p-6 mb-8 border ${activeConfig.color.replace("text-", "border-")}/20`}>
          <div className="flex items-start gap-4">
            <div className={`w-12 h-12 ${activeConfig.bg} rounded-xl flex items-center justify-center ${activeConfig.color} border ${activeConfig.color.replace("text-", "border-")}/20`}>
              {activeConfig.icon}
            </div>
            <div>
              <h2 className={`font-bold text-slate-900 text-lg mb-1`}>{activeConfig.label}</h2>
              <p className="text-slate-600 text-sm">{activeConfig.desc}</p>
            </div>
          </div>
        </div>

        {/* 试卷列表标题 */}
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-slate-900">可选试卷</h3>
          <span className="text-slate-500 text-sm">{filteredExams.length} 套试卷</span>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white rounded-2xl border border-slate-200 p-6 animate-pulse">
                <div className="h-4 bg-slate-100 rounded w-3/4 mb-4" />
                <div className="h-3 bg-slate-100 rounded w-full mb-2" />
                <div className="h-3 bg-slate-100 rounded w-2/3" />
              </div>
            ))}
          </div>
        ) : filteredExams.length === 0 ? (
          <div className="text-center py-16">
            <div className={`w-16 h-16 ${activeConfig.bg} rounded-full flex items-center justify-center mx-auto mb-6`}>
              {activeConfig.icon}
            </div>
            <h3 className="text-xl font-semibold text-slate-700 mb-2">暂无{activeConfig.label.split(" ")[0]}试卷</h3>
            <p className="text-slate-500 mb-6">管理员上传{activeConfig.label.split(" ")[0]}题目后，这里将显示可用试卷</p>
            {isAdmin && (
              <a
                href="/admin"
                className={`inline-flex items-center gap-2 px-6 py-3 rounded-xl font-medium text-white transition ${
                  activeModule === "listening" ? "bg-blue-700 hover:bg-blue-800" :
                  activeModule === "reading" ? "bg-emerald-700 hover:bg-emerald-800" :
                  activeModule === "writing" ? "bg-orange-600 hover:bg-orange-700" :
                  "bg-purple-700 hover:bg-purple-800"
                }`}
              >
                去上传题目 <ArrowRight className="w-4 h-4" />
              </a>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredExams.map(exam => (
              <a
                key={exam.id}
                href={`/exam/${exam.id}`}
                className="group bg-white rounded-2xl border border-slate-200 p-6 hover:border-blue-300 hover:shadow-lg hover:shadow-blue-100 transition-all duration-200"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className={`w-12 h-12 ${activeConfig.bg} group-hover:bg-blue-100 rounded-xl flex items-center justify-center transition ${activeConfig.color}`}>
                    {activeConfig.icon}
                  </div>
                  {exam.duration && (
                    <span className="text-xs text-slate-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {exam.duration} min
                    </span>
                  )}
                </div>
                <h3 className="font-bold text-slate-900 text-lg mb-2 group-hover:text-blue-700 transition">
                  {exam.title}
                </h3>
                {exam.description && (
                  <p className="text-slate-500 text-sm leading-relaxed line-clamp-2">
                    {exam.description}
                  </p>
                )}
                <div className="flex items-center justify-end mt-5 text-blue-600 text-sm font-medium opacity-0 group-hover:opacity-100 transition">
                  开始答题 <ArrowRight className="w-4 h-4 ml-1" />
                </div>
              </a>
            ))}
          </div>
        )}
      </main>

      {/* 页脚 */}
      <footer className="border-t border-slate-200 py-8 text-center text-slate-400 text-sm">
        IELTS Mock · Powered by Next.js &amp; Supabase
      </footer>
    </div>
  );
}
