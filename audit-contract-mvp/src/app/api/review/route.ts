import { isMockCoze } from "@/lib/config";
import { CozeClientError, runWorkflowWithHetong } from "@/lib/coze";
import { errorResponse, sleep } from "@/lib/http";
import { buildMockReview } from "@/lib/mock-result";
import { normalizeCozeOutput } from "@/lib/normalize";
import type { SimulateMode } from "@/lib/types";
import {
  trimWorkflowStrings,
  validateWorkflowStrings,
} from "@/lib/workflow-params";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: Request) {
  let json: {
    fileId?: string;
    fileName?: string;
    simulate?: SimulateMode;
    gongsiming?: string;
    shenchamoshi?: string;
  };
  try {
    json = await request.json();
  } catch {
    return errorResponse(400, "MISSING_FILE_ID", "请求体无效。", "请重新上传后再开始审查。");
  }

  const fileId = json.fileId?.trim();
  const fileName = json.fileName?.trim() || "未命名合同";
  const simulate = json.simulate || "none";
  const params = trimWorkflowStrings({
    gongsiming: json.gongsiming,
    shenchamoshi: json.shenchamoshi,
  });
  const paramError = validateWorkflowStrings(params);

  if (!fileId) {
    return errorResponse(400, "MISSING_FILE_ID", "缺少 file_id。", "请先完成文件上传。");
  }
  if (paramError) {
    return errorResponse(400, paramError.code, paramError.message, paramError.hint);
  }

  if (isMockCoze()) {
    if (simulate === "timeout") {
      await sleep(900);
      return errorResponse(
        504,
        "TIMEOUT",
        "模拟超时：工作流未在限定时间内返回。",
        "真实接入时可到 Coze 控制台查看运行记录。"
      );
    }
    if (simulate === "unauthorized") {
      return errorResponse(401, "AUTH", "模拟鉴权失败。", "请在 .env.local 配置国内版 PAT 后重启。");
    }
    if (simulate === "invalid") {
      await sleep(500);
      const result = normalizeCozeOutput(
        "工作流返回了一段无法拆分的纯文本：合同整体尚可，但本条没有标题结构。",
        fileName,
        "mock"
      );
      result.partial = true;
      result.summary = `${result.summary}（示例入参：公司名「${params.gongsiming}」，审查模式「${params.shenchamoshi}」。）`;
      return Response.json(result);
    }
    await sleep(1100);
    return Response.json(buildMockReview(fileName, params));
  }

  try {
    const payload = await runWorkflowWithHetong({
      fileId,
      gongsiming: params.gongsiming,
      shenchamoshi: params.shenchamoshi,
    });
    const result = normalizeCozeOutput(payload, fileName, "coze");
    if (!result.summary && !result.rawText) {
      return errorResponse(
        502,
        "UNPARSEABLE",
        "工作流没有返回可读内容。",
        "请把打码后的原始响应发给开发对照，不要把 PAT 发到聊天里。"
      );
    }
    return Response.json(result);
  } catch (err) {
    if (err instanceof CozeClientError) {
      const status =
        err.code === "AUTH"
          ? 401
          : err.code === "TIMEOUT"
            ? 504
            : err.code === "RATE_LIMIT"
              ? 429
              : err.code === "UNPARSEABLE"
                ? 502
                : 502;
      return errorResponse(status, err.code, err.message, err.hint);
    }
    return errorResponse(500, "INTERNAL", "运行审查工作流时发生内部错误。", "请重试。");
  }
}
