import type {
  ReviewClause,
  ReviewResult,
  ReviewRisk,
  ReviewSuggestion,
  RiskLevel,
} from "@/lib/types";

function tryParseJson(text: string): unknown | undefined {
  const trimmed = text.trim();
  if (!trimmed) return undefined;
  const start = trimmed[0];
  if (start !== "{" && start !== "[") return undefined;
  try {
    return JSON.parse(trimmed);
  } catch {
    return undefined;
  }
}

function unwrap(value: unknown, depth = 0): unknown {
  if (depth > 8) return value;
  if (typeof value === "string") {
    const parsed = tryParseJson(value);
    if (parsed !== undefined) return unwrap(parsed, depth + 1);
    return value;
  }
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>;
    if (typeof obj.data === "string" || (obj.data && typeof obj.data === "object")) {
      const inner = unwrap(obj.data, depth + 1);
      if (inner !== obj.data) {
        if (typeof inner === "object" && inner) return inner;
      }
    }
    if (typeof obj.output === "string" || (obj.output && typeof obj.output === "object")) {
      const inner = unwrap(obj.output, depth + 1);
      if (typeof inner === "object" && inner) {
        return { ...obj, ...(inner as object), output: inner };
      }
    }
  }
  return value;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function pickString(obj: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const v = obj[key];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number") return String(v);
  }
  return undefined;
}

function pickArray(obj: Record<string, unknown>, keys: string[]): unknown[] | undefined {
  for (const key of keys) {
    const v = obj[key];
    if (Array.isArray(v)) return v;
  }
  return undefined;
}

function toLevel(raw: string | undefined): RiskLevel {
  if (!raw) return "medium";
  const t = raw.toLowerCase();
  if (
    t.includes("high") ||
    t.includes("严重") ||
    t.includes("高") ||
    t === "h" ||
    t.includes("critical")
  ) {
    return "high";
  }
  if (t.includes("low") || t.includes("低") || t === "l" || t.includes("轻微")) {
    return "low";
  }
  return "medium";
}

