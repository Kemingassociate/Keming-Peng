// ============================================================
//  核心类型定义
// ============================================================

export interface Question {
  id: string;
  number: number;
  part: number;
  text: string;
  type: "fill-blank" | "multiple-choice" | "true-false" | "short-answer";
  answer: string; // 标准答案（支持 / 分隔多个答案）
  maxWords?: number;
}

export interface ExamSection {
  part: number;
  title: string;
  instruction?: string;
  questions: Question[];
}

export type IELTSModule = "listening" | "reading" | "writing" | "speaking";

export interface Exam {
  id: string;
  title: string;
  description?: string;
  module: IELTSModule; // 雅思模块
  audioUrl?: string;
  wordUrl?: string;
  duration?: number; // 分钟
  sections: ExamSection[];
  createdAt: string;
  isPublished: boolean;
}

export interface UserAnswer {
  questionId: string;
  answer: string;
}

export interface ExamAttempt {
  id: string;
  examId: string;
  answers: UserAnswer[];
  score: number;
  bandScore: number;
  totalQuestions: number;
  correctCount: number;
  completedAt: string;
}

export type AnnotationTool = "highlight" | "strikethrough" | "note" | "eraser" | "none";

export interface Annotation {
  id: string;
  type: "highlight" | "strikethrough" | "note";
  questionId: string;
  content: string;
  color: string;
  createdAt: string;
}

// 解析器输出类型（对接 Word 文档）
export interface ParsedDoc {
  title: string;
  sections: ExamSection[];
}
