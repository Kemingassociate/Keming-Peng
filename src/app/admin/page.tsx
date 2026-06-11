"use client";
import { useState, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { parseDocx, checkAnswer } from "@/lib/docParser";
import type { Exam, ParsedDoc } from "@/types";
import {
  Upload, FileText, Music, CheckCircle2, XCircle,
  ChevronLeft, ChevronRight, Save, Eye, Plus, Trash2,
  AlertCircle, Loader2
} from "lucide-react";
import { clsx } from "clsx";

type Step = "upload" | "preview" | "saved";

export default function AdminPage() {
  const [step, setStep] = useState<Step>("upload");
  const [parsed, setParsed] = useState<ParsedDoc | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [savedId, setSavedId] = useState<string | null>(null);

  // Word 文件预览用的本地 URL
  const [wordPreviewUrl, setWordPreviewUrl] = useState<string | null>(null);

  // 处理 Word 上传并解析
  const handleWordFile = useCallback(async (file: File) => {
    setError("");
    setWordPreviewUrl(URL.createObjectURL(file));
    try {
      const result = await parseDocx(file);
      const totalQs = result.sections.reduce((s, sec) => s + sec.questions.length, 0);
      if (totalQs === 0) {
        setError("⚠️ 解析成功但未识别到题目，请检查文档格式。");
      } else {
        setParsed(result);
        setTitle(result.title);
        setStep("preview");
      }
    } catch (err) {
      setError("文档解析失败：" + (err as Error).message);
    }
  }, []);

  // 处理音频上传
  const handleAudioFile = useCallback((file: File) => {
    if (!file.type.startsWith("audio/")) {
      setError("请上传音频文件（mp3, wav 等）");
      return;
    }
    setAudioFile(file);
  }, []);

  // 上传到 Supabase 并保存
  const handleSave = async () => {
    if (!parsed) return;
    setUploading(true);
    setError("");

    try {
      let audioUrl = "";
      let wordUrl = wordPreviewUrl || "";

      // 上传音频到 Supabase Storage
      if (audioFile) {
        const ext = audioFile.name.split(".").pop();
        const audioPath = `audio/${Date.now()}.${ext}`;
        const { error: audioErr } = await supabase.storage
          .from("exam-materials")
          .upload(audioPath, audioFile);
        if (audioErr) {
          console.warn("音频上传失败（可能未创建 Storage bucket）：", audioErr.message);
        } else {
          const { data } = supabase.storage.from("exam-materials").getPublicUrl(audioPath);
          audioUrl = data.publicUrl;
        }
      }

      // 保存试卷到数据库
      const { data, error: dbErr } = await supabase
        .from("exams")
        .insert({
          title: title.trim() || "IELTS Listening Test",
          description: description.trim(),
          audio_url: audioUrl,
          sections: parsed.sections,
          is_published: true,
          duration: 30,
        })
        .select("id")
        .single();

      if (dbErr) throw dbErr;

      setSavedId(data.id);
      setStep("saved");
    } catch (err) {
      setError("保存失败：" + (err as Error).message);
    } finally {
      setUploading(false);
    }
  };

  // 预览某道题
  const [previewQ, setPreviewQ] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* 顶部导航 */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center gap-4">
          <a href="/" className="p-2 hover:bg-slate-100 rounded-lg transition">
            <ChevronLeft className="w-5 h-5 text-slate-500" />
          </a>
          <h1 className="font-bold text-slate-900 text-lg">上传题目</h1>
          <span className="ml-auto text-xs text-slate-400">管理员面板</span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10">
        {/* 步骤指示 */}
        <div className="flex items-center justify-center gap-0 mb-10">
          {(["upload", "preview", "saved"] as const).map((s, i) => (
            <div key={s} className="flex items-center">
              <div className={clsx(
                "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold",
                step === s ? "bg-blue-800 text-white" :
                (["upload", "preview", "saved"].indexOf(step) > i ? "bg-green-500 text-white" : "bg-slate-200 text-slate-400")
              )}>
                {["upload", "preview", "saved"].indexOf(step) > i ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
              </div>
              <span className={clsx(
                "ml-2 text-sm font-medium",
                step === s ? "text-blue-800" : "text-slate-400"
              )}>
                {s === "upload" ? "上传文件" : s === "preview" ? "确认题目" : "完成"}
              </span>
              {i < 2 && <div className={clsx(
                "w-12 h-0.5 mx-3",
                ["upload", "preview", "saved"].indexOf(step) > i ? "bg-green-400" : "bg-slate-200"
              )} />}
            </div>
          ))}
        </div>

        {/* ── 步骤 1：上传 ── */}
        {step === "upload" && (
          <div className="space-y-6">
            {/* 试卷标题 */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <h2 className="font-semibold text-slate-800 mb-4">基本信息</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1.5">
                    试卷标题 *
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder="如：Cambridge IELTS 20 - Test 4"
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1.5">
                    描述（可选）
                  </label>
                  <textarea
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="如：听力 Section 1，包含 10 道填空题..."
                    rows={2}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none"
                  />
                </div>
              </div>
            </div>

            {/* Word 上传 */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
                  <FileText className="w-5 h-5 text-blue-700" />
                </div>
                <div>
                  <h2 className="font-semibold text-slate-800">Word 题目文档</h2>
                  <p className="text-xs text-slate-400">.docx 格式，包含题目和答案</p>
                </div>
              </div>

              <UploadZone
                accept=".docx"
                icon={<FileText className="w-8 h-8 text-blue-400" />}
                label="点击上传 Word 文档"
                sublabel="或拖拽文件到此处"
                onFile={handleWordFile}
              />

              <div className="mt-4 p-4 bg-slate-50 rounded-xl text-xs text-slate-500 leading-relaxed">
                <p className="font-semibold text-slate-600 mb-1">支持格式说明：</p>
                <p>填空题格式：<code className="bg-slate-200 px-1 rounded">11__________</code> 在题目正文中，答案统一放在文档末尾，写上 <code className="bg-slate-200 px-1 rounded">答案：</code> 后每行一个答案。</p>
              </div>
            </div>

            {/* 音频上传 */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center">
                  <Music className="w-5 h-5 text-purple-700" />
                </div>
                <div>
                  <h2 className="font-semibold text-slate-800">听力音频</h2>
                  <p className="text-xs text-slate-400">mp3 / wav / m4a 格式（可选）</p>
                </div>
              </div>

              {audioFile ? (
                <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-xl">
                  <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
                  <span className="text-sm text-green-800 font-medium flex-1 truncate">
                    {audioFile.name}
                  </span>
                  <button
                    onClick={() => setAudioFile(null)}
                    className="text-slate-400 hover:text-red-500 transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <UploadZone
                  accept="audio/*,.mp3,.wav,.m4a"
                  icon={<Music className="w-8 h-8 text-purple-400" />}
                  label="点击上传音频文件"
                  sublabel="支持 mp3, wav, m4a"
                  onFile={handleAudioFile}
                />
              )}
            </div>

            {error && (
              <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}
          </div>
        )}

        {/* ── 步骤 2：预览 ── */}
        {step === "preview" && parsed && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-bold text-slate-900 text-lg">题目预览</h2>
                <div className="text-sm text-slate-400">
                  共 {parsed.sections.reduce((s, sec) => s + sec.questions.length, 0)} 道题
                </div>
              </div>

              {parsed.sections.map(section => (
                <div key={section.part} className="mb-6 last:mb-0">
                  <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                    <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-0.5 rounded-full">
                      {section.title}
                    </span>
                    <span className="text-slate-400 text-xs">{section.questions.length} 题</span>
                  </h3>
                  <div className="space-y-2">
                    {section.questions.map(q => (
                      <div
                        key={q.id}
                        className="bg-slate-50 rounded-xl p-3 flex items-start gap-3"
                      >
                        <span className="text-xs font-bold text-slate-400 w-8 flex-shrink-0 pt-0.5">
                          Q{q.number}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-slate-700 line-clamp-2">{q.text}</p>
                          <p className="text-xs text-green-700 mt-1 font-medium">
                            答案：{q.answer || <span className="text-amber-500">（未识别）</span>}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* 编辑标题 */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <h3 className="font-semibold text-slate-800 mb-4">试卷信息</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1.5">标题</label>
                  <input
                    type="text"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1.5">描述</label>
                  <textarea
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    rows={2}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none"
                  />
                </div>
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setStep("upload")}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border border-slate-300 text-slate-600 font-medium hover:bg-slate-50 transition"
              >
                <ChevronLeft className="w-4 h-4" /> 重新上传
              </button>
              <button
                onClick={handleSave}
                disabled={uploading}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-blue-800 text-white font-medium hover:bg-blue-900 transition disabled:opacity-60"
              >
                {uploading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> 保存中...</>
                ) : (
                  <><Save className="w-4 h-4" /> 保存并发布</>
                )}
              </button>
            </div>
          </div>
        )}

        {/* ── 步骤 3：完成 ── */}
        {step === "saved" && savedId && (
          <div className="text-center py-12">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-10 h-10 text-green-600" />
            </div>
            <h2 className="text-2xl font-black text-slate-900 mb-3">试卷已发布！</h2>
            <p className="text-slate-500 mb-8">考生现在可以在首页看到这份试卷并开始作答。</p>
            <div className="flex gap-3 justify-center">
              <a
                href="/"
                className="px-6 py-3 rounded-xl border border-slate-300 text-slate-600 font-medium hover:bg-slate-50 transition"
              >
                返回首页
              </a>
              <a
                href={`/exam/${savedId}`}
                className="px-6 py-3 rounded-xl bg-blue-800 text-white font-medium hover:bg-blue-900 transition"
              >
                预览试卷
              </a>
              <button
                onClick={() => {
                  setStep("upload");
                  setParsed(null);
                  setTitle("");
                  setDescription("");
                  setAudioFile(null);
                  setSavedId(null);
                }}
                className="px-6 py-3 rounded-xl border border-slate-300 text-slate-600 font-medium hover:bg-slate-50 transition"
              >
                <Plus className="w-4 h-4 inline mr-1" /> 再上传一份
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// ============================================================
//  上传区域组件
// ============================================================
function UploadZone({
  accept,
  icon,
  label,
  sublabel,
  onFile,
}: {
  accept: string;
  icon: React.ReactNode;
  label: string;
  sublabel: string;
  onFile: (f: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) onFile(file);
  };

  return (
    <div
      className={clsx(
        "border-2 border-dashed rounded-2xl p-10 text-center transition cursor-pointer",
        dragging ? "border-blue-400 bg-blue-50" : "border-slate-200 hover:border-blue-300 hover:bg-blue-50/50"
      )}
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={e => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
        }}
      />
      <div className="flex flex-col items-center gap-3">
        <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center">
          {icon}
        </div>
        <div>
          <p className="font-medium text-slate-700">{label}</p>
          <p className="text-xs text-slate-400 mt-1">{sublabel}</p>
        </div>
      </div>
    </div>
  );
}
