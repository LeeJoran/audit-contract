import { isMockCoze } from "@/lib/config";
import { CozeClientError, uploadFileToCoze } from "@/lib/coze";
import { validateContractFile } from "@/lib/file-validation";
import { errorResponse, sleep } from "@/lib/http";
import type { SimulateMode, UploadSuccess } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return errorResponse(400, "MISSING_FILE", "无法读取上传内容。", "请重新选择文件后再试。");
  }

  const file = form.get("file");
  const simulate = (String(form.get("simulate") || "none") as SimulateMode) || "none";

  if (!(file instanceof File)) {
    return errorResponse(400, "MISSING_FILE", "请先选择合同文件。", "支持一份 PDF 或 .docx。");
  }

  const invalid = validateContractFile(file);
  if (invalid) {
    const status = invalid.code === "FILE_TOO_LARGE" ? 413 : 400;
    return errorResponse(status, invalid.code, invalid.message, invalid.hint);
  }

  if (isMockCoze()) {
    if (simulate === "timeout") {
      await sleep(800);
      return errorResponse(504, "TIMEOUT", "模拟超时：文件上传未完成。", "这是开发开关，真实环境不会出现此条。");
    }
    if (simulate === "unauthorized") {
      return errorResponse(
        401,
        "AUTH",
        "模拟鉴权失败。",
        "真实接入时请检查 .env.local 中的国内版 PAT。"
      );
    }
    await sleep(700);
    const body: UploadSuccess = {
      fileId: `mock-file-${Date.now()}`,
      fileName: file.name,
      source: "mock",
    };
    return Response.json(body);
  }

  try {
    const fileId = await uploadFileToCoze(file);
    const body: UploadSuccess = {
      fileId,
      fileName: file.name,
      source: "coze",
    };
    return Response.json(body);
  } catch (err) {
    if (err instanceof CozeClientError) {
      const status =
        err.code === "AUTH" ? 401 : err.code === "TIMEOUT" ? 504 : err.code === "RATE_LIMIT" ? 429 : 502;
      return errorResponse(status, err.code, err.message, err.hint);
    }
    return errorResponse(500, "INTERNAL", "上传文件时发生内部错误。", "请重试；不要把合同正文贴到公开聊天。");
  }
}
