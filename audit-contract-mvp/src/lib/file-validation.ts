import {
  ALLOWED_EXTENSIONS,
  ALLOWED_MIME_TYPES,
  MAX_FILE_BYTES,
} from "@/lib/constants";
import type { AppErrorCode } from "@/lib/types";

export type FileLike = {
  name: string;
  size: number;
  type: string;
};

export type FileValidationError = {
  code: AppErrorCode;
  message: string;
  hint: string;
};

export function getExtension(name: string): string {
  const i = name.lastIndexOf(".");
  if (i < 0) return "";
  return name.slice(i).toLowerCase();
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function validateContractFile(file: FileLike): FileValidationError | null {
  if (!file.name || file.size === 0) {
    return {
      code: "EMPTY_FILE",
      message: "文件是空的，无法审查。",
      hint: "请选择一份有内容的 PDF 或 Word 文档。",
    };
  }

  if (file.size > MAX_FILE_BYTES) {
    return {
      code: "FILE_TOO_LARGE",
      message: `文件过大（${formatBytes(file.size)}），超过 ${formatBytes(MAX_FILE_BYTES)} 上限。`,
      hint: "请压缩后重试，或拆成较短合同。此上限是本工具的防御值，最终以 Coze 文件接口为准。",
    };
  }

  const ext = getExtension(file.name);
  const extOk = (ALLOWED_EXTENSIONS as readonly string[]).includes(ext);
  const mimeListed = (ALLOWED_MIME_TYPES as readonly string[]).includes(file.type);

  if (!extOk) {
    return {
      code: "UNSUPPORTED_TYPE",
      message: `暂不支持「${ext || "无扩展名"}」文件。`,
      hint: "第一期只接受文字版 PDF 与 .docx。不支持 .doc、.wps、图片、纯 TXT 或扫描件承诺。",
    };
  }

  if (
    file.type &&
    file.type !== "application/octet-stream" &&
    !mimeListed &&
    extOk
  ) {
    // Keep going: Windows 上 .docx 的 MIME 经常不准，扩展名已校验即可。
  }

  return null;
}
