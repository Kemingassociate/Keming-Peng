"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { Headphones, BookOpen, PenTool, Mic, Clock, Target, TrendingUp, Loader2 } from "lucide-react";

interface AttemptSummary {
  id: string;
  exam_id: string;
  exam_title: string;
  module: string;
  band_score: number | null;
  correct_count: number;
  total_questions: number;
  completed_at: string;
}

export default function DashboardPage() {
  const { user, profile, isStudent, loading: authLoading } = useAuth();
  const router = useRouter();
  const [attempts, setAttempts] = useState<AttemptSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user || !isStudent) {
      router.replace("/login");
      return;
    }

    // Fetch attempts with exam info
    supabase
      .from("attempts")
      .select(`
        id, exam_id, band_score, correct_count, total_questions, completed_at,
        exams!inner(title, module)
      `)
      .eq("user_id", user.id)
      .order("completed_at", { ascending: false })
      .then(({ data, error }) => {
        if (!error && data) {
          const mapped = data.map((d: any) => ({
            id: d.id,
            exam_id: d.exam_id,
            exam_title: d.exams?.title ?? "未知试卷",
            module: d.exams?.module ?? "unknown",
            band_score: d.band_score,
            correct_count: d.correct_count,
            total_questions: d.total_questions,
            completed_at: d.completed_at,
          }));
          setAttempts(mapped);
        }
        setLoading(false);
      });
  }, [user, isStudent, authLoading, router]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-800" />
      </div>
    );
  }

  // Stats
  const totalAttempts = attempts.length;
  const avgBand = attempts.length > 0
    ? (attempts.reduce((sum, a) => sum + (a.band_score ?? 0), 0) / totalAttempts).toFixed(1)
    : "—";
  const totalCorrect = attempts.reduce((sum, a) => sum + a.correct_count, 0);
  const totalQuestions = attempts.reduce((sum, a) => sum + a.total_questions, 0);
  const accuracy = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;

  const moduleIcons: Record<string, React.ReactNode> = {
    listening: <Headphones className="w-4 h-4" />,
    reading: <BookOpen className="w-4 h-4" />,
    writing: <PenTool className="w-4 h-4" />,
    speaking: <Mic className="w-4 h-4" />,
  };

  const moduleColors: Record<string, string> = {
    listening: "text-blue-600",
    reading: "text-emerald-600",
    writing: "text-orange-600",
    speaking: "text-purple-600",
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-slate-50">
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
            <a href="/" className="text-slate-500 hover:text-blue-700 transition">首页</a>
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
        {/* 欢迎 */}
        <div className="mb-8">
          <h1 className="text-2xl font-black text-slate-900">
            你好，{profile?.full_name || profile?.email?.split("@")[0] || "同学"} 👋
          </h1>
          <p className="text-slate-500 mt-1">这是你的学习记录</p>
        </div>

        {/* 统计卡片 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center gap-2 text-slate-400 text-xs mb-2">
              <Target className="w-4 h-4" />
              完成次数
            </div>
            <p className="text-3xl font-black text-slate-900">{totalAttempts}</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center gap-2 text-slate-400 text-xs mb-2">
              <TrendingUp className="w-4 h-4" />
              平均 Band
            </div>
            <p className="text-3xl font-black text-blue-800">{avgBand}</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center gap-2 text-slate-400 text-xs mb-2">
              <Target className="w-4 h-4" />
              正确率
            </div>
            <p className="text-3xl font-black text-emerald-600">{accuracy}%</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center gap-2 text-slate-400 text-xs mb-2">
              <Clock className="w-4 h-4" />
              答题总数
            </div>
            <p className="text-3xl font-black text-slate-900">{totalQuestions}</p>
          </div>
        </div>

        {/* 做题记录 */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <h2 className="font-bold text-slate-900">做题记录</h2>
          </div>

          {attempts.length === 0 ? (
            <div className="text-center py-16">
              <Target className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">还没有做题记录</p>
              <a
                href="/"
                className="inline-block mt-4 px-6 py-2.5 bg-blue-800 text-white rounded-xl font-semibold text-sm hover:bg-blue-900 transition"
              >
                去做题
              </a>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {attempts.map((a) => (
                <a
                  key={a.id}
                  href={`/exam/${a.exam_id}`}
                  className="flex items-center gap-4 px-6 py-4 hover:bg-slate-50 transition group"
                >
                  <div className={`${moduleColors[a.module] || "text-slate-400"}`}>
                    {moduleIcons[a.module] || <BookOpen className="w-4 h-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-900 truncate group-hover:text-blue-700 transition">
                      {a.exam_title}
                    </p>
                    <p className="text-xs text-slate-400">
                      {new Date(a.completed_at).toLocaleDateString("zh-CN", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-slate-900">{a.band_score ?? "—"}</p>
                    <p className="text-xs text-slate-400">
                      {a.correct_count}/{a.total_questions}
                    </p>
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
