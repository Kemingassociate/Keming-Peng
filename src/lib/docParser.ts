import JSZip from "jszip";
import type { ParsedDoc, Question } from "@/types";

/**
 * 解析 Word 文档（.docx）
 *
 * 支持格式 A（主流）：题目混排 + 末尾「答案：」区
 * 支持格式 B：Q1. / Answer: 标准格式
 */
export async function parseDocx(file: File): Promise<ParsedDoc> {
  const arrayBuffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(arrayBuffer);

  const docXml = await zip.file("word/document.xml")?.async("string");
  if (!docXml) throw new Error("无法读取 Word 文档内容，请确认是 .docx 格式");

  // 解析 XML，提取所有 <w:t> 文本
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(docXml, "application/xml");

  // 尝试获取 w:t 文本（带命名空间）
  let textNodes: HTMLCollectionOf<Element> = xmlDoc.getElementsByTagName("w:t");

  // 如果上面取不到，用不含命名空间的标签
  if (textNodes.length === 0) {
    textNodes = xmlDoc.getElementsByTagName("t");
  }

  const parts: string[] = [];
  for (let i = 0; i < textNodes.length; i++) {
    parts.push(textNodes[i].textContent ?? "");
  }
  const rawText = parts.join("");

  // 尝试格式 A（题目混排 + 末尾答案）
  const resultA = tryParseFormatA(rawText);
  if (resultA.sections.length > 0 && resultA.sections[0].questions.length > 0) {
    return resultA;
  }

  // 回退格式 B
  return tryParseFormatB(rawText);
}

// ============================================================
// 格式 A：题目混排 + 末尾「答案：」区
// 例：Cambridge / Gym membership 等主流文档
// ============================================================
function tryParseFormatA(rawText: string): ParsedDoc {
  const title = extractTitle(rawText);

  // Step 1：找到所有填空编号（11__________ / 12 __________）
  const blankRe = /(\d{1,2})\s*_{5,}/g;
  const blanks: { num: number; index: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = blankRe.exec(rawText)) !== null) {
    blanks.push({ num: parseInt(m[1]), index: m.index });
  }

  if (blanks.length === 0) return { title, sections: [] };

  // Step 2：提取每道题的题干
  const questions: { number: number; text: string }[] = [];
  for (let i = 0; i < blanks.length; i++) {
    const cur = blanks[i];
    const segStart = Math.max(0, cur.index - 200); // 往前最多取 200 字符
    const segEnd = i + 1 < blanks.length
      ? Math.min(blanks[i + 1].index, cur.index + 150)
      : Math.min(cur.index + 150, rawText.length);

    let segment = rawText.substring(segStart, segEnd)
      .replace(/\r?\n/g, " ")
      .replace(/\s{2,}/g, " ")
      .trim();

    // 把编号+下划线替换成占位符
    segment = segment.replace(/^\d+\s*_+\s*/, "__________ ");

    questions.push({ number: cur.num, text: segment });
  }

  // Step 3：提取答案（找「答案」标记，取其后的内容）
  const answerMap: Record<number, string> = {};
  const answerIdx = rawText.lastIndexOf("答案");

  if (answerIdx > 0) {
    const tail = rawText.substring(answerIdx);
    const answerLines = tail
      .split(/[\n\r]+/)
      .map(l => l.replace(/^答案\s*[:：]?\s*/, "").trim())
      .filter(l => l.length > 0 && l.length < 100);

    // 按编号解析 or 按顺序分配
    const numLine = answerLines.find(l => /^\d+[\.:]/.test(l));
    if (numLine) {
      answerLines.forEach(line => {
        const nm = line.match(/^(\d+)[\.:]?\s*(.*)/);
        if (nm) answerMap[parseInt(nm[1])] = nm[2].trim();
      });
    } else {
      const sorted = [...questions].sort((a, b) => a.number - b.number);
      answerLines.forEach((ans, i) => {
        if (i < sorted.length) answerMap[sorted[i].number] = ans;
      });
    }
  } else {
    // 无"答案"标记，取最后 N 行
    const allLines = rawText.split(/[\n\r]+/).map(l => l.trim()).filter(Boolean);
    const tailLines = allLines.slice(-blanks.length);
    const sorted = [...questions].sort((a, b) => a.number - b.number);
    tailLines.forEach((ans, i) => {
      if (i < sorted.length) answerMap[sorted[i].number] = ans;
    });
  }

  // Step 4：组装最终题目
  const uniqueQs = Array.from(
    new Map(questions.map(q => [q.number, q])).values()
  ).sort((a, b) => a.number - b.number);

  const finalQs: Question[] = uniqueQs.map(q => ({
    id: `q-${q.number}`,
    number: q.number,
    part: Math.ceil(q.number / 10) || 1,
    text: q.text,
    type: "fill-blank",
    answer: answerMap[q.number] || "",
  }));

  // 按 Part 分组
  const sectionMap: Record<number, Question[]> = {};
  finalQs.forEach(q => {
    (sectionMap[q.part] ||= []).push(q);
  });

  const sections = Object.entries(sectionMap).map(([part, qs]) => ({
    part: parseInt(part),
    title: `Part ${part}`,
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
      pendingQ.answer = ansMatch[1].trim();
      continue;
    }

    if (pendingQ && line.length > 2 && !partRe.test(line)) {
      pendingQ.text += " " + line;
    }
  }

  if (pendingQ) currentSection.questions.push(pendingQ);

  return { title, sections };
}

function extractTitle(rawText: string): string {
  const lines = rawText.split(/[\n\r]+/).map(l => l.trim()).filter(Boolean);
  let title = lines[0] || "IELTS Listening Test";
  if (title.length > 60) title = title.substring(0, 60);
  return title;
}

// ============================================================
//  评分逻辑
// ============================================================

/**
 * 判断用户答案是否正确
 * 支持：精确匹配 + 忽略大小写 + / 分隔的多个答案
 */
export function checkAnswer(userAnswer: string, correctAnswer: string): boolean {
  if (!userAnswer.trim()) return false;
  const normalized = userAnswer.trim().toLowerCase();
  const answers = correctAnswer.split("/").map(a => a.trim().toLowerCase());
  return answers.some(a => a === normalized);
}

/**
 * 雅思听力 Band Score（40题版，官方标准）
 */
export function calcBandScore(correct: number, total: number): number {
  if (total === 0) return 0;
  const pct = (correct / total) * 100;
  const table: [number, number][] = [
    [98, 9], [94, 8.5], [89, 8], [84, 7.5],
    [76, 7], [70, 6.5], [62, 6], [55, 5.5],
    [46, 5], [38, 4.5], [30, 4], [23, 3.5],
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
