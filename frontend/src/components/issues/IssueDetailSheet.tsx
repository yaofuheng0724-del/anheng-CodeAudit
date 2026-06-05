/**
 * IssueDetailSheet — 问题详情侧滑面板
 * 从右侧滑出展示问题详情，支持 AuditIssue 和 AgentFinding 两种类型
 */

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  FileCode,
  Lightbulb,
  Bot,
  MapPin,
  Shield,
  CheckCircle,
  FlaskConical,
  Code,
  Wrench,
  Gauge,
  ChevronRight,
  Sparkles,
  Loader2,
} from "lucide-react";
import type { AggregatedAuditIssue, AggregatedAgentFinding } from "@/shared/types";
import DataFlowPathDiagram from './DataFlowPathDiagram';
import { ISSUE_STATUS_LABELS, ISSUE_STATUS_BADGE_CLASS } from "@/shared/constants";

// ============ Severity helpers ============

const SEVERITY_CONFIG: Record<string, { label: string; className: string }> = {
  critical: { label: "严重", className: "severity-critical" },
  high: { label: "高危", className: "severity-high" },
  medium: { label: "中等", className: "severity-medium" },
  low: { label: "低危", className: "severity-low" },
  info: { label: "信息", className: "severity-info" },
};

const ISSUE_TYPE_LABELS: Record<string, string> = {
  bug: "Bug",
  security: "安全",
  performance: "性能",
  style: "风格",
  maintainability: "可维护性",
};

const VULN_TYPE_LABELS: Record<string, string> = {
  sql_injection: "SQL 注入",
  nosql_injection: "NoSQL 注入",
  xss: "XSS 跨站脚本",
  command_injection: "命令注入",
  code_injection: "代码注入",
  path_traversal: "路径遍历",
  file_inclusion: "文件包含",
  ssrf: "SSRF 服务端请求伪造",
  xxe: "XXE 外部实体注入",
  deserialization: "反序列化",
  auth_bypass: "认证绕过",
  idor: "IDOR 越权访问",
  sensitive_data_exposure: "敏感数据泄露",
  hardcoded_secret: "硬编码密钥",
  weak_crypto: "弱加密",
  race_condition: "竞态条件",
  business_logic: "业务逻辑漏洞",
  memory_corruption: "内存破坏",
  other: "其他",
};

// ============ AI Explanation parser ============

function parseAIExplanation(raw: string | null | undefined) {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed.xai) return parsed.xai;
    if (parsed.what || parsed.why || parsed.how) return parsed;
    return null;
  } catch {
    // 不是 JSON，直接作为文本返回
    return { what: raw };
  }
}

// ============ Sub-components ============

function SectionCard({
  icon: Icon,
  title,
  children,
  accentColor = "text-primary",
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
  accentColor?: string;
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-muted/30 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Icon className={`w-4 h-4 ${accentColor}`} />
        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          {title}
        </span>
      </div>
      {children}
    </div>
  );
}

function CodeBlock({ code, language }: { code: string; language?: string }) {
  if (!code) return null;
  return (
    <pre className="bg-zinc-950 dark:bg-zinc-900 text-green-400 text-xs font-mono p-3 rounded-lg overflow-x-auto border border-border/40 leading-relaxed whitespace-pre-wrap break-all">
      {language && (
        <span className="text-muted-foreground text-[10px] uppercase block mb-1">{language}</span>
      )}
      <code>{code}</code>
    </pre>
  );
}

function InfoRow({ label, value, mono = false }: { label: string; value: React.ReactNode; mono?: boolean }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div className="flex items-start justify-between gap-4 py-1.5">
      <span className="text-xs text-muted-foreground uppercase tracking-wider flex-shrink-0 pt-0.5">
        {label}
      </span>
      <span className={`text-sm text-foreground text-right ${mono ? "font-mono" : ""}`}>
        {value}
      </span>
    </div>
  );
}

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color =
    pct >= 80 ? "bg-emerald-500" : pct >= 50 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-bold text-foreground w-10 text-right">{pct}%</span>
    </div>
  );
}

// ============ Main component ============

interface IssueDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  auditIssue?: AggregatedAuditIssue;
  agentFinding?: AggregatedAgentFinding;
}

