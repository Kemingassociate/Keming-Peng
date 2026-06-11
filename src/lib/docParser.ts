import JSZip from "jszip";
import type { ParsedDoc, Question } from "@/types";

export async function parseDocx(file: File): Promise<ParsedDoc> {
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
  const resultA = tryParseFormatA(rawText);
  if (resultA.sections.length > 0 && resultA.sections[0].questions.length > 0) return resultA;

  // 回退格式 B
  return tryParseFormatB(rawText);
}

// ============================================================
// 格式 C：内嵌答案（[答案：xxx] 或 答案：xxx）
// ============================================================
function tryParseFormatC(rawText: string): ParsedDoc {
  const title = extractTitle(rawText);
  const blankRe = /(\d{1,2})\s*_{5,}/g;
  const blanks: { num: number; index: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = blankRe.exec(rawText)) !== null) blanks.push({ num: parseInt(m[1]), index: m.index });
  if (blanks.length === 0) return { title, sections: [] };

  const questions: { number: number; text: string }[] = [];
  for (let i = 0; i < blanks.length; i++) {
    const cur = blanks[i];
    const segStart = Math.max(0, cur.index - 280);
    const segEnd = i + 1 < blanks.length ? Math.min(blanks[i + 1].index, cur.index + 220) : rawText.length;
    let segment = rawText.substring(segStart, segEnd).replace(/\r?\n/g, " ").replace(/\s{2,}/g, " ").trim();
    segment = segment.replace(/^\d+\s*_+\s*/, "__________ ");
    questions.push({ number: cur.num, text: segment });
  }

  const answerMap: Record<number, string> = {};
  for (let i = 0; i < blanks.length; i++) {
    const cur = blanks[i];
    const answerStart = rawText.indexOf(cur.num + "__________", cur.index) + (cur.num + "__________").length;
    const answerEnd = i + 1 < blanks.length ? blanks[i + 1].index : rawText.length;
    const answerZone = rawText.substring(answerStart, answerEnd);
    const ansMatch = answerZone.match(/\[?\s*答\s*案\s*[：:]?\s*([^\]\n]+)/);
    if (ansMatch) {
      const raw = ansMatch[1].replace(/^\s*[：:]\s*/, "").replace(/\s+$/, "").trim();
      if (raw) answerMap[cur.num] = cleanAnswer(raw);
    }
  }

  // 兜底：末尾答案区
  if (Object.keys(answerMap).length < blanks.length * 0.5) {
    const answerIdx = rawText.lastIndexOf("答案");
    if (answerIdx > 0) {
      const tail = rawText.substring(answerIdx);
      const answerLines = tail.split(/[\n\r]+/).map(l => l.replace(/^答案\s*[：:]?\s*/, "").trim()).filter(l => l.length > 0 && l.length < 100);
      const numLine = answerLines.find(l => /^\d+[\.:]/.test(l));
      if (numLine) {
        answerLines.forEach(line => {
          const nm = line.match(/^(\d+)[\.:]?\s*(.*)/);
          if (nm) answerMap[parseInt(nm[1])] = cleanAnswer(nm[2].trim());
        });
      } else {
        const sorted = [...questions].sort((a, b) => a.number - b.number);
        answerLines.forEach((ans, idx) => { if (idx < sorted.length) answerMap[sorted[idx].number] = cleanAnswer(ans); });
      }
    }
  }

  return buildResult(title, questions, answerMap);
}

