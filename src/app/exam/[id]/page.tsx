"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { calcBandScore, getBandLabel, checkAnswer } from "@/lib/docParser";
import type { Exam, ExamSection, Question, UserAnswer, Annotation } from "@/types";
import {
  ChevronLeft, ChevronRight, Send, RotateCcw,
  Highlighter, Strikethrough, StickyNote, Eraser,
  Play, Pause, Volume2, SkipBack, SkipForward,
  CheckCircle2, XCircle, Trophy
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
          onClick={() => onTool(tool === "none" ? "none" : tool)}
          title={label}
          className={clsx(
            "p-2 rounded-lg transition text-sm",
            activeTool === tool && tool !== "none"
              ? "bg-blue-100 text-blue-700 ring-1 ring-blue-300"
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
//  题目面板（左）
// ============================================================
function QuestionPanel({
  section,
  annotations,
  activeTool,
  activeColor,
  onAddAnnotation,
  submitted,
}: {
  section: ExamSection;
  annotations: Annotation[];
  activeTool: ToolMode;
  activeColor: string;
  onAddAnnotation: (a: Omit<Annotation, "id" | "createdAt">) => void;
  submitted: boolean;
}) {
  const [notes, setNotes] = useState<Record<string, string>>({});
  const highlightRefs = useRef<Record<string, HTMLSpanElement | null>>({});

  const handleTextSelect = (qId: string) => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || activeTool === "none") return;
    const text = selection.toString().trim();
    if (!text) return;

    if (activeTool === "highlight" || activeTool === "strikethrough") {
      onAddAnnotation({
        type: activeTool,
        questionId: qId,
        content: text,
        color: activeColor,
      });
      selection.removeAllRanges();
    } else if (activeTool === "note") {
      const note = notes[qId] || "";
      const newNote = prompt("输入笔记内容：", note);
      if (newNote !== null) {
        setNotes(prev => ({ ...prev, [qId]: newNote }));
        onAddAnnotation({ type: "note", questionId: qId, content: newNote, color: activeColor });
      }
    }
  };

  const getAnnotations = (qId: string) =>
    annotations.filter(a => a.questionId === qId);

  return (
    <div className="flex flex-col gap-4">
      {/* Part 标题 */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        <h2 className="text-xl font-bold text-slate-900">{section.title}</h2>
        {section.instruction && (
          <p className="text-slate-500 text-sm mt-2 leading-relaxed">
            {section.instruction}
          </p>
        )}
        <div className="flex gap-2 mt-3 flex-wrap">
          {section.questions.map(q => (
            <button
              key={q.id}
              className="w-9 h-9 text-sm font-medium rounded-lg border border-slate-200 text-slate-600 hover:border-blue-400 hover:text-blue-700 transition"
            >
              {q.number}
            </button>
          ))}
        </div>
      </div>

      {/* 每道题 */}
      {section.questions.map(q => {
        const qAnns = getAnnotations(q.id);
        return (
          <div
            key={q.id}
            className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm"
          >
            <div className="flex items-start justify-between mb-3">
              <span className="text-sm font-semibold text-slate-400">
                Q{q.number}
              </span>
              {submitted && (
                <span className={clsx(
                  "text-xs font-bold px-2 py-0.5 rounded-full",
                  qAnns.some(a => a.type === "highlight")
                    ? "bg-green-100 text-green-700"
                    : "bg-slate-100 text-slate-500"
                )}>
                  答案：{q.answer}
                </span>
              )}
            </div>

            <p
              className={clsx(
                "text-slate-800 leading-relaxed text-[15px] select-text",
                activeTool !== "none" && !submitted && "cursor-crosshair"
              )}
              onMouseUp={() => handleTextSelect(q.id)}
            >
              {q.text}
            </p>

            {/* 显示高亮/划线 */}
            {qAnns.filter(a => a.type !== "note").map(ann => (
              <mark
                key={ann.id}
                className={clsx(
                  ann.type === "highlight" ? "rounded px-0.5" : "line-through",
                  "bg-opacity-50"
                )}
                style={{ backgroundColor: ann.color }}
              >
                {ann.content}
              </mark>
            ))}

            {/* 笔记气泡 */}
            {qAnns.filter(a => a.type === "note").map(ann => (
              <div
                key={ann.id}
                className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2"
              >
                📝 {ann.content}
              </div>
            ))}

            {/* 笔记输入框（当前工具为笔记时） */}
            {activeTool === "note" && !submitted && (
              <textarea
                placeholder="输入笔记..."
                className="mt-2 w-full text-xs border border-amber-200 bg-amber-50 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-amber-400"
                value={notes[q.id] || ""}
                onChange={e => setNotes(prev => ({ ...prev, [q.id]: e.target.value }))}
                rows={2}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ============================================================
//  作答面板（右）
// ============================================================
function AnswerPanel({
  section,
  answers,
  onAnswer,
  submitted,
  onToggle,
}: {
  section: ExamSection;
  answers: Record<string, string>;
  onAnswer: (qId: string, val: string) => void;
  submitted: boolean;
  onToggle: (qId: string) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm sticky top-20">
        <h3 className="font-bold text-slate-800 text-sm mb-3">{section.title} · 作答区</h3>
        <div className="text-xs text-slate-400">
          {section.questions.length} 道题
        </div>
      </div>

      {section.questions.map(q => {
        const userAns = answers[q.id] || "";
        const isCorrect = submitted && userAns.trim() !== "";
        const correct = submitted && userAns.trim() !== "" && checkAnswer(userAns, q.answer);

        return (
          <div
            key={q.id}
            className={clsx(
              "bg-white border rounded-2xl p-4 shadow-sm transition",
              submitted && correct && "border-green-300 bg-green-50",
              submitted && !correct && isCorrect && "border-red-300 bg-red-50",
              !submitted && "border-slate-200"
            )}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-400">Q{q.number}</span>
              {submitted && (
                correct
                  ? <CheckCircle2 className="w-4 h-4 text-green-600" />
                  : isCorrect
                    ? <XCircle className="w-4 h-4 text-red-500" />
                    : null
              )}
            </div>

            <input
              type="text"
              value={userAns}
              onChange={e => !submitted && onAnswer(q.id, e.target.value)}
              disabled={submitted}
              placeholder={submitted ? "" : "输入答案..."}
              className={clsx(
                "w-full text-sm px-3 py-2 rounded-xl border transition",
                "focus:outline-none focus:ring-2 focus:ring-blue-300",
                submitted && correct && "border-green-300 bg-white text-green-800",
                submitted && !correct && isCorrect && "border-red-300 bg-white text-red-800 line-through",
                submitted && !isCorrect && "border-slate-300 bg-slate-50 text-slate-400"
              )}
            />

            {submitted && !correct && isCorrect && (
              <p className="text-xs text-green-700 mt-1.5">
                ✓ 正确答案：<strong>{q.answer}</strong>
              </p>
            )}
            {submitted && !isCorrect && (
              <p className="text-xs text-slate-500 mt-1.5">
                你未作答此题
              </p>
            )}
          </div>
        );
      })}
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
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-12">
      <div className="max-w-xl w-full bg-white rounded-3xl shadow-xl p-8 md:p-10">
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

  const [exam, setExam] = useState<Exam | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentPart, setCurrentPart] = useState(1);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [activeTool, setActiveTool] = useState<ToolMode>("none");
  const [activeColor, setActiveColor] = useState("#fef08a");

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
        const parsed = { ...data, sections: data.sections || [] };
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

      {/* 音频播放器 */}
      {exam.audioUrl && (
        <div className="max-w-7xl mx-auto px-4 pt-4 w-full">
          <AudioPlayer src={exam.audioUrl} />
        </div>
      )}

      {/* 左右分栏主体 */}
      <div className="flex-1 max-w-7xl mx-auto w-full px-4 py-6">
        <div className="flex gap-6 h-full">
          {/* 左侧：题目 */}
          <div className="flex-1 min-w-0">
            <QuestionPanel
              section={currentSection}
              annotations={annotations}
              activeTool={activeTool}
              activeColor={activeColor}
              onAddAnnotation={handleAddAnnotation}
              submitted={submitted}
            />
          </div>

          {/* 右侧：作答 */}
          <div className="w-80 flex-shrink-0">
            <AnswerPanel
              section={currentSection}
              answers={answers}
              onAnswer={handleAnswer}
              submitted={submitted}
              onToggle={() => {}}
            />
          </div>
        </div>
      </div>

      {/* Part 翻页 */}
      <div className="bg-white border-t border-slate-200 px-6 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
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
