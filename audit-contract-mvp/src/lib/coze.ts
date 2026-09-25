import {
  COZE_POLL_INTERVAL_MS,
  COZE_POLL_MAX_MS,
  COZE_RUN_TIMEOUT_MS,
  COZE_UPLOAD_TIMEOUT_MS,
} from "@/lib/constants";
import { getCozeConfig } from "@/lib/config";
import type { AppErrorCode } from "@/lib/types";

export class CozeClientError extends Error {
  code: AppErrorCode;
  hint?: string;
  status?: number;

  constructor(code: AppErrorCode, message: string, hint?: string, status?: number) {
    super(message);
    this.name = "CozeClientError";
    this.code = code;
    this.hint = hint;
    this.status = status;
  }
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new CozeClientError(
        "TIMEOUT",
        "调用 Coze 超时。",
        "工作流可能仍在平台侧运行。可稍后重试，或到 Coze 控制台查看该次执行。"
      );
    }
    throw new CozeClientError(
      "COZE_ERROR",
      "无法连接到 Coze 国内版 API。",
      "请确认本机可访问 https://api.coze.cn，且 COZE_API_BASE 未误写成 api.coze.com。"
    );
  } finally {
    clearTimeout(timer);
  }
}

function mapHttpError(status: number, bodyText: string): CozeClientError {
  if (status === 401 || status === 403) {
    return new CozeClientError(
      "AUTH",
      "Coze 鉴权失败。",
      "请在本机 .env.local 放入国内版开放平台 PAT（coze.cn，不是 coze.com），然后重启开发服务。",
      status
    );
  }
  if (status === 429) {
    return new CozeClientError(
      "RATE_LIMIT",
      "Coze 请求过于频繁或额度不足。",
      "请稍后再试，或在开放平台检查配额。",
      status
    );
  }
  return new CozeClientError(
    "COZE_ERROR",
    `Coze 接口返回 HTTP ${status}。`,
    bodyText.slice(0, 280) || "请查看服务端日志（不含合同正文）。",
    status
  );
}

type CozeEnvelope = {
  code?: number;
  msg?: string;
  message?: string;
  data?: unknown;
  execute_id?: string;
  debug_url?: string;
};

function parseEnvelope(json: unknown): CozeEnvelope {
  if (json && typeof json === "object") return json as CozeEnvelope;
  return {};
}

export async function uploadFileToCoze(file: File): Promise<string> {
  const { apiBase, token } = getCozeConfig();
  const form = new FormData();
  form.append("file", file, file.name);

  const res = await fetchWithTimeout(
    `${apiBase}/v1/files/upload`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    },
    COZE_UPLOAD_TIMEOUT_MS
  );

  const text = await res.text();
  if (!res.ok) throw mapHttpError(res.status, text);

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new CozeClientError("COZE_ERROR", "文件上传响应不是 JSON。", text.slice(0, 200));
  }

  const env = parseEnvelope(json);
  if (typeof env.code === "number" && env.code !== 0) {
    if (env.code === 4101 || env.code === 401 || env.code === 700012006) {
      throw new CozeClientError(
        "AUTH",
        env.msg || env.message || "Coze 鉴权失败。",
        "请确认 PAT 来自 coze.cn 开放平台，且未过期。"
      );
    }
    throw new CozeClientError(
      "COZE_ERROR",
      env.msg || env.message || `文件上传失败（code ${env.code}）。`
    );
  }

  const data = env.data as { id?: string; file_id?: string } | undefined;
  const fileId = data?.id || data?.file_id;
  if (!fileId) {
    throw new CozeClientError(
      "COZE_ERROR",
      "文件已上传，但响应里没有 file_id。",
      text.slice(0, 280)
    );
  }
  return fileId;
}

async function pollRunHistory(
  workflowId: string,
  executeId: string
): Promise<unknown> {
  const { apiBase, token } = getCozeConfig();
  const started = Date.now();
  while (Date.now() - started < COZE_POLL_MAX_MS) {
    await new Promise((r) => setTimeout(r, COZE_POLL_INTERVAL_MS));
    const res = await fetchWithTimeout(
      `${apiBase}/v1/workflows/${encodeURIComponent(workflowId)}/run_histories/${encodeURIComponent(executeId)}`,
      { headers: { Authorization: `Bearer ${token}` } },
      30_000
    );
    const text = await res.text();
    if (!res.ok) throw mapHttpError(res.status, text);
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      continue;
    }
    const env = parseEnvelope(json);
    const data = env.data as
      | { execute_status?: string; output?: unknown; error_message?: string }
      | Array<{ execute_status?: string; output?: unknown; error_message?: string }>
      | undefined;
    const row = Array.isArray(data) ? data[0] : data;
    const status = row?.execute_status;
    if (status === "Success" || status === "success") {
      return row?.output ?? env.data;
    }
    if (status === "Fail" || status === "fail" || status === "Failed") {
      throw new CozeClientError(
        "COZE_ERROR",
        row?.error_message || "工作流执行失败。",
        "可到 Coze 控制台打开该工作流的运行记录。"
      );
    }
  }
  throw new CozeClientError(
    "TIMEOUT",
    "等待工作流完成超时。",
    "可到 Coze 控制台查看是否仍在运行。"
  );
}

export async function runWorkflowWithHetong(args: {
  fileId: string;
  gongsiming: string;
  shenchamoshi: string;
}): Promise<unknown> {
  const { apiBase, token, workflowId } = getCozeConfig();
  const hetong = JSON.stringify({ file_id: args.fileId });
  const body = {
    workflow_id: workflowId,
    parameters: {
      hetong,
      gongsiming: args.gongsiming,
      shenchamoshi: args.shenchamoshi,
    },
  };

  const res = await fetchWithTimeout(
    `${apiBase}/v1/workflow/run`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
    COZE_RUN_TIMEOUT_MS
  );

  const text = await res.text();
  if (!res.ok) throw mapHttpError(res.status, text);

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new CozeClientError("UNPARSEABLE", "工作流响应不是 JSON。", text.slice(0, 280));
  }

  const env = parseEnvelope(json);
  if (typeof env.code === "number" && env.code !== 0) {
    if (env.code === 4101 || env.code === 401 || env.code === 700012006) {
      throw new CozeClientError(
        "AUTH",
        env.msg || "Coze 鉴权失败。",
        "请更换国内版 PAT 后重启服务。"
      );
    }
    throw new CozeClientError(
      "COZE_ERROR",
      env.msg || env.message || `工作流失败（code ${env.code}）。`
    );
  }

  if (env.data === undefined || env.data === null || env.data === "") {
    const executeId = env.execute_id;
    if (executeId) {
      return pollRunHistory(workflowId, executeId);
    }
  }

  return json;
}