export default function IssueDetailSheet({
  open,
  onOpenChange,
  auditIssue,
  agentFinding,
}: IssueDetailSheetProps) {
  const isAgent = !!agentFinding && !auditIssue;
  const issue = isAgent ? agentFinding : auditIssue;

  if (!issue) return null;

  // Common fields
  const title = issue.title || "(未命名问题)";
  const severity = (issue.severity || "low").toLowerCase();
  const sevConfig = SEVERITY_CONFIG[severity] || SEVERITY_CONFIG.low;
  const status = (issue as any).status || "open";

  // Audit-specific
  const audit = !isAgent ? (issue as AggregatedAuditIssue) : null;
  const issueType = audit?.issue_type;
  const description = issue.description || (audit as any)?.message;
  const codeSnippet = (issue as any).code_snippet;
  const suggestion = (issue as any).suggestion;
  const aiExplanation = (issue as any).ai_explanation;
  const xai = parseAIExplanation(aiExplanation);

  // Agent-specific
  const agent = isAgent ? (issue as AggregatedAgentFinding) : null;
  const vulnType = agent?.vulnerability_type;
  const isVerified = agent?.is_verified;
  const hasPoc = (agent as any)?.has_poc;
  const pocCode = (agent as any)?.poc_code;
  const pocDesc = (agent as any)?.poc_description;
  const pocSteps: string[] | null = (agent as any)?.poc_steps;
  const fixCode = (agent as any)?.fix_code;
  const fixDesc = (agent as any)?.fix_description;
  const references: Array<{ url?: string; title?: string; cwe?: string }> | null = (agent as any)?.references;
  const aiConfidence = (agent as any)?.ai_confidence ?? (agent as any)?.confidence;
  const codeContext = agent?.code_context || (audit as any)?.code_context;
  const functionName = agent?.function_name;
  const className = agent?.class_name;
  // 数据流路径：Agent finding 直接有 DataFlowStep[]，Audit issue 的 dataflow_path 是 JSON 字符串
  const source = agent?.source || (audit as any)?.source;
  const sink = agent?.sink || (audit as any)?.sink;
  const dataflowPath = agent?.dataflow_path
    || ((audit as any)?.dataflow_path
      ? (() => { try { return JSON.parse((audit as any).dataflow_path); } catch { return null; } })()
      : null);
  const verificationMethod = (agent as any)?.verification_method;
  const cvssScore = (agent as any)?.cvss_score;
  const cvssVector = (agent as any)?.cvss_vector;

  // File path & line info
  const filePath = issue.file_path || (agent as any)?.file_path;
  const lineStart = (issue as any).line_start ?? (issue as any).line_number;
  const lineEnd = (issue as any).line_end;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-[560px] overflow-y-auto p-0"
      >
        {/* Header area */}
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border px-6 py-4">
          <SheetHeader>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className={`${sevConfig.className} font-bold uppercase px-2 py-1 text-xs`}>
                {sevConfig.label}
              </Badge>
              {isAgent && vulnType && (
                <Badge className="cyber-badge-info text-xs">
                  {VULN_TYPE_LABELS[vulnType] || vulnType}
                </Badge>
              )}
              {!isAgent && issueType && (
                <Badge className="cyber-badge-muted text-xs">
                  {ISSUE_TYPE_LABELS[issueType] || issueType}
                </Badge>
              )}
              <Badge className={`border text-xs ${ISSUE_STATUS_BADGE_CLASS[status] || 'bg-muted text-muted-foreground border-border'}`}>
                {ISSUE_STATUS_LABELS[status] || status}
              </Badge>
              {isAgent && isVerified && (
                <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30 text-xs">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  已验证
                </Badge>
              )}
            </div>
            <SheetTitle className="text-base leading-snug mt-2">
              {title}
            </SheetTitle>
            <SheetDescription className="sr-only">
              问题详情
            </SheetDescription>
          </SheetHeader>
        </div>

        {/* Body */}
        <div className="px-6 py-4 space-y-4">
          {/* 位置信息 */}
          {(filePath || lineStart) && (
            <SectionCard icon={MapPin} title="位置信息">
              {filePath && (
                <div className="text-sm font-mono text-foreground bg-muted/50 px-3 py-2 rounded border border-border/50 break-all">
                  {filePath}
                  {lineStart != null && (
                    <span className="text-primary">
                      :{lineStart}
                      {lineEnd != null && lineEnd !== lineStart ? `-${lineEnd}` : ""}
                    </span>
                  )}
                </div>
              )}
              <div className="space-y-0.5">
                {functionName && <InfoRow label="函数" value={functionName} mono />}
                {className && <InfoRow label="类" value={className} mono />}
              </div>
            </SectionCard>
          )}

          {/* CVSS 评分 (Agent only) */}
          {isAgent && cvssScore != null && (
            <SectionCard icon={Gauge} title="CVSS 评分" accentColor="text-amber-500">
              <div className="flex items-center gap-3">
                <span className={`text-2xl font-extrabold ${
                  cvssScore >= 9 ? "text-red-500" : cvssScore >= 7 ? "text-amber-500" : cvssScore >= 4 ? "text-yellow-500" : "text-emerald-500"
                }`}>
                  {cvssScore.toFixed(1)}
                </span>
                {cvssVector && (
                  <span className="text-xs font-mono text-muted-foreground break-all">
                    {cvssVector}
                  </span>
                )}
              </div>
            </SectionCard>
          )}

          {/* 问题描述 */}
          {description && (
            <SectionCard icon={AlertTriangle} title="问题描述" accentColor="text-amber-500">
              <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">
                {description}
              </p>
            </SectionCard>
          )}

          {/* 代码片段 */}
          {codeSnippet && (
            <SectionCard icon={FileCode} title="问题代码" accentColor="text-red-400">
              <CodeBlock code={codeSnippet} />
            </SectionCard>
          )}

          {/* 上下文代码 (Agent only) */}
          {isAgent && codeContext && (
            <SectionCard icon={Code} title="上下文代码" accentColor="text-blue-400">
              <CodeBlock code={codeContext} />
            </SectionCard>
          )}

          {/* 数据流路径 */}
          {(source || sink || dataflowPath) && (
            <SectionCard icon={ChevronRight} title="数据流路径" accentColor="text-violet-400">
              <DataFlowPathDiagram
                dataflowPath={dataflowPath}
                source={source}
                sink={sink}
              />
            </SectionCard>
          )}

          {/* XAI 可解释分析 */}
          {xai && (
            <SectionCard icon={Bot} title="AI 深度分析" accentColor="text-violet-400">
              <div className="space-y-3">
                {xai.what && (
                  <div>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold mb-1">
                      这是什么
                    </div>
                    <p className="text-sm text-foreground/90 leading-relaxed">{xai.what}</p>
                  </div>
                )}
                {xai.why && (
                  <div>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold mb-1">
                      为什么是问题
                    </div>
                    <p className="text-sm text-foreground/90 leading-relaxed">{xai.why}</p>
                  </div>
                )}
                {xai.how && (
                  <div>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold mb-1">
                      如何利用
                    </div>
                    <p className="text-sm text-foreground/90 leading-relaxed">{xai.how}</p>
                  </div>
                )}
                {xai.impact && (
                  <div>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold mb-1">
                      影响范围
                    </div>
                    <p className="text-sm text-foreground/90 leading-relaxed">{xai.impact}</p>
                  </div>
                )}
              </div>
            </SectionCard>
          )}

          {/* AI 置信度 (Agent only) */}
          {isAgent && aiConfidence != null && (
            <SectionCard icon={Gauge} title="AI 置信度" accentColor="text-blue-400">
              <ConfidenceBar value={aiConfidence} />
            </SectionCard>
          )}

          {/* 修复建议 */}
          {suggestion && (
            <SectionCard icon={Lightbulb} title="修复建议" accentColor="text-emerald-400">
              <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">
                {suggestion}
              </p>
            </SectionCard>
          )}

          {/* 修复代码 (Agent only) */}
          {isAgent && fixCode && (
            <SectionCard icon={Wrench} title="修复代码" accentColor="text-emerald-400">
              {fixDesc && (
                <p className="text-sm text-foreground/80 mb-2">{fixDesc}</p>
              )}
              <CodeBlock code={fixCode} />
            </SectionCard>
          )}

          {/* AI排查建议 */}
          {(issue as any).ai_suggestion && (() => {
            let aiData: any = null;
            try { aiData = JSON.parse((issue as any).ai_suggestion); } catch { aiData = null; }
            if (!aiData) return null;

            if (aiData.verdict === "analyzing") {
              return (
                <SectionCard icon={Sparkles} title="AI排查建议" accentColor="text-purple-400">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    AI 正在排查中...
                  </div>
                </SectionCard>
              );
            }

            if (aiData.verdict === "error") {
              return (
                <SectionCard icon={Sparkles} title="AI排查建议" accentColor="text-red-400">
                  <p className="text-sm text-red-500">{aiData.reasoning || "AI排查失败，请稍后重试"}</p>
                </SectionCard>
              );
            }

            return (
              <SectionCard icon={Sparkles} title="AI排查建议" accentColor="text-purple-400">
                <div className="space-y-3">
                  {/* 判定结果 */}
                  <div className="flex items-center gap-2">
                    <Badge className={
                      aiData.verdict === "confirmed"
                        ? "bg-red-500/15 text-red-600 border-red-500/30 text-xs"
                        : aiData.verdict === "false_positive"
                          ? "bg-emerald-500/15 text-emerald-600 border-emerald-500/30 text-xs"
                          : "bg-amber-500/15 text-amber-600 border-amber-500/30 text-xs"
                    }>
                      {aiData.verdict === "confirmed" ? "确认存在" : aiData.verdict === "false_positive" ? "确认为误报" : "不确定"}
                    </Badge>
                    {aiData.confidence != null && (
                      <span className="text-xs text-muted-foreground">置信度 {Math.round(aiData.confidence * 100)}%</span>
                    )}
                  </div>

                  {/* 推理分析 */}
                  {aiData.reasoning && (
                    <div>
                      <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold mb-1">
                        推理分析
                      </div>
                      <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">
                        {aiData.reasoning}
                      </p>
                    </div>
                  )}

                  {/* 修复建议 */}
                  {aiData.suggestion && (
                    <div>
                      <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold mb-1">
                        AI修复建议
                      </div>
                      <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">
                        {aiData.suggestion}
                      </p>
                    </div>
                  )}

                  {/* 修复代码 */}
                  {aiData.fix_code && (
                    <div>
                      <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold mb-1">
                        AI修复代码
                      </div>
                      <CodeBlock code={aiData.fix_code} />
                    </div>
                  )}

                  {/* 置信度进度条 */}
                  {aiData.confidence != null && (
                    <ConfidenceBar value={aiData.confidence} />
                  )}
                </div>
              </SectionCard>
            );
          })()}

          {/* PoC 概念验证 (Agent only) */}
          {isAgent && hasPoc && (
            <SectionCard icon={FlaskConical} title="PoC 概念验证" accentColor="text-red-400">
              {pocDesc && (
                <p className="text-sm text-foreground/80 mb-2">{pocDesc}</p>
              )}
              {pocSteps && pocSteps.length > 0 && (
                <div className="space-y-1 mb-2">
                  {pocSteps.map((step, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-xs">
                      <span className="text-muted-foreground font-bold flex-shrink-0">{idx + 1}.</span>
                      <span className="text-foreground/90">{step}</span>
                    </div>
                  ))}
                </div>
              )}
              {pocCode && <CodeBlock code={pocCode} language="poc" />}
            </SectionCard>
          )}

          {/* 验证信息 (Agent only) */}
          {isAgent && verificationMethod && (
            <SectionCard icon={Shield} title="验证信息" accentColor="text-blue-400">
              <InfoRow label="验证方式" value={verificationMethod} />
            </SectionCard>
          )}

          {/* 参考链接 (Agent only) */}
          {isAgent && references && references.length > 0 && (
            <SectionCard icon={Lightbulb} title="参考链接" accentColor="text-blue-400">
              <div className="space-y-1.5">
                {references.map((ref, idx) => (
                  <div key={idx} className="text-xs">
                    {ref.url ? (
                      <a
                        href={ref.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline break-all"
                      >
                        {ref.title || ref.cwe || ref.url}
                      </a>
                    ) : (
                      <span className="text-foreground/80">{ref.title || ref.cwe || JSON.stringify(ref)}</span>
                    )}
                  </div>
                ))}
              </div>
            </SectionCard>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
