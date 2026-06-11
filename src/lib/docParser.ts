import JSZip from "jszip";
import * as XLSX from "xlsx";
import type { ParsedDoc, Question, ExamSection } from "@/types";

/**
 * 智能解析：自动识别 .docx 与 .xlsx，返回统一 ParsedDoc
 */
export async function parseDocx(file: File): Promise<ParsedDoc> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
    return await parseExcel(file, name.endsWith(".xls"));
  }
  return await parseWordDocx(file);
}

// ============================================================
// 从 Word .docx 解析
// ============================================================
async function parseWordDocx(file: File): Promise<ParsedDoc> {
  const arrayBuffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(arrayBuffer);
  const docXml = await zip.file("word/document.xml")?.async("string");
  if (!docXml) throw new Error("无法读取 Word 文档内容，请确认是 .docx 格式");

  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(docXml, "application/xml");
  let textNodes: HTMLCollectionOf<Element> = xmlDoc.getElementsByTagName("w:t");
  if (textNodes.length === 0) textNodes = xmlDoc.getElementsByTagName("t");

  const parts: string[] = [];
  for (let i = 0; i < textNodes.length; i++) parts.push(textNodes[i].textContent ?? "");
  const rawText = parts.join("");

  // 优先格式 C（内嵌答案：[答案：xxx]）
  const resultC = tryParseFormatC(rawText);
  if (resultC.sections.length > 0 && resultC.sections[0].questions.length > 0) return resultC;

  // 格式 A（末尾答案区）
  const resultA = tryParseFormatFormatA(rawText);
  if (resultA.sections.length > 0 && resultA.sections[0].questions.length > 0) return resultA;

  // 回退格式 B
  return tryParseFormatB(rawText);
}

// ============================================================
// 格式 C：内嵌答案（[答案：xxx] 或 答案：xxx）
// 每道题一行，B=题干（含编号空白），H=[答案：xxx]
// ============================================================
function tryParseFormatC(rawText: string): ParsedDoc {
  const title = extractTitle(rawText);

  // 找出所有带编号的空白占位
  const blankRe = /(\d{1,2})\s*_{5,}/g;
  const blanks: { num: number; index: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = blankRe.exec(rawText)) !== null) {
    blanks.push({ num: parseInt(m[1]), index: m.index });
  }
  if (blanks.length === 0) return { title, sections: [] };

  // 构建每道题的答案映射（格式C在题目行下方直接给出答案）
  const answerMap: Record<number, string> = buildAnswerMapFormatC(rawText, blanks);

  // 构建每道题的题干文本（仅截取围绕本题的内容，剔除答案标记）
  const questions: Question[] = blanks.map((cur, i) => {
    // 左边界：上一个答案标记结束处，最多回退 150 字符
    const prevAnsEnd = i > 0 ? rawText.indexOf("]", blanks[i - 1].index) : -1;
    const leftBoundary = prevAnsEnd > 0 ? Math.min(prevAnsEnd + 3, cur.index) : Math.max(0, cur.index - 150);

    // 右边界：下一个空白位置之前（不跨越）
    const rightBoundary = i + 1 < blanks.length ? blanks[i + 1].index : rawText.length;

    // 提取片段
    let seg = rawText.substring(leftBoundary, rightBoundary)
      .replace(/\r?\n/g, " ")
      .replace(/\s{2,}/g, " ")
      .trim();

    // 标准化空白占位符为 "N__________"
    seg = seg.replace(/(\d+)\s*_{5,}/g, "$1__________");

    // 剔除答案标记（格式C、H列答案、[答案：xxx] 等全部清除）
    // 支持中英文冒号、有无方括号、前后空格
    seg = seg.replace(/\s*\[?\s*(?:答(?:案)?|ANSWER)\s*[：:]+[^\]\.\n]*[\]]?/gi, "");
    seg = seg.replace(/\s*\[[^\]]*(?:答(?:案)?|ANSWER)[^\]]*\]/gi, "");
    seg = seg.replace(/\s{2,}/g, " ").trim();

    return {
      id: `q-${cur.num}`,
      number: cur.num,
      part: Math.ceil(cur.num / 10) || 1,
      type: "fill-blank" as const,
      text: seg,
      answer: answerMap[cur.num] || "",
    };
  });

  // 按 part 分组
  const sectionMap: Record<number, Question[]> = {};
  questions.forEach(q => { (sectionMap[q.part] ||= []).push(q); });
  const sections: ExamSection[] = Object.entries(sectionMap).map(([part, qs]) => ({
    part: parseInt(part),
    title: `Part ${parseInt(part)}`,
    questions: qs,
  }));

  return { title, sections };
}

