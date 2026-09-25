import type { AppErrorCode } from "@/lib/types";

export const REVIEW_MODES = [
  {
    value: "严格审查",
    helper: "除了内置审查项外，会利用模型抽取具体合同里的对应审查项目",
  },
  {
    value: "快速审查",
    helper: "内置审查项，按照确定审查项进行审核",
  },
] as const;

export type ReviewModeValue = (typeof REVIEW_MODES)[number]["value"];

export type WorkflowStringParams = {
  gongsiming: string;
  shenchamoshi: string;
};

export type ParamValidationError = {
  field: "gongsiming" | "shenchamoshi";
  code: AppErrorCode;
  message: string;
  hint: string;
};

export function isReviewMode(value: string): value is ReviewModeValue {
  return REVIEW_MODES.some((mode) => mode.value === value);
}

export function trimWorkflowStrings(input: {
  gongsiming?: string;
  shenchamoshi?: string;
}): WorkflowStringParams {
  return {
    gongsiming: (input.gongsiming ?? "").trim(),
    shenchamoshi: (input.shenchamoshi ?? "").trim(),
  };
}

export function validateWorkflowStrings(params: WorkflowStringParams): ParamValidationError | null {
  if (!params.gongsiming) {
    return {
      field: "gongsiming",
      code: "MISSING_COMPANY",
      message: "请填写公司名。",
      hint: "开始节点必填字符串 gongsiming。未填写不会调用 Coze。",
    };
  }
  if (!params.shenchamoshi) {
    return {
      field: "shenchamoshi",
      code: "MISSING_MODE",
      message: "请选择审查模式。",
      hint: "须选择「严格审查」或「快速审查」，取值与扣子开始节点完全一致。未选择不会调用 Coze。",
    };
  }
  if (!isReviewMode(params.shenchamoshi)) {
    return {
      field: "shenchamoshi",
      code: "MISSING_MODE",
      message: "审查模式无效。",
      hint: "只接受「严格审查」或「快速审查」，不要加空格或冒号。",
    };
  }
  return null;
}
