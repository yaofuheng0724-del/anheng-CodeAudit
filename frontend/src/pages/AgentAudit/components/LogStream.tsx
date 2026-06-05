/**
 * 日志流组件
 * 简约行式展示，轻量分隔
 */

import { memo } from "react";
import { Loader2, ChevronDown, ChevronRight } from "lucide-react";
import { LOG_TYPE_CONFIG } from "../constants";
import { AUDIT_PHASE_CONFIG, AUDIT_PHASES } from "../types";
import type { AuditPhase, LogItem } from "../types";

// ============ 严重等级配色 ============

const SEVERITY_BADGE: Record<string, { label: string; className: string }> = {
  critical: { label: "严重", className: "text-rose-600" },
  high: { label: "高危", className: "text-orange-600" },
  medium: { label: "中危", className: "text-amber-600" },
  low: { label: "低危", className: "text-sky-600" },
};

// ============ 清理日志内容 ============

function cleanLogContent(text: string): string {
  if (!text) return text;
  return text
    // 移除所有 emoji（包括各种范围）
    .replace(/[\u{1F000}-\u{1FFFF}]/gu, "")
    .replace(/[\u{2600}-\u{27BF}]/gu, "")
    .replace(/[\u{FE00}-\u{FE0F}]/gu, "")  // 变体选择符
    // 移除方括号标签如 [Recon]、[Analysis] 等
    .replace(/\[[\w\s]+\]\s*/g, "")
    // 移除特定 emoji 和符号
    .replace(/[✅🔗🛑✕⚠️❌⚡🔄🔍💡📁📄🐛🛡️🔧📤📊📦🔬🔴🟠🟡🟢🔵🟣⚫⚪📍📋🎯💪📝🔥💯✨🎉🚀💾🔐🔑🚫✔️✓❶❷❸❹❺]/g, "")
    // 移除 @Agent 名
    .replace(/@\w+\s*/g, "")
    // 移除开头的特殊字符和分隔符
    .replace(/^[:\-–—•·│┃┆┇┊┋╎╏║▪▫□▢■▣▤▥▦▧▨▩░▒▓°∞∑∈√∫≈≠≤≥◊○●◦◉◎★☆♠♣♥♦♤♧♨♬♩♪♭♯♮✦✧✩✪✫✬✭✮✯✰✱✲✳✴✵✶✷✸✹✺✻✼✽✾✿❀❁❂❃❄❅❆❇❈❉❊❋]+\s*/gm, "")
    // 清理多余空格和换行
    .replace(/\s{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim() || text;
}

function cleanTitle(title: string): string {
  return cleanLogContent(title);
}

// ============ 单条日志行 ============

function LogCard({
  item,
  isExpanded,
  onToggle,
}: {
  item: LogItem;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const typeConfig = LOG_TYPE_CONFIG[item.type] || LOG_TYPE_CONFIG.info;
  const title = cleanTitle(item.title);
  const isCollapsible = !!(item.content && item.type !== "thinking");
  const isThinking = item.type === "thinking";

  return (
    <div
      className="py-1.5 px-3 hover:bg-slate-50/80 transition-colors duration-100 cursor-default"
      onClick={isCollapsible ? onToggle : undefined}
    >
      {/* 标题行 */}
      <div className="flex items-center gap-2">
        {/* 类型标签 - 极简 */}
        <span className={`text-[10px] font-medium ${
          item.type === 'thinking' ? 'text-violet-500' :
          item.type === 'tool' ? 'text-amber-500' :
          item.type === 'finding' ? 'text-rose-500' :
          item.type === 'dispatch' ? 'text-sky-500' :
          item.type === 'error' ? 'text-red-500' :
          item.type === 'progress' ? 'text-emerald-500' :
          'text-slate-400'
        }`}>
          {typeConfig.label}
        </span>

        {/* 时间戳 */}
        {item.time && (
          <span className="text-[10px] text-slate-300 tabular-nums flex-shrink-0">{item.time}</span>
        )}

        {/* 标题 */}
        <span className="text-xs text-slate-600 truncate flex-1">
          {isThinking && item.isStreaming ? (
            <>
              {title || "正在思考..."}
              <span className="inline-block w-0.5 h-3 bg-violet-300 rounded-sm ml-0.5 animate-pulse" />
            </>
          ) : title}
        </span>

        {/* 工具状态 */}
        {item.tool?.status === "running" && (
          <span className="text-[10px] text-amber-500 flex-shrink-0 flex items-center gap-1">
            <Loader2 className="w-2.5 h-2.5 animate-spin" />
            运行中
          </span>
        )}
        {item.tool?.status === "completed" && (
          <span className="text-[10px] text-emerald-500 flex-shrink-0">
            完成{item.tool.duration ? ` ${item.tool.duration}ms` : ""}
          </span>
        )}

        {/* 严重度 */}
        {item.severity && SEVERITY_BADGE[item.severity] && (
          <span className={`text-[10px] font-medium flex-shrink-0 ${SEVERITY_BADGE[item.severity].className}`}>
            {SEVERITY_BADGE[item.severity].label}
          </span>
        )}

        {/* Agent名 */}
        {item.agentName && (
          <span className="text-[10px] text-slate-300 flex-shrink-0">@{item.agentName}</span>
        )}

        {/* 展开指示 */}
        {isCollapsible && (
          <span className="text-slate-300 flex-shrink-0">
            {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          </span>
        )}
      </div>

      {/* 思考内容 */}
      {isThinking && item.content && (
        <div className="mt-1 ml-4 text-xs text-slate-400 whitespace-pre-wrap break-words leading-relaxed">
          {cleanLogContent(item.content)}
        </div>
      )}

      {/* 可展开内容 */}
      {isCollapsible && isExpanded && item.content && (
        <div className="mt-1 ml-4 text-xs text-slate-400 whitespace-pre-wrap break-words leading-relaxed max-h-48 overflow-y-auto bg-slate-50 rounded p-2">
          {cleanLogContent(item.content)}
        </div>
      )}
    </div>
  );
}

// ============ 主组件 ============

interface LogStreamProps {
  currentPhase: AuditPhase;
  completedPhases: AuditPhase[];
  isRunning: boolean;
  isComplete: boolean;
  phaseLogMap: Record<string, LogItem[]>;
  expandedLogIds: Set<string>;
  onToggleLogExpanded: (id: string) => void;
  isAutoScroll: boolean;
  onToggleAutoScroll: () => void;
  scrollRef: React.RefObject<HTMLDivElement | null>;
}

export const LogStream = memo(function LogStream({
  currentPhase,
  completedPhases,
  isRunning,
  isComplete,
  phaseLogMap,
  expandedLogIds,
  onToggleLogExpanded,
  scrollRef,
}: LogStreamProps) {
  const startedPhases = AUDIT_PHASES.filter((phase) => {
    if (completedPhases.includes(phase)) return true;
    if (phase === currentPhase) return true;
    if (isComplete) return true;
    return false;
  });

  const totalLogs = Object.values(phaseLogMap).reduce((sum, logs) => sum + logs.length, 0);

  return (
    <div className="flex flex-col h-full min-h-0 border border-slate-200 rounded overflow-hidden bg-white">
      {/* 头部 - 简化 */}
      <div className="flex items-center px-3 py-2 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-slate-700">日志</span>
          <span className="text-xs font-medium text-slate-600">{totalLogs}</span>
        </div>
      </div>

      {/* 日志流 */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto custom-scrollbar bg-slate-50/30">
        {startedPhases.length === 0 && (
          <div className="py-16 text-center">
            <p className="text-xs text-slate-300">
              {isRunning ? "等待活动..." : "暂无记录"}
            </p>
          </div>
        )}

        {startedPhases.map((phase) => {
          const isCompleted = completedPhases.includes(phase) || (isComplete && phase === currentPhase);
          const isActive = phase === currentPhase && !isCompleted;
          const logs = phaseLogMap[phase] || [];
          const config = AUDIT_PHASE_CONFIG[phase];

          return (
            <div key={phase}>
              {/* 阶段分隔 - 简化 */}
              <div className="flex items-center gap-2 px-3 py-2">
                <span className={`text-[10px] font-medium ${isActive ? 'text-indigo-500' : 'text-slate-400'}`}>
                  {config.label}
                </span>
                <div className="flex-1 h-px bg-slate-100" />
              </div>

              {/* 日志条目 */}
              {logs.length > 0 && (
                <div>
                  {logs.map((item) => (
                    <LogCard
                      key={item.id}
                      item={item}
                      isExpanded={expandedLogIds.has(item.id)}
                      onToggle={() => onToggleLogExpanded(item.id)}
                    />
                  ))}
                </div>
              )}

              {/* 活跃阶段无日志 */}
              {isActive && logs.length === 0 && (
                <div className="py-4 text-center">
                  <Loader2 className="w-3.5 h-3.5 animate-spin mx-auto mb-1 text-indigo-300" />
                  <p className="text-[10px] text-slate-300">等待活动...</p>
                </div>
              )}

              {/* 阶段结束标记 */}
              {isCompleted && (
                <div className="flex items-center gap-2 px-3 py-1.5">
                  <span className="text-[10px] text-emerald-500">{config.label}完成</span>
                  <div className="flex-1 h-px bg-slate-50" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
});

export default LogStream;