// ============================================================
// 格式 C 答案映射构建
// ============================================================
function buildAnswerMapFormatC(rawText: string, blanks: { num: number; index: number }[]): Record<number, string> {
  const answerMap: Record<number, string> = {};

  for (let i = 0; i < blanks.length; i++) {
    const cur = blanks[i];
    const searchStart = cur.index;
    const searchEnd = i + 1 < blanks.length ? blanks[i + 1].index : rawText.length;
    const zone = rawText.substring(searchStart, searchEnd);

    // 匹配 [答案：xxx] 或 答案：xxx（支持有无方括号）
    const ansMatch = zone.match(/\[?\s*答\s*案\s*[：:]?\s*([^\]\n]+?)\s*\]?$/i);
    if (ansMatch) {
      const raw = ansMatch[1].trim();
      if (raw) answerMap[cur.num] = cleanAnswer(raw);
    }
  }

  // 兜底：如果格式C答案识别率低于50%，尝试末尾答案区
  if (Object.keys(answerMap).length < blanks.length * 0.5) {
    const answerIdx = rawText.lastIndexOf("答案");
    if (answerIdx > 0) {
      const tail = rawText.substring(answerIdx);
      const answerLines = tail.split(/[\n\r]+/)
        .map(l => l.replace(/^答案\s*[：:]?\s*/, "").trim())
        .filter(l => l.length > 0 && l.length < 100);
      const numLine = answerLines.find(l => /^\d+[\.:]/.test(l));
      if (numLine) {
        answerLines.forEach(line => {
          const nm = line.match(/^(\d+)[\.:]?\s*(.*)/);
          if (nm) answerMap[parseInt(nm[1])] = cleanAnswer(nm[2].trim());
        });
      } else {
        // 无编号行：按题目顺序对应
        const sorted = [...blanks].sort((a, b) => a.num - b.num);
        answerLines.forEach((ans, idx) => {
          if (idx < sorted.length) answerMap[sorted[idx].num] = cleanAnswer(ans);
        });
      }
    }
  }

  return answerMap;
}

// ============================================================
// 格式 A：题目混排 + 末尾「答案：」区
// ============================================================
function tryParseFormatFormatA(rawText: string): ParsedDoc {
  const title = extractTitle(rawText);

  const blankRe = /(\d{1,2})\s*_{5,}/g;
  const blanks: { num: number; index: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = blankRe.exec(rawText)) !== null) {
    blanks.push({ num: parseInt(m[1]), index: m.index });
  }
  if (blanks.length === 0) return { title, sections: [] };

  const questions: Question[] = blanks.map((cur, i) => {
    const prevAnsEnd = i > 0 ? rawText.indexOf("]", blanks[i - 1].index) : -1;
    const leftBoundary = prevAnsEnd > 0 ? Math.min(prevAnsEnd + 3, cur.index) : Math.max(0, cur.index - 150);
    const rightBoundary = i + 1 < blanks.length ? blanks[i + 1].index : rawText.length;

    let seg = rawText.substring(leftBoundary, rightBoundary)
      .replace(/\r?\n/g, " ")
      .replace(/\s{2,}/g, " ")
      .trim();
    seg = seg.replace(/(\d+)\s*_{5,}/g, "$1__________");
    // 剔除答案标记（同格式C）
    seg = seg.replace(/\s*\[?\s*(?:答(?:案)?|ANSWER)\s*[：:]+[^\]\.\n]*[\]]?/gi, "");
    seg = seg.replace(/\s*\[[^\]]*(?:答(?:案)?|ANSWER)[^\]]*\]/gi, "");
    seg = seg.replace(/\s{2,}/g, " ").trim();

    return {
      id: `q-${cur.num}`,
      number: cur.num,
      part: Math.ceil(cur.num / 10) || 1,
      type: "fill-blank" as const,
      text: seg,
      answer: "",
    };
  });

  // 从末尾答案区读取答案
  const answerMap: Record<number, string> = {};
  const answerIdx = rawText.lastIndexOf("答案");
  if (answerIdx > 0) {
    const tail = rawText.substring(answerIdx);
    const answerLines = tail.split(/[\n\r]+/)
      .map(l => l.replace(/^答案\s*[：:]?\s*/, "").trim())
      .filter(l => l.length > 0 && l.length < 100);
    const numLine = answerLines.find(l => /^\d+[\.:]/.test(l));
    if (numLine) {
      answerLines.forEach(line => {
        const nm = line.match(/^(\d+)[\.:]?\s*(.*)/);
        if (nm) answerMap[parseInt(nm[1])] = cleanAnswer(nm[2].trim());
      });
    } else {
      const sorted = [...blanks].sort((a, b) => a.num - b.num);
      answerLines.forEach((ans, i) => {
        if (i < sorted.length) answerMap[sorted[i].num] = cleanAnswer(ans);
      });
    }
  } else {
    const allLines = rawText.split(/[\n\r]+/).map(l => l.trim()).filter(Boolean);
    const tailLines = allLines.slice(-blanks.length);
    const sorted = [...blanks].sort((a, b) => a.num - b.num);
    tailLines.forEach((ans, i) => {
      if (i < sorted.length) answerMap[sorted[i].num] = cleanAnswer(ans);
    });
  }

  // 注入答案
  questions.forEach(q => { q.answer = answerMap[q.number] || ""; });

  const sectionMap: Record<number, Question[]> = {};
  questions.forEach(q => { (sectionMap[q.part] ||= []).push(q); });
  const sections: ExamSection[] = Object.entries(sectionMap).map(([part, qs]) => ({
    part: parseInt(part),
    title: `Part ${parseInt(part)}`,
    questions: qs,
  }));

  return { title, sections };
}

