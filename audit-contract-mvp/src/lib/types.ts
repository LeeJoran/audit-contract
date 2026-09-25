export type RiskLevel = "high" | "medium" | "low";

export type ReviewRisk = {
  id: string;
  level: RiskLevel;
  title: string;
  detail: string;
  clauseRef?: string;
};

export type ReviewClause = {
  id: string;
  title: string;
  excerpt: string;
  comment?: string;
};

export type ReviewSuggestion = {
  id: string;
  relatedRiskId?: string;
  action: string;
};

export type ReviewResult = {
  contractName: string;
  source: "coze" | "mock";
  summary: string;
  risks: ReviewRisk[];
  clauses: ReviewClause[];
  suggestions: ReviewSuggestion[];
  rawText?: string;
  partial?: boolean;
};

export type AppErrorCode =
  | "UNSUPPORTED_TYPE"
  | "EMPTY_FILE"
  | "FILE_TOO_LARGE"
  | "AUTH"
  | "RATE_LIMIT"
  | "TIMEOUT"
  | "COZE_ERROR"
  | "UNPARSEABLE"
  | "MISSING_FILE"
  | "MISSING_FILE_ID"
  | "MISSING_COMPANY"
  | "MISSING_MODE"
  | "INTERNAL";

export type ApiErrorBody = {
  error: {
    code: AppErrorCode;
    message: string;
    hint?: string;
  };
};

export type UploadSuccess = {
  fileId: string;
  fileName: string;
  source: "coze" | "mock";
};

export type AppConfig = {
  mock: boolean;
  maxFileBytes: number;
  allowedExtensions: string[];
  workflowId: string;
  apiBase: string;
};

export type SimulateMode = "none" | "timeout" | "unauthorized" | "invalid";