function stringifyRaw(value: unknown): string {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function mapRisk(item: unknown, index: number): ReviewRisk | null {
  if (typeof item === "string") {
    return {
      id: `risk-${index + 1}`,
      level: "medium",
      title: item.slice(0, 80),
      detail: item,
    };
  }
  const rec = asRecord(item);
  if (!rec) return null;
  const title =
    pickString(rec, ["title", "name", "风险", "标题", "risk", "issue"]) ||
    `风险 ${index + 1}`;
  const detail =
    pickString(rec, [
      "detail",
      "description",
      "desc",
      "说明",
      "内容",
      "reason",
      "analysis",
    ]) || title;
  const levelRaw = pickString(rec, ["level", "severity", "级别", "等级", "risk_level"]);
  const clauseRef = pickString(rec, [
    "clauseRef",
    "clause",
    "location",
    "条款",
    "条款位置",
    "article",
  ]);
  return {
    id: pickString(rec, ["id"]) || `risk-${index + 1}`,
    level: toLevel(levelRaw),
    title,
    detail,
    clauseRef,
  };
}

function mapClause(item: unknown, index: number): ReviewClause | null {
  if (typeof item === "string") {
    return { id: `clause-${index + 1}`, title: item.slice(0, 40), excerpt: item };
  }
  const rec = asRecord(item);
  if (!rec) return null;
  const title =
    pickString(rec, ["title", "name", "条款", "标题", "type"]) || `条款 ${index + 1}`;
  const excerpt =
    pickString(rec, ["excerpt", "content", "text", "摘要", "内容", "summary"]) ||
    title;
  const comment = pickString(rec, ["comment", "note", "说明", "点评"]);
  return {
    id: pickString(rec, ["id"]) || `clause-${index + 1}`,
    title,
    excerpt,
    comment,
  };
}

function mapSuggestion(item: unknown, index: number): ReviewSuggestion | null {
  if (typeof item === "string") {
    return { id: `sug-${index + 1}`, action: item };
  }
  const rec = asRecord(item);
  if (!rec) return null;
  const action =
    pickString(rec, ["action", "suggestion", "text", "建议", "内容", "content"]) ||
    "";
  if (!action) return null;
  return {
    id: pickString(rec, ["id"]) || `sug-${index + 1}`,
    relatedRiskId: pickString(rec, ["relatedRiskId", "riskId", "关联风险"]),
    action,
  };
}

function splitMarkdown(text: string): {
  summary: string;
  risks: ReviewRisk[];
  clauses: ReviewClause[];
  suggestions: ReviewSuggestion[];
} {
  const sections: { heading: string; body: string }[] = [];
  const lines = text.split(/\r?\n/);
  let current = { heading: "前言", body: "" };
  for (const line of lines) {
    const m = line.match(/^#{1,3}\s+(.+)/) || line.match(/^【(.+)】/);
    if (m) {
      sections.push(current);
      current = { heading: m[1].trim(), body: "" };
    } else {
      current.body += line + "\n";
    }
  }
  sections.push(current);

  const find = (pred: (h: string) => boolean) =>
    sections.filter((s) => pred(s.heading));

  const riskSecs = find((h) => /风险/.test(h) && !/建议/.test(h));
  const clauseSecs = find((h) => /条款|要点|摘要/.test(h));
  const sugSecs = find((h) => /建议|修改|谈判/.test(h));
  const summarySecs = find((h) => /总结|综述|概要|前言/.test(h));

  const bullets = (body: string) =>
    body
      .split(/\n/)
      .map((l) => l.replace(/^\s*[-*•\d.、]+\s*/, "").trim())
      .filter((l) => l.length > 1);

  const risks: ReviewRisk[] = [];
  for (const sec of riskSecs) {
    const items = bullets(sec.body);
    items.forEach((item, i) => {
      const levelMatch = item.match(/^(高|中|低|严重|一般)[：:.\s]/);
      const level = toLevel(levelMatch?.[1]);
      const rest = levelMatch ? item.slice(levelMatch[0].length) : item;
      risks.push({
        id: `risk-${risks.length + 1}`,
        level,
        title: rest.slice(0, 80),
        detail: rest,
      });
      void i;
    });
  }

  const clauses: ReviewClause[] = [];
  for (const sec of clauseSecs) {
    bullets(sec.body).forEach((item) => {
      clauses.push({
        id: `clause-${clauses.length + 1}`,
        title: item.slice(0, 40),
        excerpt: item,
      });
    });
  }

  const suggestions: ReviewSuggestion[] = [];
  for (const sec of sugSecs) {
    bullets(sec.body).forEach((item) => {
      suggestions.push({
        id: `sug-${suggestions.length + 1}`,
        action: item,
      });
    });
  }

  const summary =
    summarySecs.map((s) => s.body.trim()).join("\n").trim() ||
    text.slice(0, 280).trim();

  return { summary, risks, clauses, suggestions };
}

export function normalizeCozeOutput(
  payload: unknown,
  contractName: string,
  source: "coze" | "mock"
): ReviewResult {
  const rawText = stringifyRaw(payload);
  const unwrapped = unwrap(payload);
  const rec = asRecord(unwrapped);

  let summary = "";
  let risks: ReviewRisk[] = [];
  let clauses: ReviewClause[] = [];
  let suggestions: ReviewSuggestion[] = [];

  if (rec) {
    summary =
      pickString(rec, ["summary", "综述", "概要", "摘要", "结论"]) || "";

    const riskArr = pickArray(rec, ["risks", "风险", "risk_list", "issues"]);
    const clauseArr = pickArray(rec, [
      "clauses",
      "条款",
      "要点",
      "key_clauses",
      "points",
    ]);
    const sugArr = pickArray(rec, ["suggestions", "建议", "actions", "recommendations"]);

    if (riskArr) {
      risks = riskArr.map(mapRisk).filter((x): x is ReviewRisk => Boolean(x));
    }
    if (clauseArr) {
      clauses = clauseArr
        .map(mapClause)
        .filter((x): x is ReviewClause => Boolean(x));
    }
    if (sugArr) {
      suggestions = sugArr
        .map(mapSuggestion)
        .filter((x): x is ReviewSuggestion => Boolean(x));
    }

    const nestedOutput = rec.output;
    if (
      risks.length === 0 &&
      clauses.length === 0 &&
      suggestions.length === 0 &&
      typeof nestedOutput === "string"
    ) {
      const fromMd = splitMarkdown(nestedOutput);
      summary = summary || fromMd.summary;
      risks = fromMd.risks;
      clauses = fromMd.clauses;
      suggestions = fromMd.suggestions;
    }
  } else if (typeof unwrapped === "string") {
    const fromMd = splitMarkdown(unwrapped);
    summary = fromMd.summary;
    risks = fromMd.risks;
    clauses = fromMd.clauses;
    suggestions = fromMd.suggestions;
  }

  const hasStructure =
    risks.length > 0 || clauses.length > 0 || suggestions.length > 0;
  if (!summary) {
    summary = hasStructure
      ? "已从工作流输出中整理出下列条目。工作流出参 schema 未公开，请对照原始返回核对。"
      : "工作流已返回内容，但未能拆成风险 / 条款 / 建议。请展开原始输出查看。";
  }

  return {
    contractName,
    source,
    summary,
    risks,
    clauses,
    suggestions,
    rawText,
    partial: !hasStructure,
  };
}
