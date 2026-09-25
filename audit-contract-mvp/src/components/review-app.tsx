"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  Loader2,
  Scale,
  ShieldAlert,
  Upload,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MAX_FILE_BYTES } from "@/lib/constants";
import { formatBytes, validateContractFile } from "@/lib/file-validation";
import {
  REVIEW_MODES,
  trimWorkflowStrings,
  validateWorkflowStrings,
} from "@/lib/workflow-params";
import type {
  ApiErrorBody,
  AppConfig,
  ReviewResult,
  RiskLevel,
  SimulateMode,
  UploadSuccess,
} from "@/lib/types";

type Phase = "idle" | "selected" | "uploading" | "reviewing";
type LevelFilter = "all" | RiskLevel;

const LEVEL_LABEL: Record<RiskLevel, string> = {
  high: "高",
  medium: "中",
  low: "低",
};

function errorFromBody(payload: unknown, fallback: string): { message: string; hint?: string; code?: string } {
  const body = payload as ApiErrorBody;
  if (body?.error?.message) {
    return { message: body.error.message, hint: body.error.hint, code: body.error.code };
  }
  return { message: fallback };
}

export function ReviewApp() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [localError, setLocalError] = useState<{ message: string; hint?: string } | null>(null);
  const [remoteError, setRemoteError] = useState<{ message: string; hint?: string } | null>(null);
  const [result, setResult] = useState<ReviewResult | null>(null);
  const [simulate, setSimulate] = useState<SimulateMode>("none");
  const [gongsiming, setGongsiming] = useState("");
  const [shenchamoshi, setShenchamoshi] = useState("");
  const [paramError, setParamError] = useState<{ message: string; hint?: string; field?: string } | null>(null);
  const [levelFilter, setLevelFilter] = useState<LevelFilter>("all");
  const [rawOpen, setRawOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/config")
      .then(async (res) => {
        if (!res.ok) throw new Error("config");
        return (await res.json()) as AppConfig;
      })
      .then((data) => {
        if (!cancelled) setConfig(data);
      })
      .catch(() => {
        if (!cancelled) setConfigError("无法读取本机配置，请确认开发服务已启动。");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (phase !== "uploading" && phase !== "reviewing") {
      setElapsed(0);
      return;
    }
    const started = Date.now();
    const id = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - started) / 1000));
    }, 250);
    return () => window.clearInterval(id);
  }, [phase]);

  const mock = config?.mock ?? true;

  const pickFile = useCallback((next: File | null) => {
    setRemoteError(null);
    setResult(null);
    setRawOpen(false);
    if (!next) {
      setFile(null);
      setLocalError(null);
      setPhase("idle");
      return;
    }
    const invalid = validateContractFile(next);
    setFile(next);
    if (invalid) {
      setLocalError({ message: invalid.message, hint: invalid.hint });
      setPhase("selected");
      return;
    }
    setLocalError(null);
    setPhase("selected");
  }, []);

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    pickFile(e.target.files?.[0] ?? null);
    e.target.value = "";
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    pickFile(e.dataTransfer.files?.[0] ?? null);
  };

  const canSubmit = Boolean(file) && !localError && (phase === "selected" || Boolean(remoteError));
  const busy = phase === "uploading" || phase === "reviewing";

  async function runReview() {
    if (!file || localError) return;
    const params = trimWorkflowStrings({ gongsiming, shenchamoshi });
    const missing = validateWorkflowStrings(params);
    if (missing) {
      setParamError(missing);
      setRemoteError(null);
      return;
    }
    setParamError(null);
    setRemoteError(null);
    setResult(null);
    setPhase("uploading");
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("simulate", simulate);
      const uploadRes = await fetch("/api/upload", { method: "POST", body: form });
      const uploadJson: unknown = await uploadRes.json().catch(() => null);
      if (!uploadRes.ok) {
        setRemoteError(errorFromBody(uploadJson, "上传失败。"));
        setPhase("selected");
        return;
      }
      const uploaded = uploadJson as UploadSuccess;
      setPhase("reviewing");
      const reviewRes = await fetch("/api/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileId: uploaded.fileId,
          fileName: uploaded.fileName,
          simulate,
          gongsiming: params.gongsiming,
          shenchamoshi: params.shenchamoshi,
        }),
      });
      const reviewJson: unknown = await reviewRes.json().catch(() => null);
      if (!reviewRes.ok) {
        setRemoteError(errorFromBody(reviewJson, "审查失败。"));
        setPhase("selected");
        return;
      }
      setResult(reviewJson as ReviewResult);
      setPhase("selected");
    } catch {
      setRemoteError({
        message: "网络异常，未能完成审查。",
        hint: "请确认本机开发服务仍在运行后重试。已选文件会保留。",
      });
      setPhase("selected");
    }
  }

  const filteredRisks = useMemo(() => {
    if (!result) return [];
    if (levelFilter === "all") return result.risks;
    return result.risks.filter((r) => r.level === levelFilter);
  }, [result, levelFilter]);

  const counts = useMemo(() => {
    const risks = result?.risks ?? [];
    return {
      high: risks.filter((r) => r.level === "high").length,
      medium: risks.filter((r) => r.level === "medium").length,
      low: risks.filter((r) => r.level === "low").length,
    };
  }, [result]);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 md:px-6 md:py-10">
      <header className="flex flex-col gap-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Scale className="size-4" />
          <span>合同辅助审查</span>
        </div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight md:text-3xl">
          上传合同，复用已有 Coze 审查工作流
        </h1>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground md:text-base">
          选择一份 PDF 或 Word（.docx），填写公司名并选择审查模式。本工具把文件交到 Coze 国内版文件接口，再以必填入参
          <code className="mx-1 rounded bg-muted px-1 py-0.5 text-xs">hetong</code>
          、
          <code className="mx-1 rounded bg-muted px-1 py-0.5 text-xs">gongsiming</code>
          、
          <code className="mx-1 rounded bg-muted px-1 py-0.5 text-xs">shenchamoshi</code>
          运行现有工作流，把返回结果整理成风险、条款要点与修改建议。审查规则仍在 Coze
          平台内，这里不做第二套引擎。
        </p>
      </header>

      {mock && (
        <Alert>
          <ShieldAlert />
          <AlertTitle>当前为本地示例结果</AlertTitle>
          <AlertDescription>
            未配置 <code>COZE_API_TOKEN</code> 或已打开 <code>USE_MOCK_COZE=1</code>
            。页面演示的是固定样例，不是对该合同的真实审查。接入国内版 PAT 后请关掉 mock
            并重启服务。
          </AlertDescription>
        </Alert>
      )}

      {configError && (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertTitle>配置不可用</AlertTitle>
          <AlertDescription>{configError}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>合同文件</CardTitle>
            <CardDescription>
              每次一份。支持文字版 PDF 与 .docx，上限 {formatBytes(config?.maxFileBytes ?? MAX_FILE_BYTES)}。不支持
              .doc、图片、纯 TXT；扫描件不承诺 OCR。
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={onDrop}
              className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-muted/40 px-4 py-8 text-center"
              onClick={() => inputRef.current?.click()}
            >
              <Upload className="size-6 text-muted-foreground" />
              <p className="text-sm font-medium">点击选择或拖放到此处</p>
              <p className="text-xs text-muted-foreground">PDF / DOCX</p>
              <input
                ref={inputRef}
                type="file"
                accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                className="hidden"
                onChange={onInputChange}
              />
            </div>

            {file && (
              <div className="rounded-lg border bg-background px-3 py-2">
                <div className="flex items-start gap-2">
                  <FileText className="mt-0.5 size-4 shrink-0" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{file.name}</p>
                    <p className="text-xs text-muted-foreground">{formatBytes(file.size)}</p>
                  </div>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="gongsiming">公司名</Label>
              <Input
                id="gongsiming"
                value={gongsiming}
                disabled={busy}
                aria-invalid={paramError?.field === "gongsiming"}
                placeholder="对应开始节点 gongsiming"
                onChange={(e) => {
                  setGongsiming(e.target.value);
                  if (paramError?.field === "gongsiming") setParamError(null);
                }}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label>审查模式</Label>
              <RadioGroup
                value={shenchamoshi}
                disabled={busy}
                aria-invalid={paramError?.field === "shenchamoshi"}
                onValueChange={(value) => {
                  setShenchamoshi(value ?? "");
                  if (paramError?.field === "shenchamoshi") setParamError(null);
                }}
              >
                {REVIEW_MODES.map((mode) => (
                  <label
                    key={mode.value}
                    className="flex cursor-pointer items-start gap-2 rounded-lg border border-border px-3 py-2 has-[:disabled]:cursor-not-allowed"
                  >
                    <RadioGroupItem
                      value={mode.value}
                      className="mt-0.5"
                      disabled={busy}
                    />
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="text-sm font-medium">{mode.value}</span>
                      <span className="text-xs leading-5 text-muted-foreground">
                        {mode.helper}
                      </span>
                    </span>
                  </label>
                ))}
              </RadioGroup>
            </div>

            {localError && (
              <Alert variant="destructive">
                <AlertTriangle />
                <AlertTitle>{localError.message}</AlertTitle>
                {localError.hint && <AlertDescription>{localError.hint}</AlertDescription>}
              </Alert>
            )}

            {paramError && (
              <Alert variant="destructive">
                <AlertTriangle />
                <AlertTitle>{paramError.message}</AlertTitle>
                {paramError.hint && <AlertDescription>{paramError.hint}</AlertDescription>}
              </Alert>
            )}

            {mock && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="simulate">开发：模拟失败</Label>
                <select
                  id="simulate"
                  className="h-8 rounded-lg border border-input bg-background px-2 text-sm"
                  value={simulate}
                  disabled={busy}
                  onChange={(e) => setSimulate(e.target.value as SimulateMode)}
                >
                  <option value="none">正常（示例结果）</option>
                  <option value="timeout">模拟超时</option>
                  <option value="unauthorized">模拟鉴权失败</option>
                  <option value="invalid">模拟无法拆分结构</option>
                </select>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                disabled={!canSubmit || busy}
                onClick={() => void runReview()}
              >
                {busy ? <Loader2 className="animate-spin" /> : null}
                开始审查
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={busy || (!file && !result && !remoteError)}
                onClick={() => {
                  pickFile(null);
                  setRemoteError(null);
                }}
              >
                清除
              </Button>
            </div>

            {busy && (
              <div className="rounded-lg bg-muted px-3 py-3 text-sm">
                {phase === "uploading" ? (
                  <p className="flex items-center gap-2">
                    <Loader2 className="size-4 animate-spin" />
                    正在把合同传到 Coze…
                  </p>
                ) : (
                  <p className="flex items-center gap-2">
                    <Loader2 className="size-4 animate-spin" />
                    正在调用 Coze 审查工作流… 已等待 {elapsed} 秒
                  </p>
                )}
                <p className="mt-1 text-xs text-muted-foreground">
                  审查期间请勿重复点击。已选文件会保留，失败后可直接重试。
                </p>
              </div>
            )}

            {config && !mock && (
              <p className="text-xs text-muted-foreground">
                将请求 {config.apiBase}，工作流 {config.workflowId}。Token 只在服务端读取。
              </p>
            )}
          </CardContent>
        </Card>

        <div className="flex min-w-0 flex-col gap-4">
          {remoteError && (
            <Alert variant="destructive">
              <AlertTriangle />
              <AlertTitle>{remoteError.message}</AlertTitle>
              {remoteError.hint && <AlertDescription>{remoteError.hint}</AlertDescription>}
            </Alert>
          )}

          {!file && !result && !busy && !remoteError && (
            <Card>
              <CardHeader>
                <CardTitle>上传 PDF 或 Word 开始审查</CardTitle>
                <CardDescription>
                  未选择文件、未填公司名或未选审查模式时不会调用 Coze。三项齐备后点「开始审查」。
                </CardDescription>
              </CardHeader>
              <CardContent className="text-sm leading-6 text-muted-foreground">
                <ul className="list-disc space-y-1 pl-5">
                  <li>公司名必填；审查模式须在「严格审查」与「快速审查」中选一，取值与扣子开始节点完全一致。</li>
                  <li>先校验类型与大小，不合格不会调用 Coze。</li>
                  <li>合格文件上传到国内版文件 API，拿到 file_id 后再跑工作流。</li>
                  <li>不会把整份 PDF 当成字符串参数发送。</li>
                </ul>
              </CardContent>
            </Card>
          )}

          {result && (
            <>
              {result.source === "mock" && (
                <Alert>
                  <ShieldAlert />
                  <AlertTitle>当前为本地示例结果</AlertTitle>
                  <AlertDescription>
                    下列条目来自内置样例，与你上传的文件内容无对应关系。
                  </AlertDescription>
                </Alert>
              )}

              {result.partial && (
                <Alert>
                  <AlertTriangle />
                  <AlertTitle>结构不完整</AlertTitle>
                  <AlertDescription>
                    工作流已返回，但未能稳定拆成风险 / 条款 / 建议。请展开原始输出核对。未公开的 Coze
                    出参不会被臆造。
                  </AlertDescription>
                </Alert>
              )}

              <Card>
                <CardHeader>
                  <div className="flex flex-wrap items-center gap-2">
                    <CheckCircle2 className="size-4 text-foreground" />
                    <CardTitle>审查摘要</CardTitle>
                    <Badge variant="secondary">{result.contractName}</Badge>
                  </div>
                  <CardDescription className="text-foreground/80">
                    {result.summary}
                  </CardDescription>
                </CardHeader>
              </Card>

              <Tabs defaultValue="risks">
                <TabsList>
                  <TabsTrigger value="risks">风险 {result.risks.length}</TabsTrigger>
                  <TabsTrigger value="clauses">条款要点 {result.clauses.length}</TabsTrigger>
                  <TabsTrigger value="suggestions">建议 {result.suggestions.length}</TabsTrigger>
                </TabsList>
                <TabsContent value="risks" className="mt-3 flex flex-col gap-3">
                  <div className="flex flex-wrap gap-2">
                    {(
                      [
                        ["all", "全部"],
                        ["high", `高 ${counts.high}`],
                        ["medium", `中 ${counts.medium}`],
                        ["low", `低 ${counts.low}`],
                      ] as const
                    ).map(([key, label]) => (
                      <Button
                        key={key}
                        size="sm"
                        variant={levelFilter === key ? "default" : "outline"}
                        onClick={() => setLevelFilter(key)}
                      >
                        {label}
                      </Button>
                    ))}
                  </div>
                  {filteredRisks.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      {result.risks.length === 0
                        ? "没有解析到风险条目。若合同极短，这可能正常；否则请查看原始输出。"
                        : "当前筛选下没有风险。"}
                    </p>
                  ) : (
                    filteredRisks.map((risk) => (
                      <Card key={risk.id} size="sm">
                        <CardHeader>
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge
                              variant={risk.level === "high" ? "destructive" : "secondary"}
                            >
                              {LEVEL_LABEL[risk.level]}
                            </Badge>
                            <CardTitle>{risk.title}</CardTitle>
                          </div>
                          {risk.clauseRef && (
                            <CardDescription>对应：{risk.clauseRef}</CardDescription>
                          )}
                        </CardHeader>
                        <CardContent className="text-sm leading-6">{risk.detail}</CardContent>
                      </Card>
                    ))
                  )}
                </TabsContent>
                <TabsContent value="clauses" className="mt-3 flex flex-col gap-3">
                  {result.clauses.length === 0 ? (
                    <p className="text-sm text-muted-foreground">没有解析到条款要点。</p>
                  ) : (
                    result.clauses.map((clause) => (
                      <Card key={clause.id} size="sm">
                        <CardHeader>
                          <CardTitle>{clause.title}</CardTitle>
                        </CardHeader>
                        <CardContent className="text-sm leading-6">
                          <p>{clause.excerpt}</p>
                          {clause.comment && (
                            <p className="mt-2 text-muted-foreground">{clause.comment}</p>
                          )}
                        </CardContent>
                      </Card>
                    ))
                  )}
                </TabsContent>
                <TabsContent value="suggestions" className="mt-3 flex flex-col gap-3">
                  {result.suggestions.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      没有解析到修改建议。高风险仍建议结合原始输出自行判断。
                    </p>
                  ) : (
                    result.suggestions.map((sug) => (
                      <Card key={sug.id} size="sm">
                        <CardContent className="pt-1 text-sm leading-6">{sug.action}</CardContent>
                      </Card>
                    ))
                  )}
                </TabsContent>
              </Tabs>

              <Separator />
              <div>
                <Button variant="ghost" size="sm" onClick={() => setRawOpen((v) => !v)}>
                  {rawOpen ? "收起原始输出" : "展开原始输出"}
                </Button>
                {rawOpen && (
                  <pre className="mt-2 max-h-80 overflow-auto rounded-lg bg-muted p-3 text-xs leading-5">
                    {result.rawText || "（空）"}
                  </pre>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <p className="border-t pt-4 text-xs leading-5 text-muted-foreground">
        本工具为辅助审查，不构成法律意见。输出仅供内部核对，最终判断请咨询具备资质的法律专业人士。合同文件默认不在本机长期保存。
      </p>
    </div>
  );
}
