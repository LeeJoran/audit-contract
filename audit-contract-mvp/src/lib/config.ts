import {
  DEFAULT_COZE_API_BASE,
  DEFAULT_SPACE_ID,
  DEFAULT_WORKFLOW_ID,
} from "@/lib/constants";

export function isMockCoze(): boolean {
  if (process.env.USE_MOCK_COZE === "1") return true;
  const token = process.env.COZE_API_TOKEN?.trim();
  return !token;
}

export function getCozeConfig() {
  return {
    apiBase: (process.env.COZE_API_BASE || DEFAULT_COZE_API_BASE).replace(
      /\/$/,
      ""
    ),
    token: process.env.COZE_API_TOKEN?.trim() || "",
    workflowId: process.env.COZE_WORKFLOW_ID || DEFAULT_WORKFLOW_ID,
    spaceId: process.env.COZE_SPACE_ID || DEFAULT_SPACE_ID,
  };
}
