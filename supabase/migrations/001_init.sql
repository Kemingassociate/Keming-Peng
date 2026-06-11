-- ============================================================
--  IELTS Mock — Supabase 数据库初始化
--  运行方式：在 Supabase Dashboard → SQL Editor → 粘贴执行
-- ============================================================

-- ── exams 表 ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.exams (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  title       TEXT        NOT NULL,
  description TEXT,
  audio_url   TEXT,
  word_url    TEXT,
  sections    JSONB       NOT NULL DEFAULT '[]',
  -- sections 格式：[{
  --   "part": 1,
  --   "title": "Part 1",
  --   "instruction": "...",
  --   "questions": [
  --     { "id": "q-1", "number": 1, "part": 1, "text": "...", "type": "fill-blank", "answer": "..." }
  --   ]
  -- }]
  duration    INTEGER, -- 分钟
  is_published BOOLEAN   DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- 允许公开读取试卷列表
ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read published exams"
  ON public.exams FOR SELECT
  USING (is_published = true);

CREATE POLICY "Allow authenticated insert exams"
  ON public.exams FOR INSERT
  WITH CHECK (true);

-- ── attempts 表 ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.attempts (
  id               UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  exam_id          UUID        REFERENCES public.exams(id) ON DELETE CASCADE,
  answers          JSONB       DEFAULT '[]',
  -- answers 格式：[ { "question_id": "...", "answer": "..." } ]
  band_score       NUMERIC(3,1),
  total_questions  INTEGER,
  correct_count    INTEGER,
  completed_at     TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public insert attempts"
  ON public.attempts FOR INSERT
  WITH CHECK (true);

-- ── Storage Bucket ────────────────────────────────────────
-- 在 Supabase Dashboard → Storage → 手动创建名为 "exam-materials" 的 bucket
-- 并设置 Public（让音频可以直接访问）

-- 或者用 SQL 创建（需要先确保 Storage 已启用）：
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('exam-materials', 'exam-materials', true)
-- ON CONFLICT (id) DO NOTHING;