// ============================================================
// 格式 B：Q1. / Answer: 标准格式
// ============================================================
function tryParseFormatB(rawText: string): ParsedDoc {
  const lines = rawText.split(/[\n\r]+/).map(l => l.trim()).filter(Boolean);
  const title = extractTitle(rawText);
  let currentSection = { part: 1, title: "Part 1", questions: [] as Question[] };
  const sections = [currentSection];
  let pendingQ: Question | null = null;
  const partRe = /(?:SECTION|PART|Section|Part)\s+([IVX\d]+)/i;
  const qRe = /[Qq]\s*[:.]?\s*(\d+)[.:]?\s*(.*)/;
  const ansRe = /[Aa]nsw?er\s*[:：]?\s*(.*)/i;

  for (const line of lines) {
    const partMatch = line.match(partRe);
    if (partMatch) {
      if (pendingQ) { currentSection.questions.push(pendingQ); pendingQ = null; }
      if (currentSection.questions.length > 0) sections.push(currentSection);
      currentSection = {
        part: parseInt(partMatch[1]) || sections.length + 1,
        title: `Part ${parseInt(partMatch[1]) || sections.length + 1}`,
        questions: [],
      };
      continue;
    }
    const qMatch = line.match(qRe);
    if (qMatch) {
      if (pendingQ) currentSection.questions.push(pendingQ);
      pendingQ = {
        id: `q-${qMatch[1]}`,
        number: parseInt(qMatch[1]),
        part: currentSection.part,
        text: qMatch[2].trim(),
        type: "fill-blank",
        answer: "",
      };
      continue;
    }
    const ansMatch = line.match(ansRe);
    if (ansMatch && pendingQ) {
      pendingQ.answer = cleanAnswer(ansMatch[1].trim());
      continue;
    }
    if (pendingQ && line.length > 2 && !partRe.test(line)) {
      pendingQ.text += " " + line;
    }
  }
  if (pendingQ) currentSection.questions.push(pendingQ);
  return { title, sections };
}

