"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { calcBandScore, getBandLabel, checkAnswer } from "@/lib/docParser";
import type { Exam, ExamSection, Question, UserAnswer, Annotation } from "@/types";
import {
  ChevronLeft, ChevronRight, Send, RotateCcw,
  Highlighter, Strikethrough, StickyNote, Eraser,
  Play, Pause, Volume2, SkipBack, SkipForward,
  CheckCircle2, XCircle, Trophy, AlertCircle
} from "lucide-react";
import { clsx } from "clsx";

// ============================================================
//  标注工具栏
// ============================================================
const HIGHLIGHT_COLORS = [
  { name: "黄色", class: "bg-yellow-200", hex: "#fef08a" },
  { name: "橙色", class: "bg-orange-200", hex: "#fed7aa" },
  { name: "绿色", class: "bg-green-200", hex: "#bbf7d0" },
  { name: "蓝色", class: "bg-blue-200", hex: "#bfdbfe" },
  { name: "粉色", class: "bg-pink-200", hex: "#fbcfe8" },
];

type ToolMode = "none" | "highlight" | "strikethrough" | "note";

function AnnotationToolbar({
  activeTool,
  activeColor,
  onTool,
  onColor,
  onClear,
}: {
  activeTool: ToolMode;
  activeColor: string;
  onTool: (t: ToolMode) => void;
  onColor: (c: string) => void;
  onClear: () => void;
}) {
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {/* 工具按钮 */}
      {[
        { tool: "highlight" as ToolMode, icon: Highlighter, label: "高亮" },
        { tool: "strikethrough" as ToolMode, icon: Strikethrough, label: "划线" },
        { tool: "note" as ToolMode, icon: StickyNote, label: "笔记" },
        { tool: "none" as ToolMode, icon: Eraser, label: "清除" },
      ].map(({ tool, icon: Icon, label }) => (
        <button
          key={tool}
          onClick={() => onTool(tool)}
          title={label}
          className={clsx(
            "p-2 rounded-lg transition text-sm",
            activeTool === tool
              ? tool === "none" ? "bg-red-100 text-red-700 ring-1 ring-red-300" : "bg-blue-100 text-blue-700 ring-1 ring-blue-300"
              : "text-slate-500 hover:bg-slate-100"
          )}
        >
          <Icon className="w-4 h-4" />
        </button>
      ))}

      {/* 颜色选择 */}
      {activeTool === "highlight" && (
        <div className="flex items-center gap-1 ml-2 pl-2 border-l border-slate-200">
          {HIGHLIGHT_COLORS.map(c => (
            <button
              key={c.name}
              onClick={() => onColor(c.hex)}
              title={c.name}
              className={clsx(
                "w-5 h-5 rounded-full transition ring-2",
                activeColor === c.hex ? "ring-offset-1 ring-slate-400" : "hover:scale-110",
                c.class
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
//  音频播放器
// ============================================================
function AudioPlayer({ src }: { src?: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [speed, setSpeed] = useState(1);

  const speeds = [0.75, 1, 1.25, 1.5, 2];

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  if (!src) return null;

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
      <audio
        ref={audioRef}
        src={src}
        onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime || 0)}
        onLoadedMetadata={() => setDuration(audioRef.current?.duration || 0)}
        onEnded={() => setPlaying(false)}
      />
      <div className="flex items-center gap-3">
        {/* 播放/暂停 */}
        <button
          onClick={() => {
            if (!audioRef.current) return;
            playing ? audioRef.current.pause() : audioRef.current.play();
            setPlaying(!playing);
          }}
          className="w-10 h-10 bg-blue-800 hover:bg-blue-900 text-white rounded-full flex items-center justify-center transition flex-shrink-0"
        >
          {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
        </button>

        {/* 进度条 */}
        <div className="flex-1">
          <input
            type="range"
            min={0}
            max={duration || 100}
            value={currentTime}
            onChange={e => {
              if (!audioRef.current) return;
              audioRef.current.currentTime = Number(e.target.value);
              setCurrentTime(Number(e.target.value));
            }}
            className="w-full h-1.5 accent-blue-800 cursor-pointer"
          />
          <div className="flex justify-between text-xs text-slate-400 mt-1">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* 快退 */}
        <button
          onClick={() => { if (audioRef.current) audioRef.current.currentTime -= 10; }}
          className="p-1.5 text-slate-400 hover:text-slate-700 transition"
          title="后退10秒"
        >
          <SkipBack className="w-4 h-4" />
        </button>

        {/* 快进 */}
        <button
          onClick={() => { if (audioRef.current) audioRef.current.currentTime += 10; }}
          className="p-1.5 text-slate-400 hover:text-slate-700 transition"
          title="前进10秒"
        >
          <SkipForward className="w-4 h-4" />
        </button>

        {/* 音量 */}
        <div className="flex items-center gap-1 text-slate-400">
          <Volume2 className="w-4 h-4" />
          <input
            type="range"
            min={0}
            max={1}
            step={0.1}
            value={volume}
            onChange={e => {
              if (!audioRef.current) return;
              audioRef.current.volume = Number(e.target.value);
              setVolume(Number(e.target.value));
            }}
            className="w-16 h-1 accent-blue-800 cursor-pointer"
          />
        </div>

        {/* 速度 */}
        <button
          onClick={() => {
            const idx = speeds.indexOf(speed);
            const next = speeds[(idx + 1) % speeds.length];
            setSpeed(next);
            if (audioRef.current) audioRef.current.playbackRate = next;
          }}
          className="px-2 py-1 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition"
        >
          {speed}x
        </button>
      </div>
    </div>
  );
}

// ============================================================
//  单行题目组件：题目 + 答题框在同一水平线
// ============================================================
function QuestionRow({
  question,
  answerValue,
  annotations,
  activeTool,
  activeColor,
  onAnswer,
  onAddAnnotation,
  onRemoveAnnotation,
  submitted,
}: {
  question: Question;
  answerValue: string;
  annotations: Annotation[];
  activeTool: ToolMode;
  activeColor: string;
  onAnswer: (qId: string, val: string) => void;
  onAddAnnotation: (a: Omit<Annotation, "id" | "createdAt">) => void;
  onRemoveAnnotation: (annId: string) => void;
  submitted: boolean;
}) {
  const [notes, setNotes] = useState<Record<string, string>>({});

  const handleTextSelect = () => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || activeTool === "none") return;
    const text = selection.toString().trim();
    if (!text) return;

    if (activeTool === "highlight" || activeTool === "strikethrough") {
      onAddAnnotation({
        type: activeTool,
        questionId: question.id,
        content: text,
        color: activeColor,
      });
      selection.removeAllRanges();
    } else if ((activeTool as string) === "none") {
      // 橡皮擦模式：选中文本后匹配并删除对应标注
      const matched = qAnns.find(a => a.type !== "note" && a.content === text);
      if (matched) {
        onRemoveAnnotation(matched.id);
        selection.removeAllRanges();
      }
    } else if (activeTool === "note") {
      const note = notes[question.id] || "";
      const newNote = prompt("输入笔记内容：", note);
      if (newNote !== null) {
        setNotes(prev => ({ ...prev, [question.id]: newNote }));
        onAddAnnotation({ type: "note", questionId: question.id, content: newNote, color: activeColor });
      }
    }
  };

  const qAnns = annotations.filter(a => a.questionId === question.id);
  const isCorrect = submitted && answerValue.trim() !== "" && checkAnswer(answerValue, question.answer);
  const isAnswered = submitted && answerValue.trim() !== "";

  // 将高亮/划线标注嵌入到原文 HTML 中（原地渲染，不在下方另起一行）
  const renderAnnotatedText = () => {
    let html = question.text;
    // 按在原文中出现的位置倒序排列，避免替换后偏移量变化
    const sortedAnn = [...qAnns.filter(a => a.type !== "note")].sort((a, b) => {
      return html.indexOf(a.content) - html.indexOf(b.content);
    });
    // 从后往前替换，保证位置不偏移
    for (let i = sortedAnn.length - 1; i >= 0; i--) {
      const ann = sortedAnn[i];
      const idx = html.indexOf(ann.content);
      if (idx !== -1) {
        const tag = ann.type === "highlight"
          ? `<mark data-ann-id="${ann.id}" style="background-color:${ann.color};border-radius:2px;padding:0 2px;cursor:pointer;">${ann.content}</mark>`
          : `<mark data-ann-id="${ann.id}" style="text-decoration:line-through;background:none;color:inherit;cursor:pointer;">${ann.content}</mark>`;
        html = html.substring(0, idx) + tag + html.substring(idx + ann.content.length);
      }
    }
    return html;
  };

  return (
    <div className={clsx(
      "flex gap-4 items-start p-4 rounded-2xl border shadow-sm transition",
      submitted && isCorrect && "border-green-300 bg-green-50/30",
      submitted && !isCorrect && isAnswered && "border-red-300 bg-red-50/30",
      !submitted && "bg-white border-slate-200"
    )}>
      {/* 左侧：题目文字 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded flex-shrink-0">
            Q{question.number}
          </span>
          {submitted && (
            isCorrect
              ? <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
              : isAnswered ? <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" /> : null
          )}
        </div>
        <p
          className={clsx(
            "text-slate-800 leading-relaxed text-[15px] select-text",
            activeTool !== "none" && !submitted && "cursor-crosshair"
          )}
          onMouseUp={() => handleTextSelect()}
          dangerouslySetInnerHTML={{ __html: renderAnnotatedText() }}
        />

        {/* 笔记气泡 */}
        {qAnns.filter(a => a.type === "note").map(ann => (
          <div key={ann.id} className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            📝 {ann.content}
          </div>
        ))}

        {/* 笔记输入框 */}
        {activeTool === "note" && !submitted && (
          <textarea
            placeholder="输入笔记..."
            className="mt-2 w-full text-xs border border-amber-200 bg-amber-50 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-amber-400"
            value={notes[question.id] || ""}
            onChange={e => setNotes(prev => ({ ...prev, [question.id]: e.target.value }))}
            rows={2}
          />
        )}

        {/* 提交后显示正确答案（错误或未作答时）*/}
        {submitted && !isCorrect && (
          <p className="text-xs text-green-700 mt-2 font-medium">
            ✓ 正确答案：<strong>{question.answer}</strong>
          </p>
        )}
      </div>

      {/* 右侧：答题框 */}
      <div className="w-44 flex-shrink-0 pt-7">
        <input
          type="text"
          value={answerValue}
          onChange={e => !submitted && onAnswer(question.id, e.target.value)}
          disabled={submitted}
          placeholder={submitted ? "—" : "输入答案..."}
          className={clsx(
            "w-full text-sm px-3 py-2 rounded-xl border transition text-center",
            "focus:outline-none focus:ring-2 focus:ring-blue-300",
            submitted && isCorrect && "border-green-300 bg-white text-green-800 font-semibold",
            submitted && !isCorrect && isAnswered && "border-red-300 bg-white text-red-800 line-through",
            submitted && !isAnswered && "border-slate-300 bg-slate-50 text-slate-400"
          )}
        />
      </div>
    </div>
  );
}

// ============================================================
//  成绩展示
// ============================================================
function ScoreCard({
  exam,
  answers,
  onRetry,
}: {
  exam: Exam;
  answers: Record<string, string>;
  onRetry: () => void;
}) {
  const allQuestions = exam.sections.flatMap(s => s.questions);
  let correct = 0;
  const detail: { q: Question; correct: boolean; user: string }[] = [];

  allQuestions.forEach(q => {
    const userAns = answers[q.id] || "";
    const ok = checkAnswer(userAns, q.answer);
    if (ok) correct++;
    detail.push({ q, correct: ok, user: userAns });
  });

  const band = calcBandScore(correct, allQuestions.length);
  const label = getBandLabel(band);
  const pct = Math.round((correct / allQuestions.length) * 100);

  // 找出弱项 Part
  const partScores: Record<number, { total: number; correct: number }> = {};
  detail.forEach(({ q, correct: ok }) => {
    if (!partScores[q.part]) partScores[q.part] = { total: 0, correct: 0 };
    partScores[q.part].total++;
    if (ok) partScores[q.part].correct++;
  });

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-12">
      <div className="max-w-5xl mx-auto w-full bg-white rounded-3xl shadow-xl p-8 md:p-10">
        {/* Band Score 大圆 */}
        <div className="text-center mb-8">
          <div className="relative inline-block">
            <svg viewBox="0 0 120 120" className="w-40 h-40 mx-auto">
              <circle cx="60" cy="60" r="50" fill="none" stroke="#e2e8f0" strokeWidth="10" />
              <circle
                cx="60" cy="60" r="50" fill="none"
                stroke="#1e40af" strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 50}`}
                strokeDashoffset={`${2 * Math.PI * 50 * (1 - pct / 100)}`}
                transform="rotate(-90 60 60)"
                className="transition-all duration-1000"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-4xl font-black text-blue-900">{band}</span>
              <span className="text-xs text-slate-500 font-medium">Band Score</span>
            </div>
          </div>
          <h2 className="text-2xl font-black text-slate-900 mt-4">{exam.title}</h2>
          <p className="text-slate-500 mt-1">{label}</p>
        </div>

        {/* 统计 */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { label: "正确题数", value: `${correct}/${allQuestions.length}`, color: "text-green-600" },
            { label: "正确率", value: `${pct}%`, color: "text-blue-600" },
            { label: "Band Score", value: band.toString(), color: "text-blue-900 font-bold" },
          ].map(stat => (
            <div key={stat.label} className="bg-slate-50 rounded-2xl p-4 text-center">
              <div className={`text-2xl font-black ${stat.color}`}>{stat.value}</div>
              <div className="text-xs text-slate-500 mt-1">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Part 得分 */}
        <div className="space-y-3 mb-8">
          {Object.entries(partScores).map(([part, { total, correct: c }]) => {
            const partPct = Math.round((c / total) * 100);
            return (
              <div key={part}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-slate-600">Part {part}</span>
                  <span className="text-slate-400">{c}/{total} · {partPct}%</span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-700 rounded-full transition-all duration-700"
                    style={{ width: `${partPct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* ── 逐题解析 ── */}
        <div className="mb-8">
          <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" /> 逐题解析
          </h3>
          <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
            {detail.map(({ q, correct: ok, user }) => (
              <div
                key={q.id}
                className={clsx(
                  "rounded-xl p-4 border transition",
                  ok
                    ? "bg-green-50 border-green-200"
                    : "bg-red-50 border-red-200"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    {/* 题号 */}
                    <span className="text-xs font-bold text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200 flex-shrink-0">
                      Q{q.number}
                    </span>
                    {/* 正确 → ✅，错误 → 红色用户答案 */}
                    {ok ? (
                      <span className="text-green-600 font-medium text-sm flex items-center gap-1 flex-shrink-0">
                        <CheckCircle2 className="w-4 h-4" /> 正确
                      </span>
                    ) : (
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-red-700 leading-relaxed break-words">
                          你的答案：
                          <strong className="ml-1 line-through decoration-red-400">
                            {user || "（未作答）"}
                          </strong>
                        </p>
                        <p className="text-xs text-green-700 mt-1.5 font-medium">
                          ✓ 正确答案：<strong>{q.answer}</strong>
                        </p>
                      </div>
                    )}
                  </div>
                </div>
                {/* 错误时显示题干（方便回顾）*/}
                {!ok && (
                  <p className="text-xs text-slate-500 mt-2 pl-12 border-t border-red-100 pt-2 leading-relaxed">
                    {q.text.length > 120 ? q.text.slice(0, 120) + "..." : q.text}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* 按钮 */}
        <div className="flex gap-3">
          <button
            onClick={onRetry}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border border-slate-300 text-slate-600 font-medium hover:bg-slate-50 transition"
          >
            <RotateCcw className="w-4 h-4" /> 再做一遍
          </button>
          <a
            href="/"
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-blue-700 text-white font-medium hover:bg-blue-800 transition"
          >
            <Trophy className="w-4 h-4" /> 返回首页
          </a>
        </div>
      </div>
    </div>
  );
}

// ============================================================
//  主页面
// ============================================================
export default function ExamPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user: authUser } = useAuth();

  const [exam, setExam] = useState<Exam | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentPart, setCurrentPart] = useState(1);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [activeTool, setActiveTool] = useState<ToolMode>("none");
  const [activeColor, setActiveColor] = useState("#fef08a");
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [imageScale, setImageScale] = useState(1); // 图片缩放比例 1-3
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0, scale: 1 });

  // 🖱️ 图片拖拽拉伸监听
  useEffect(() => {
    if (!isDragging) return;
    const handleMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - dragStart.x;
      const dy = e.clientY - dragStart.y;
      // 水平或垂直拖动距离取较大值来计算缩放
      const delta = Math.max(Math.abs(dx), Math.abs(dy));
      const direction = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : -1) : (dy > 0 ? 1 : -1);
      const newScale = dragStart.scale + direction * (delta / 200); // 拖动200px = 缩放1倍
      setImageScale(Math.max(1, Math.min(3, newScale)));
    };
    const handleMouseUp = () => setIsDragging(false);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, dragStart]);

  // 加载试卷
  useEffect(() => {
    if (!id) return;
    supabase
      .from("exams")
      .select("*")
      .eq("id", id)
      .single()
      .then(({ data, error }: { data: any; error: any }) => {
        if (error || !data) {
          router.push("/");
          return;
        }
        const parsed = {
          ...data,
          sections: data.sections || [],
          audioUrl: data.audio_url || "",
          imageUrl: data.image_url || undefined,
          imageBeforeQuestion: data.image_before_question || undefined,
        };
        setExam(parsed);
        setLoading(false);
      });
  }, [id, router]);

  const handleAnswer = useCallback((qId: string, val: string) => {
    setAnswers(prev => ({ ...prev, [qId]: val }));
  }, []);

  const handleAddAnnotation = useCallback(
    (a: Omit<Annotation, "id" | "createdAt">) => {
      setAnnotations(prev => [
        ...prev,
        { ...a, id: crypto.randomUUID(), createdAt: new Date().toISOString() },
      ]);
    },
    []
  );

  const handleSubmit = () => {
    if (submitted) {
      setSubmitted(false);
      setAnswers({});
      setAnnotations([]);
      return;
    }
    setSubmitted(true);
    // 记录到 Supabase
    const allQuestions = exam?.sections.flatMap(s => s.questions) || [];
    const correct = allQuestions.filter(
      q => answers[q.id] && checkAnswer(answers[q.id], q.answer)
    ).length;
    supabase.from("attempts").insert({
      exam_id: id,
      user_id: authUser?.id || null,
      answers: Object.entries(answers).map(([question_id, answer]) => ({
        question_id,
        answer,
      })),
      band_score: calcBandScore(correct, allQuestions.length),
      total_questions: allQuestions.length,
      correct_count: correct,
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-800 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-500">加载试卷中...</p>
        </div>
      </div>
    );
  }

  if (!exam) return null;

  const currentSection = exam.sections.find(s => s.part === currentPart) || exam.sections[0];
  const allParts = exam.sections.map(s => s.part).sort((a, b) => a - b);

  // 提交后显示成绩
  if (submitted) {
    return (
      <ScoreCard
        exam={exam}
        answers={answers}
        onRetry={() => { setSubmitted(false); setAnswers({}); setAnnotations([]); }}
      />
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* 顶部工具栏 */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <a href="/" className="p-2 hover:bg-slate-100 rounded-lg transition">
              <ChevronLeft className="w-5 h-5 text-slate-500" />
            </a>
            <div>
              <h1 className="font-bold text-slate-900 text-base">{exam.title}</h1>
              <p className="text-xs text-slate-400">
                Part {currentPart} · {currentSection?.questions.length} 题
              </p>
            </div>
          </div>

          {/* Part 切换 */}
          <div className="flex items-center gap-1">
            {allParts.map(part => (
              <button
                key={part}
                onClick={() => setCurrentPart(part)}
                className={clsx(
                  "px-4 py-1.5 rounded-full text-sm font-medium transition",
                  currentPart === part
                    ? "bg-blue-800 text-white"
                    : "text-slate-500 hover:bg-slate-100"
                )}
              >
                Part {part}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            {/* 标注工具 */}
            <div className="hidden md:flex items-center gap-1 bg-slate-50 rounded-xl px-3 py-1.5 border border-slate-200">
              <span className="text-xs text-slate-400 mr-1">标注：</span>
              <AnnotationToolbar
                activeTool={activeTool}
                activeColor={activeColor}
                onTool={setActiveTool}
                onColor={setActiveColor}
                onClear={() => setAnnotations([])}
              />
            </div>

            {/* 提交按钮 */}
            <button
              onClick={handleSubmit}
              className="flex items-center gap-2 bg-blue-800 hover:bg-blue-900 text-white px-5 py-2 rounded-xl font-medium text-sm transition"
            >
              <Send className="w-4 h-4" />
              提交批改
            </button>
          </div>
        </div>
      </header>

      {/* 音频播放器（始终显示，无音频时提示）*/}
      <div className="max-w-7xl mx-auto px-4 pt-4 w-full">
        {exam.audioUrl ? (
          <AudioPlayer src={exam.audioUrl} />
        ) : (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 text-sm text-amber-700 flex items-center gap-2">
            ⚠️ 本试卷未配置音频文件
          </div>
        )}
      </div>

      {/* 单列主体：每行一道题（题目+答题框同线）*/}
      <div className="flex-1 w-full px-6 py-6">
        {/* Part 标题卡片 */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm mb-4">
          <h2 className="text-xl font-bold text-slate-900">{currentSection?.title}</h2>
          {currentSection?.instruction && (
            <p className="text-slate-500 text-sm mt-2 leading-relaxed">
              {currentSection.instruction}
            </p>
          )}
          <div className="flex gap-2 mt-3 flex-wrap">
            {currentSection?.questions.map(q => (
              <button
                key={q.id}
                onClick={() => {
                  const el = document.getElementById(`q-row-${q.id}`);
                  el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }}
                className="w-9 h-9 text-sm font-medium rounded-lg border border-slate-200 text-slate-600 hover:border-blue-400 hover:text-blue-700 transition"
              >
                {q.number}
              </button>
            ))}
          </div>
        </div>

        {/* 信息行 + 题目列表 */}
        <div className="flex flex-col gap-3">
          {(() => {
            // 单个 item 渲染辅助函数（无地图时的普通行 / 地图前的普通行共用）
            const renderItem = (item: { type: "question" | "info"; q?: Question; info?: { id: string; text: string } }) => {
              if (item.type === "info" && item.info) {
                return (
                  <div
                    key={item.info.id}
                    className="bg-blue-50/60 border border-blue-100 rounded-2xl p-4 shadow-sm"
                  >
                    <p className="text-sm text-slate-600 leading-relaxed select-text">
                      {item.info.text}
                    </p>
                  </div>
                );
              }
              const q = item.q!;
              return (
                <div id={`q-row-${q.id}`} key={q.id}>
                  <QuestionRow
                    question={q}
                    answerValue={answers[q.id] || ""}
                    annotations={annotations}
                    activeTool={activeTool}
                    activeColor={activeColor}
                    onAnswer={handleAnswer}
                    onAddAnnotation={handleAddAnnotation}
                    onRemoveAnnotation={(annId) => setAnnotations(prev => prev.filter(a => a.id !== annId))}
                    submitted={submitted}
                  />
                </div>
              );
            };

            const items: Array<{ type: "question" | "info"; q?: Question; info?: { id: string; text: string } }> = [];
            let infoIdx = 0;
            currentSection?.questions.forEach((q) => {
              if (infoIdx < (currentSection.infoItems || []).length) {
                items.push({ type: "info", info: (currentSection.infoItems || [])[infoIdx++] });
              }
              items.push({ type: "question", q });
            });
            while (infoIdx < (currentSection.infoItems || []).length) {
              items.push({ type: "info", info: (currentSection.infoItems || [])[infoIdx++] });
            }

            // 检测是否有地图图片，如果有则使用左右分栏布局
            const hasMapImage = !!exam.imageUrl && exam.imageBeforeQuestion;
            const mapStartQ = exam.imageBeforeQuestion || 0;

            // 将 items 按「地图前 / 地图题组 / 地图后」三段拆分
            if (hasMapImage) {
              const beforeMap: typeof items = [];
              const mapGroup: typeof items = [];
              const afterMap: typeof items = [];
              let enteredMap = false;
              let passedMap = false;

              for (const item of items) {
                if (!enteredMap && item.type === "question" && item.q && item.q.number >= mapStartQ) {
                  enteredMap = true;
                }
                if (enteredMap && !passedMap && item.type === "question" && item.q && item.q.number > mapStartQ + 6) {
                  // 地图题通常连续 4-8 题，超过范围后切到 afterMap
                  // 更智能的判断：如果遇到 infoItem 且已经过了地图起始题一定数量
                }
                if (!enteredMap) {
                  beforeMap.push(item);
                } else {
                  mapGroup.push(item);
                }
              }

              return (
                <>
                  {/* 地图前的题目 */}
                  {beforeMap.map(item => renderItem(item))}

                  {/* 🗺️ 地图左右分栏区域 */}
                  {mapGroup.length > 0 && (
                    <div className="flex gap-5 items-start bg-white border-2 border-emerald-100 rounded-2xl p-5 shadow-sm">
                      {/* 左侧：地图大图（可拖拽拉伸） */}
                      <div className="w-[55%] flex-shrink-0 select-none">
                        <div
                          className="rounded-xl overflow-hidden border border-slate-200 bg-white shadow-inner relative"
                          style={{ minHeight: 200 }}
                        >
                          <img
                            src={exam.imageUrl}
                            alt="地图 / 示意图"
                            className="w-full object-contain transition-transform duration-75"
                            style={{
                              transform: `scale(${imageScale})`,
                              transformOrigin: "top left",
                              cursor: isDragging ? "grabbing" : imageScale > 1 ? "grab" : "zoom-in",
                              maxHeight: 520 * imageScale,
                              userSelect: "none",
                            }}
                            onMouseDown={(e) => {
                              // 左键拖拽拉伸
                              if (e.button !== 0) return;
                              e.preventDefault();
                              setIsDragging(true);
                              setDragStart({ x: e.clientX, y: e.clientY, scale: imageScale });
                            }}
                            onClick={() => {
                              if (!isDragging) setLightboxOpen(true);
                            }}
                          />
                        </div>
                        {/* 缩放控制条 */}
                        <div className="flex items-center justify-center gap-2 mt-2">
                          <button
                            onClick={() => setImageScale(s => Math.max(1, s - 0.25))}
                            className="px-2.5 py-1 text-xs bg-slate-100 hover:bg-slate-200 rounded-md transition-colors font-medium text-slate-600"
                            title="缩小"
                          >➖</button>
                          <span className="text-xs text-slate-500 font-mono min-w-[4rem] text-center">
                            {Math.round(imageScale * 100)}%
                          </span>
                          <button
                            onClick={() => setImageScale(s => Math.min(3, s + 0.25))}
                            className="px-2.5 py-1 text-xs bg-slate-100 hover:bg-slate-200 rounded-md transition-colors font-medium text-slate-600"
                            title="放大 / 拖拽图片也可拉伸"
                          >➕</button>
                          <button
                            onClick={() => setImageScale(1)}
                            className="px-2.5 py-1 text-xs bg-slate-100 hover:bg-slate-200 rounded-md transition-colors text-slate-400"
                            title="重置大小"
                          >↺</button>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1 text-center">拖拽拉伸 · 点击放大 · 最大300%</p>
                      </div>

                      {/* 右侧：题目列表 */}
                      <div className="flex-1 min-w-0 flex flex-col gap-2.5">
                        {mapGroup.map(item => {
                          if (item.type === "info" && item.info) {
                            return (
                              <div key={item.info.id} className="bg-blue-50/60 border border-blue-100 rounded-xl p-3 shadow-sm">
                                <p className="text-sm text-slate-600 leading-relaxed select-text">{item.info.text}</p>
                              </div>
                            );
                          }
                          const q = item.q!;
                          return (
                            <div id={`q-row-${q.id}`} key={q.id}>
                              <QuestionRow
                                question={q}
                                answerValue={answers[q.id] || ""}
                                annotations={annotations}
                                activeTool={activeTool}
                                activeColor={activeColor}
                                onAnswer={handleAnswer}
                                onAddAnnotation={handleAddAnnotation}
                                onRemoveAnnotation={(annId) => setAnnotations(prev => prev.filter(a => a.id !== annId))}
                                submitted={submitted}
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* 🖼️ Lightbox 图片放大弹窗 */}
                  {lightboxOpen && exam.imageUrl && (
                    <div
                      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
                      onClick={() => setLightboxOpen(false)}
                    >
                      <div className="relative max-w-[90vw] max-h-[90vh]" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => setLightboxOpen(false)}
                          className="absolute -top-10 right-0 text-white/80 hover:text-white transition-colors text-sm flex items-center gap-1"
                        >
                          ✕ 关闭 (ESC)
                        </button>
                        <img
                          src={exam.imageUrl}
                          alt="地图 / 示意图（放大）"
                          className="max-w-[90vw] max-h-[85vh] object-contain rounded-lg shadow-2xl"
                        />
                        <p className="text-center text-white/50 text-xs mt-2">点击空白处关闭</p>
                      </div>
                    </div>
                  )}
                </>
              );
            }

            // 无地图：正常渲染
            return items.map(item => renderItem(item));
          })()}
        </div>
      </div>

      {/* Part 翻页 */}
      <div className="bg-white border-t border-slate-200 px-6 py-3">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setCurrentPart(p => Math.max(1, p - 1))}
            disabled={currentPart <= 1}
            className="flex items-center gap-2 px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition"
          >
            <ChevronLeft className="w-4 h-4" /> 上一 Part
          </button>

          <div className="flex items-center gap-2">
            {allParts.map(part => (
              <button
                key={part}
                onClick={() => setCurrentPart(part)}
                className={clsx(
                  "w-8 h-8 text-xs font-medium rounded-full transition",
                  currentPart === part
                    ? "bg-blue-800 text-white"
                    : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                )}
              >
                {part}
              </button>
            ))}
          </div>

          <button
            onClick={() => setCurrentPart(p => Math.min(allParts.length, p + 1))}
            disabled={currentPart >= allParts.length}
            className="flex items-center gap-2 px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition"
          >
            下一 Part <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
