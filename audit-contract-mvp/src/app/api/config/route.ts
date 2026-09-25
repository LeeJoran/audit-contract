import { NextResponse } from "next/server";
import { isMockCoze, getCozeConfig } from "@/lib/config";
import { ALLOWED_EXTENSIONS, MAX_FILE_BYTES } from "@/lib/constants";
import type { AppConfig } from "@/lib/types";

export async function GET() {
  const cfg = getCozeConfig();
  const body: AppConfig = {
    mock: isMockCoze(),
    maxFileBytes: MAX_FILE_BYTES,
    allowedExtensions: [...ALLOWED_EXTENSIONS],
    workflowId: cfg.workflowId,
    apiBase: cfg.apiBase,
  };
  return NextResponse.json(body);
}