// ============================================================
// 格式 A：题目混排 + 末尾「答案：」区
// ============================================================
function tryParseFormatA(rawText: string): ParsedDoc {
  const title = extractTitle(rawText);
  const blankRe = /(\d{1,2})\s*_{5,}/g;
  const blanks: { num: number; index: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = blankRe.exec(rawText)) !== null) blanks.push({ num: parseInt(m[1]), index: m.index });
  if (blanks.length === 0) return { title, sections: [] };

  const questions: { number: number; text: string }[] = [];
  for (let i = 0; i < blanks.length; i++) {
    const cur = blanks[i];
    const segStart = Math.max(0, cur.index - 200);
    const segEnd = i + 1 < blanks.length ? Math.min(blanks[i + 1].index, cur.index + 150) : Math.min(cur.index + 150, rawText.length);
    let segment = rawText.substring(segStart, segEnd).replace(/\r?\n/g, " ").replace(/\s{2,}/g, " ").trim();
    segment = segment.replace(/^\d+\s*_+\s*/, "__________ ");
    questions.push({ number: cur.num, text: segment });
  }

  const answerMap: Record<number, string> = {};
  const answerIdx = rawText.lastIndexOf("答案");
  if (answerIdx > 0) {
    const tail = rawText.substring(answerIdx);
    const answerLines = tail.split(/[\n\r]+/).map(l => l.replace(/^答案\s*[：:]?\s*/, "").trim()).filter(l => l.length > 0 && l.length < 100);
    const numLine = answerLines.find(l => /^\d+[\.:]/.test(l));
    if (numLine) {
      answerLines.forEach(line => {
        const nm = line.match(/^(\d+)[\.:]?\s*(.*)/);
        if (nm) answerMap[parseInt(nm[1])] = cleanAnswer(nm[2].trim());
      });
    } else {
      const sorted = [...questions].sort((a, b) => a.number - b.number);
      answerLines.forEach((ans, i) => { if (i < sorted.length) answerMap[sorted[i].number] = cleanAnswer(ans); });
    }
  } else {
    const allLines = rawText.split(/[\n\r]+/).map(l => l.trim()).filter(Boolean);
    const tailLines = allLines.slice(-blanks.length);
    const sorted = [...questions].sort((a, b) => a.number - b.number);
    tailLines.forEach((ans, i) => { if (i < sorted.length) answerMap[sorted[i].number] = cleanAnswer(ans); });
  }

  return buildResult(title, questions, answerMap);
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
      currentSection = { part: parseInt(partMatch[1]) || sections.length + 1, title: `Part ${parseInt(partMatch[1]) || sections.length + 1}`, questions: [] };
      continue;
    }
    const qMatch = line.match(qRe);
    if (qMatch) {
      if (pendingQ) currentSection.questions.push(pendingQ);
      pendingQ = { id: `q-${qMatch[1]}`, number: parseInt(qMatch[1]), part: currentSection.part, text: qMatch[2].trim(), type: "fill-blank", answer: "" };
      continue;
    }
    const ansMatch = line.match(ansRe);
    if (ansMatch && pendingQ) { pendingQ.answer = cleanAnswer(ansMatch[1].trim()); continue; }
    if (pendingQ && line.length > 2 && !partRe.test(line)) pendingQ.text += " " + line;
  }
  if (pendingQ) currentSection.questions.push(pendingQ);
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
    .trim();
}

function buildResult(title: string, questions: { number: number; text: string }[], answerMap: Record<number, string>): ParsedDoc {
  const uniqueQs = Array.from(new Map(questions.map(q => [q.number, q])).values()).sort((a, b) => a.number - b.number);
  const finalQs: Question[] = uniqueQs.map(q => ({ id: `q-${q.number}`, number: q.number, part: Math.ceil(q.number / 10) || 1, text: q.text, type: "fill-blank", answer: answerMap[q.number] || "" }));
  const sectionMap: Record<number, Question[]> = {};
  finalQs.forEach(q => { (sectionMap[q.part] ||= []).push(q); });
  const sections = Object.entries(sectionMap).map(([part, qs]) => ({ part: parseInt(part), title: `Part ${part}`, questions: qs }));
  return { title, sections };
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
  const table: [number, number][] = [[98, 9], [94, 8.5], [89, 8], [84, 7.5], [76, 7], [70, 6.5], [62, 6], [55, 5.5], [46, 5], [38, 4.5], [30, 4], [23, 3.5], [16, 3], [10, 2.5], [5, 2], [2, 1.5], [0, 1]];
  for (const [threshold, band] of table) { if (pct >= threshold) return band; }
  return 1;
}

export function getBandLabel(band: number): string {
  const labels: Record<number, string> = { 9: "Expert User", 8.5: "Very Good User", 8: "Very Good User", 7.5: "Good User", 7: "Good User", 6.5: "Competent User", 6: "Competent User", 5.5: "Modest User", 5: "Modest User", 4.5: "Limited User", 4: "Limited User", 3.5: "Extremely Limited", 3: "Extremely Limited", 2.5: "Intermittent", 2: "Intermittent", 1.5: "Non User", 1: "Non User" };
  return labels[band] || "Non User";
}