// ============================================================
// 从 Excel .xlsx / .xls 解析
// 模板结构：题型(A) | 题干(B) | 选项1~5(C~G) | 答案(H)
// 每行为一道题，H列 = [答案：xxx]
// ============================================================
async function parseExcel(file: File, isXls: boolean): Promise<ParsedDoc> {
  const arrayBuffer = await file.arrayBuffer();
  const wb = XLSX.read(arrayBuffer, { type: "array", cellStyles: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows: Record<string, string>[] = XLSX.utils.sheet_to_json(sheet, { header: ["A", "B", "C", "D", "E", "F", "G", "H"], defval: "" });

  // 找到第一个非空数据行作为标题行
  let title = "IELTS Listening Test";
  const questions: Question[] = [];
  // 跳过标题行直到遇到题型列(A列非空)或有空白编号(B列含 __)
  let started = false;
  const blankRe = /(\d{1,2})\s*_{5,}/;

  for (const row of rows) {
    const typeA = (row.A || "").toString().trim();
    const textB = (row.B || "").toString().trim();
    const answerH = (row.H || "").toString().trim();

    // 跳过完全空行和表头行
    if (!typeA && !textB && !answerH) continue;
    if (/^(题型|题目|选项|答案)$/.test(typeA) && !started) continue;
    if (/^(选项|答案)$/.test(textB) && !started) continue;

    // 取第一个有效行作为标题
    if (!started && textB && textB.length > 5 && !blankRe.test(textB)) {
      started = true;
      if (!/填|选|选|Q|\d_/.test(textB) || textB.length < 30) {
        title = textB;
      }
      continue;
    }

    // 题干行 = 包含空白编号
    if (textB && blankRe.test(textB)) {
      started = true;
      const blankMatch = textB.match(blankRe);
      if (!blankMatch) continue;
      const qNum = parseInt(blankMatch[1]);

      // 标准化空白
      let cleanText = textB.replace(blankRe, "$1__________");
      // 提取答案（H列可能为 "[答案：corner]" 或 "corner"）
      let ans = answerH.replace(/^\[?\s*答\s*案\s*[：:]?\s*/, "").replace(/\]$/, "").trim();

      // 判断题型
      const qType = typeA.includes("选") ? "multiple-choice" as const : "fill-blank" as const;

      questions.push({
        id: `q-${qNum}`,
        number: qNum,
        part: Math.ceil(qNum / 10) || 1,
        type: qType,
        text: cleanText,
        answer: ans ? cleanAnswer(ans) : "",
      });
    }
  }

  // 按编号去重+排序
  const uniqueQs = Array.from(new Map(questions.map(q => [q.number, q])).values())
    .sort((a, b) => a.number - b.number);

  const sectionMap: Record<number, Question[]> = {};
  uniqueQs.forEach(q => { (sectionMap[q.part] ||= []).push(q); });
  const sections: ExamSection[] = Object.entries(sectionMap).map(([part, qs]) => ({
    part: parseInt(part),
    title: `Part ${parseInt(part)}`,
    questions: qs,
  }));

  return { title, sections };
}

// ============================================================
// 工具函数
// ============================================================
function cleanAnswer(raw: string): string {
  return raw
    .replace(/,\s*(either|either is right|any|any form|case insensitive).*$/i, "")
    .replace(/\s+OR\s+/gi, "/")
    .replace(/,\s*,/g, ",")
    .replace(/,\s*$/, "")
    .replace(/^[\s,]+|[\s,]+$/g, "")
    .replace(/\xa0/g, " ")
    .trim();
}

function extractTitle(rawText: string): string {
  const lines = rawText.split(/[\n\r]+/).map(l => l.trim()).filter(Boolean);
  let title = lines[0] || "IELTS Listening Test";
  if (title.length > 60) title = title.substring(0, 60);
  return title;
}

// ============================================================
// 评分逻辑
// ============================================================
export function checkAnswer(userAnswer: string, correctAnswer: string): boolean {
  if (!userAnswer.trim()) return false;
  const normalized = userAnswer.trim().toLowerCase();
  const answers = correctAnswer.split("/").map(a => a.trim().toLowerCase());
  return answers.some(a => a === normalized);
}

export function calcBandScore(correct: number, total: number): number {
  if (total === 0) return 0;
  const pct = (correct / total) * 100;
  const table: [number, number][] = [
    [98, 9], [94, 8.5], [89, 8], [84, 7.5], [76, 7], [70, 6.5],
    [62, 6], [55, 5.5], [46, 5], [38, 4.5], [30, 4], [23, 3.5],
    [16, 3], [10, 2.5], [5, 2], [2, 1.5], [0, 1],
  ];
  for (const [threshold, band] of table) {
    if (pct >= threshold) return band;
  }
  return 1;
}

export function getBandLabel(band: number): string {
  const labels: Record<number, string> = {
    9: "Expert User", 8.5: "Very Good User", 8: "Very Good User",
    7.5: "Good User", 7: "Good User", 6.5: "Competent User",
    6: "Competent User", 5.5: "Modest User", 5: "Modest User",
    4.5: "Limited User", 4: "Limited User", 3.5: "Extremely Limited",
    3: "Extremely Limited", 2.5: "Intermittent", 2: "Intermittent",
    1.5: "Non User", 1: "Non User",
  };
  return labels[band] || "Non User";
}
