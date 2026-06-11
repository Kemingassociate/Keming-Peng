"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Exam } from "@/types";
import { Headphones, Clock, FileText, ArrowRight, BookOpen } from "lucide-react";

export default function HomePage() {
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("exams")
      .select("id, title, description, duration, created_at, is_published")
      .eq("is_published", true)
      .order("created_at", { ascending: false })
      .then(({ data, error }: { data: unknown; error: unknown }) => {
        if (!error && data) {
          setExams(data as unknown as Exam[]);
        }
        setLoading(false);
      });
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      {/* 顶部导航 */}
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
          <nav className="flex items-center gap-6 text-sm">
            <a href="/" className="text-blue-700 font-medium">首页</a>
            <a href="/admin" className="text-slate-500 hover:text-slate-900 transition">
              上传题目
            </a>
          </nav>
        </div>
      </header>

      {/* Hero 区域 */}
      <section className="bg-gradient-to-br from-blue-900 via-blue-800 to-blue-950 text-white py-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-4 py-1.5 text-sm mb-8">
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
            在线作答 · 即时批改 · 雅思官方评分标准
          </div>
          <h1 className="text-4xl md:text-5xl font-black mb-6 leading-tight">
            雅思听力在线模考
          </h1>
          <p className="text-blue-100 text-lg md:text-xl max-w-2xl mx-auto leading-relaxed">
            上传 Word 文档，自动识别题目和答案<br />
            完成后立即显示雅思 9 分制 Band Score
          </p>
          <div className="flex items-center justify-center gap-8 mt-10 text-blue-200 text-sm">
            <span className="flex items-center gap-2">
              <FileText className="w-4 h-4" /> Word 文档导入
            </span>
            <span className="flex items-center gap-2">
              <Headphones className="w-4 h-4" /> 音频播放
            </span>
            <span className="flex items-center gap-2">
              <Clock className="w-4 h-4" /> 自动评分
            </span>
          </div>
        </div>
      </section>

      {/* 试卷列表 */}
      <main className="flex-1 max-w-6xl mx-auto px-6 py-12 w-full">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold text-slate-900">可选试卷</h2>
          <span className="text-slate-500 text-sm">{exams.length} 套试卷</span>
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
        ) : exams.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <BookOpen className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-xl font-semibold text-slate-700 mb-2">暂无试卷</h3>
            <p className="text-slate-500 mb-6">管理员上传题目后，这里将显示可用试卷</p>
            <a
              href="/admin"
              className="inline-flex items-center gap-2 bg-blue-700 text-white px-6 py-3 rounded-xl font-medium hover:bg-blue-800 transition"
            >
              去上传题目 <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {exams.map(exam => (
              <a
                key={exam.id}
                href={`/exam/${exam.id}`}
                className="group bg-white rounded-2xl border border-slate-200 p-6 hover:border-blue-300 hover:shadow-lg hover:shadow-blue-100 transition-all duration-200"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 bg-blue-50 group-hover:bg-blue-100 rounded-xl flex items-center justify-center transition">
                    <Headphones className="w-6 h-6 text-blue-700" />
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
