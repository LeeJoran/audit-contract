export const MAX_FILE_BYTES = 20 * 1024 * 1024;

export const ALLOWED_EXTENSIONS = [".pdf", ".docx"] as const;

export const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
] as const;

export const DEFAULT_COZE_API_BASE = "https://api.coze.cn";
export const DEFAULT_WORKFLOW_ID = "7667956412068855851";
export const DEFAULT_SPACE_ID = "7570680287668158515";

export const COZE_UPLOAD_TIMEOUT_MS = 60_000;
export const COZE_RUN_TIMEOUT_MS = 120_000;
export const COZE_POLL_INTERVAL_MS = 2_000;
export const COZE_POLL_MAX_MS = 90_000;
