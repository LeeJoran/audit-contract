import { NextResponse } from "next/server";
import type { ApiErrorBody, AppErrorCode } from "@/lib/types";

export function errorResponse(
  status: number,
  code: AppErrorCode,
  message: string,
  hint?: string
) {
  const body: ApiErrorBody = { error: { code, message, hint } };
  return NextResponse.json(body, { status });
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
