/**
 * 扫描进度监控弹框
 * 简约风格：白色头部 + 左右分栏指标 + 卡片式日志流
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { Dialog, DialogOverlay, DialogPortal } from "@/components/ui/dialog";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X as XIcon } from "lucide-react";
import { cn, calculateTaskProgress } from "@/shared/utils/utils";
import * as VisuallyHidden from "@radix-ui/react-visually-hidden";
import { taskControl } from "@/shared/services/taskControl";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface TerminalProgressDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    taskId: string | null;
    taskType: "repository" | "zip";
}

interface LogEntry {
    id: string;
    timestamp: string;
    message: string;
    type: "info" | "success" | "error" | "warning";
}

// ============ 中文标签替换映射 ============

const TAG_MAP: Record<string, string> = {
    "[INFO]": "[信息]", "[WAIT]": "[等待]", "[SCAN]": "[扫描]",
    "[PROG]": "[进度]", "[WARN]": "[警告]", "[ERR]": "[错误]",
    "[OK]": "[成功]", "[NET]": "[网络]", "[DONE]": "[完成]",
    "[STAT]": "[统计]", "[RSLT]": "[结果]", "[FAIL]": "[失败]",
    "[CRIT]": "[严重]", "[HIGH]": "[高危]", "[MED]": "[中危]", "[LOW]": "[低危]",
    "[SCOR]": "[评分]", "[FIN]": "[结束]", "[TIME]": "[耗时]",
    "[STOP]": "[停止]", "[SAVE]": "[保存]", "[HINT]": "[建议]",
    "[LOGS]": "[日志]", "[PROJ]": "[项目]", "[BRCH]": "[分支]",
    "TASK_ID": "任务ID", "TYPE": "类型",
    "REPO_AUDIT": "仓库审计", "ZIP_AUDIT": "本地文件审计",
};

function localizeMessage(msg: string): string {
    let result = msg;
    for (const [eng, cn] of Object.entries(TAG_MAP)) {
        result = result.replace(eng, cn);
    }
    return result;
}

// ============ 日志类型配色 ============

const LOG_TYPE_STYLE: Record<string, { border: string; bg: string; text: string }> = {
    info:    { border: "border-l-blue-400",      bg: "bg-blue-50/50 dark:bg-blue-950/20",       text: "text-blue-700 dark:text-blue-300" },
    success: { border: "border-l-emerald-400",    bg: "bg-emerald-50/50 dark:bg-emerald-950/20", text: "text-emerald-700 dark:text-emerald-300" },
    warning: { border: "border-l-amber-400",      bg: "bg-amber-50/50 dark:bg-amber-950/20",    text: "text-amber-700 dark:text-amber-300" },
    error:   { border: "border-l-rose-500",       bg: "bg-rose-50/50 dark:bg-rose-950/20",      text: "text-rose-700 dark:text-rose-300" },
};

// ============ 风险等级 ============

function getRiskInfo(score: number): { label: string; cls: string } {
    if (score === 100) return { label: "无风险", cls: "text-emerald-500" };
    if (score <= 25) return { label: "严重风险", cls: "text-rose-600" };
    if (score <= 50) return { label: "高风险", cls: "text-orange-600" };
    if (score <= 75) return { label: "中风险", cls: "text-amber-600" };
    return { label: "低风险", cls: "text-emerald-600" };
}

export default function TerminalProgressDialog({
    open,
    onOpenChange,
    taskId,
    taskType
}: TerminalProgressDialogProps) {
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [isCompleted, setIsCompleted] = useState(false);
    const [isFailed, setIsFailed] = useState(false);
    const [isCancelled, setIsCancelled] = useState(false);
    const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    const [scannedFiles, setScannedFiles] = useState(0);
    const [totalFiles, setTotalFiles] = useState(0);
    const [issuesCount, setIssuesCount] = useState(0);
    const [qualityScore, setQualityScore] = useState(0);
    const [totalLines, setTotalLines] = useState(0);

    const logsEndRef = useRef<HTMLDivElement>(null);
    const pollIntervalRef = useRef<number | null>(null);
    const hasInitializedLogsRef = useRef(false);

    const logsRef = useRef<LogEntry[]>([]);
    const isCompletedRef = useRef(false);
    const isFailedRef = useRef(false);
    const isCancelledRef = useRef(false);

    useEffect(() => { logsRef.current = logs; }, [logs]);
    useEffect(() => { isCompletedRef.current = isCompleted; }, [isCompleted]);
    useEffect(() => { isFailedRef.current = isFailed; }, [isFailed]);
    useEffect(() => { isCancelledRef.current = isCancelled; }, [isCancelled]);

    const addLog = useCallback((message: string, type: LogEntry["type"] = "info") => {
        const timestamp = new Date().toLocaleTimeString("zh-CN", {
            hour: "2-digit", minute: "2-digit", second: "2-digit"
        });
        setLogs(prev => [...prev, { id: Math.random().toString(36).substr(2, 9), timestamp, message, type }]);
    }, []);

    const handleCancel = async () => {
        if (!taskId) return;
        if (!confirm('确定要取消此任务吗？已分析的结果将被保留。')) return;

        taskControl.cancelTask(taskId);
        setIsCancelled(true);
        addLog("[错误] 用户取消任务，正在停止...", "error");

        try {
            const { api } = await import("@/shared/config/database");
            await api.updateAuditTask(taskId, { status: 'cancelled' } as any);
            addLog("[警告] 任务状态已更新为已取消", "warning");
            toast.success("任务已取消");
        } catch (error) {
            toast.warning("任务已标记取消，后台正在停止...");
        }
    };

    // 自动滚动
    useEffect(() => { logsEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [logs]);

    // 实时时间
    useEffect(() => {
        if (!open || isCompleted || isFailed || isCancelled) return;
        const timeInterval = setInterval(() => {
            setCurrentTime(new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
        }, 1000);
        return () => clearInterval(timeInterval);
    }, [open, isCompleted, isFailed, isCancelled]);

    // 轮询任务状态
    useEffect(() => {
        if (!open || !taskId) {
            setLogs([]);
            logsRef.current = [];
            setIsCompleted(false);
            setIsFailed(false);
            setIsCancelled(false);
            setScannedFiles(0);
            setTotalFiles(0);
            setIssuesCount(0);
            setQualityScore(0);
            setTotalLines(0);
            hasInitializedLogsRef.current = false;
            if (pollIntervalRef.current) { clearInterval(pollIntervalRef.current); pollIntervalRef.current = null; }
            return;
        }

        if (!hasInitializedLogsRef.current) {
            hasInitializedLogsRef.current = true;
            addLog("[信息] 审计任务已启动", "info");
            addLog(`类型: ${taskType === "repository" ? "仓库审计" : "本地文件审计"}`, "info");
            addLog("[等待] 正在初始化审计环境...", "info");
        }

        let lastScannedFiles = 0;
        let lastIssuesCount = 0;
        let lastTotalLines = 0;
        let lastStatus = "";
        let isFirstPoll = true;

        const pollTask = async () => {
            if (isCompletedRef.current || isFailedRef.current) {
                if (pollIntervalRef.current) { clearInterval(pollIntervalRef.current); pollIntervalRef.current = null; }
                return;
            }

            try {
                const { api } = await import("@/shared/config/database");
                const task = await api.getAuditTaskById(taskId);

                if (!task) {
                    // 真正的 404 — 任务不存在，停止轮询
                    addLog("[错误] 任务不存在，请确认任务是否已被删除", "error");
                    setIsFailed(true);
                    if (pollIntervalRef.current) { clearInterval(pollIntervalRef.current); pollIntervalRef.current = null; }
                    return;
                }

                // 更新统计
                setScannedFiles(task.scanned_files || 0);
                setTotalFiles(task.total_files || 0);
                setIssuesCount(task.issues_count || 0);
                setQualityScore(task.quality_score || 0);
                setTotalLines(task.total_lines || 0);

                // 编译后产物没有"代码行数"这个概念，跳过相关日志/卡片以免误导
                const isCompiledScan = task.project?.scan_mode === "compiled";

                const statusChanged = task.status !== lastStatus;
                const filesChanged = task.scanned_files !== lastScannedFiles;
                const issuesChanged = task.issues_count !== lastIssuesCount;
                const linesChanged = task.total_lines !== lastTotalLines;
                const hasDataChange = statusChanged || filesChanged || issuesChanged || linesChanged;

                if (isFirstPoll) isFirstPoll = false;

                // 状态变化时打印详细信息
                if (hasDataChange && task.status !== "pending") {
                    const details: string[] = [];
                    details.push(`状态: ${task.status}`);
                    if (task.scanned_files) details.push(`文件: ${task.scanned_files}/${task.total_files}`);
                    if (task.issues_count) details.push(`问题: ${task.issues_count}`);
                    if (task.total_lines && !isCompiledScan) details.push(`行数: ${task.total_lines}`);
                    if (task.quality_score) {
                        const riskLabel = task.quality_score === 100 ? "无风险" : task.quality_score <= 25 ? "严重风险" : task.quality_score <= 50 ? "高风险" : task.quality_score <= 75 ? "中风险" : "低风险";
                        details.push(`风险: ${riskLabel}`);
                    }
                    if (task.branch_name) details.push(`分支: ${task.branch_name}`);
                    // 把所有task字段都打出来
                    if (task.error_message) details.push(`错误: ${task.error_message}`);
                    if (task.progress_percentage) details.push(`进度百分比: ${task.progress_percentage}%`);
                    addLog(`[成功] ${details.join(" | ")}`, "success");
                }

                if (statusChanged) lastStatus = task.status;

                if (task.status === "pending") {
                    // 静默
                } else if (task.status === "running") {
                    if (statusChanged && logsRef.current.filter(l => l.message.includes("开始扫描")).length === 0) {
                        addLog("[扫描] 开始扫描代码文件...", "info");
                        if (task.project) {
                            addLog(`[项目] 项目: ${task.project.name}`, "info");
                            if (task.branch_name) addLog(`[分支] 分支: ${task.branch_name}`, "info");
                        }
                    }

                    if (filesChanged && task.scanned_files > lastScannedFiles) {
                        const progress = calculateTaskProgress(task.scanned_files, task.total_files);
                        addLog(`[进度] ${task.scanned_files}/${task.total_files} 文件 (${progress}%)`, "info");
                        lastScannedFiles = task.scanned_files;
                    }

                    if (issuesChanged && task.issues_count > lastIssuesCount) {
                        addLog(`[警告] 发现 ${task.issues_count - lastIssuesCount} 个新问题 (总计: ${task.issues_count})`, "warning");
                        lastIssuesCount = task.issues_count;
                    }

                    if (linesChanged && task.total_lines > lastTotalLines && !isCompiledScan) {
                        addLog(`[统计] 已分析 ${task.total_lines.toLocaleString()} 行代码`, "info");
                        lastTotalLines = task.total_lines;
                    }
                } else if (task.status === "completed") {
                    if (!isCompletedRef.current) {
                        addLog("", "info");
                        addLog("[完成] 代码扫描完成", "success");

                        addLog(`[统计] 总计扫描: ${task.total_files} 个文件`, "success");
                        if (!isCompiledScan) {
                            addLog(`[统计] 总计分析: ${task.total_lines.toLocaleString()} 行代码`, "success");
                        }
                        addLog(`[结果] 发现问题: ${task.issues_count} 个`, task.issues_count > 0 ? "warning" : "success");

                        if (task.issues_count > 0) {
                            try {
                                const { api: apiImport } = await import("@/shared/config/database");
                                const issues = await apiImport.getAuditIssues(taskId);
                                const sc = { critical: 0, high: 0, medium: 0, low: 0 };
                                issues.forEach(i => { if (sc[i.severity as keyof typeof sc] !== undefined) sc[i.severity as keyof typeof sc]++; });
                                if (sc.critical) addLog(`  [严重] ${sc.critical} 个`, "error");
                                if (sc.high) addLog(`  [高危] ${sc.high} 个`, "warning");
                                if (sc.medium) addLog(`  [中危] ${sc.medium} 个`, "warning");
                                if (sc.low) addLog(`  [低危] ${sc.low} 个`, "info");
                            } catch (_e) { /* 静默 */ }
                        }

                        const riskLabel = task.quality_score === 100 ? "无风险" : task.quality_score <= 25 ? "严重风险" : task.quality_score <= 50 ? "高风险" : task.quality_score <= 75 ? "中风险" : "低风险";
                        addLog(`[风险] 风险等级: ${riskLabel}`, task.quality_score <= 50 ? "warning" : "success");
                        addLog("[结束] 审计任务已完成！", "success");

                        if (task.completed_at) {
                            const duration = Math.round((new Date(task.completed_at).getTime() - new Date(task.created_at).getTime()) / 1000);
                            addLog(`[耗时] 总耗时: ${duration} 秒`, "info");
                        }

                        setIsCompleted(true);
                        if (pollIntervalRef.current) { clearInterval(pollIntervalRef.current); pollIntervalRef.current = null; }
                    }
                } else if (task.status === "cancelled") {
                    if (!isCancelledRef.current) {
                        addLog("", "info");
                        addLog("[停止] 任务已被用户取消", "warning");
                        addLog(`[统计] 已分析文件: ${task.scanned_files}/${task.total_files}`, "info");
                        addLog(`[统计] 发现问题: ${task.issues_count} 个`, "info");
                        if (!isCompiledScan) {
                            addLog(`[统计] 代码行数: ${task.total_lines.toLocaleString()} 行`, "info");
                        }
                        addLog("[保存] 已分析的结果已保存", "success");
                        setIsCancelled(true);
                        if (pollIntervalRef.current) { clearInterval(pollIntervalRef.current); pollIntervalRef.current = null; }
                    }
                } else if (task.status === "failed") {
                    if (!isFailedRef.current) {
                        addLog("", "info");
                        addLog("[失败] 审计任务执行失败", "error");

                        try {
                            const { logger } = await import("@/shared/utils/logger");
                            const taskErrors = logger.getLogs({ startTime: Date.now() - 60000 })
                                .filter(l => l.level === 'ERROR' && (l.message.includes(taskId) || l.message.includes('审计') || l.message.includes('API')))
                                .slice(-3);
                            if (taskErrors.length > 0) {
                                addLog("具体错误:", "error");
                                taskErrors.forEach(l => {
                                    addLog(`  • ${l.message}`, "error");
                                    if (l.data?.error) addLog(`    ${typeof l.data.error === 'string' ? l.data.error : l.data.error.message || JSON.stringify(l.data.error)}`, "error");
                                });
                            } else {
                                addLog("可能的原因:", "error");
                                addLog("  • 网络连接问题", "error");
                                addLog("  • 仓库访问权限不足", "error");
                                addLog("  • API 限流", "error");
                                addLog("  • LLM 配置错误或额度不足", "error");
                            }
                        } catch (_e) {
                            addLog("可能的原因:", "error");
                            addLog("  • 网络连接问题", "error");
                            addLog("  • 仓库访问权限不足", "error");
                            addLog("  • API 限流", "error");
                            addLog("  • LLM 配置错误或额度不足", "error");
                        }

                        addLog("[建议] 检查系统配置和网络连接后重试", "warning");
                        setIsFailed(true);
                        if (pollIntervalRef.current) { clearInterval(pollIntervalRef.current); pollIntervalRef.current = null; }
                    }
                }
            } catch (error: unknown) {
                // 区分临时性错误 vs 严重错误
                const isTransient = typeof error === 'object' && error !== null && 'isTransient' in error;
                if (isTransient) {
                    // 服务器连接/超时等临时问题 — 不中断轮询，仅打印警告
                    const transientErr = error as { isTransient: boolean; status?: number; message?: string };
                    if (transientErr.status === 403) {
                        addLog("[警告] 权限不足，正在重试...", "warning");
                    } else {
                        addLog("[警告] 服务暂时不可用，正在重试...", "warning");
                    }
                } else {
                    // 未知严重错误 — 打印但不中断轮询（可能自行恢复）
                    addLog(`[错误] ${error instanceof Error ? error.message : "未知错误"}`, "error");
                }
            }
        };

        pollTask();
        pollIntervalRef.current = window.setInterval(pollTask, 2000);

        return () => { if (pollIntervalRef.current) { clearInterval(pollIntervalRef.current); pollIntervalRef.current = null; } };
    }, [open, taskId, taskType, addLog]);

    const progressPercent = totalFiles > 0 ? Math.round((scannedFiles / totalFiles) * 100) : 0;
    const risk = getRiskInfo(qualityScore);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogPortal>
                <DialogOverlay className="bg-black/50 backdrop-blur-sm" />
                <DialogPrimitive.Content
                    className={cn(
                        "fixed left-[50%] top-[50%] z-50 translate-x-[-50%] translate-y-[-50%]",
                        "w-[92vw] max-w-[1040px] h-[85vh] max-h-[740px]",
                        "bg-background border border-border rounded-2xl overflow-hidden shadow-2xl",
                        "data-[state=open]:animate-in data-[state=closed]:animate-out",
                        "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
                        "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
                        "duration-300 font-sans flex flex-col"
                    )}
                    onPointerDownOutside={(e) => e.preventDefault()}
                    onInteractOutside={(e) => e.preventDefault()}
                >
                    <VisuallyHidden.Root>
                        <DialogPrimitive.Title>扫描进度监控</DialogPrimitive.Title>
                        <DialogPrimitive.Description>实时显示代码审计任务的执行进度和详细信息</DialogPrimitive.Description>
                    </VisuallyHidden.Root>

                    {/* ===== Header ===== */}
                    <div className="flex-shrink-0 px-6 pt-5 pb-4 border-b border-border/60">
                        {/* 标题行 */}
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 border border-primary/20 shadow-sm">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/>
                                        <path d="m9 12 2 2 4-4"/>
                                    </svg>
                                </div>
                                <div>
                                    <h2 className="text-base font-semibold text-foreground tracking-tight">{taskType === "zip" ? "本地文件扫描进度监控" : "快速扫描进度监控"}</h2>
                                    <p className="text-xs text-muted-foreground mt-0.5">实时追踪代码审计执行状态与日志输出</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                {!isCompleted && !isFailed && !isCancelled ? (
                                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200/50 dark:border-emerald-800/30">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                        <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">运行中</span>
                                    </div>
                                ) : isCompleted ? (
                                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200/50 dark:border-emerald-800/30">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                        <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">已完成</span>
                                    </div>
                                ) : isFailed ? (
                                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-50 dark:bg-rose-950/30 border border-rose-200/50 dark:border-rose-800/30">
                                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                                        <span className="text-xs font-medium text-rose-700 dark:text-rose-400">失败</span>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-950/30 border border-amber-200/50 dark:border-amber-800/30">
                                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                        <span className="text-xs font-medium text-amber-700 dark:text-amber-400">已取消</span>
                                    </div>
                                )}
                                <button type="button" className="w-8 h-8 flex items-center justify-center hover:bg-muted/60 rounded-lg transition-colors" onClick={() => onOpenChange(false)}>
                                    <XIcon className="w-4 h-4 text-muted-foreground" />
                                </button>
                            </div>
                        </div>

                        {/* 统计指标行 */}
                        <div className="grid grid-cols-4 gap-3">
                            {/* 文件进度 */}
                            <div className="px-3.5 py-2.5 rounded-xl bg-muted/40 border border-border/40">
                                <div className="flex items-center justify-between mb-1.5">
                                    <span className="text-xs text-muted-foreground">文件进度</span>
                                    <span className="text-xs font-semibold text-primary tabular-nums">{progressPercent}%</span>
                                </div>
                                <div className="flex items-center gap-1.5 mb-2">
                                    <span className="text-sm font-bold text-foreground tabular-nums">{scannedFiles}</span>
                                    <span className="text-xs text-muted-foreground">/ {totalFiles}</span>
                                </div>
                                <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                                    <div
                                        className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
                                        style={{ width: `${progressPercent}%` }}
                                    />
                                </div>
                            </div>

                            {/* 问题数量 */}
                            <div className="px-3.5 py-2.5 rounded-xl bg-muted/40 border border-border/40">
                                <span className="text-xs text-muted-foreground">发现问题</span>
                                <div className="mt-1.5">
                                    <span className={`text-sm font-bold tabular-nums ${issuesCount > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-foreground'}`}>
                                        {issuesCount}
                                    </span>
                                    {issuesCount > 0 && (
                                        <span className="text-xs text-muted-foreground ml-1">个</span>
                                    )}
                                </div>
                            </div>

                            {/* 代码行数 */}
                            <div className="px-3.5 py-2.5 rounded-xl bg-muted/40 border border-border/40">
                                <span className="text-xs text-muted-foreground">代码行数</span>
                                <div className="mt-1.5">
                                    <span className="text-sm font-bold text-foreground tabular-nums">{totalLines.toLocaleString()}</span>
                                    <span className="text-xs text-muted-foreground ml-1">行</span>
                                </div>
                            </div>

                            {/* 风险等级 / 评分 */}
                            <div className="px-3.5 py-2.5 rounded-xl bg-muted/40 border border-border/40">
                                <span className="text-xs text-muted-foreground">
                                    {isCompleted && qualityScore > 0 ? '风险等级' : '质量评分'}
                                </span>
                                <div className="mt-1.5">
                                    {isCompleted && qualityScore > 0 ? (
                                        <span className={`text-sm font-bold ${risk.cls}`}>{risk.label}</span>
                                    ) : (
                                        <span className="text-sm font-bold text-foreground tabular-nums">{qualityScore.toFixed(1)}</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ===== 日志流 ===== */}
                    <div className="flex-1 overflow-y-auto px-5 py-4 custom-scrollbar">
                        <div className="space-y-1.5 pb-8">
                            {logs.map((log) => {
                                const style = LOG_TYPE_STYLE[log.type] || LOG_TYPE_STYLE.info;
                                const displayMsg = localizeMessage(log.message);
                                const isDivider = displayMsg.startsWith("──");

                                if (isDivider) return <div key={log.id} className="h-px bg-border/60 my-2.5" />;
                                if (!displayMsg.trim()) return <div key={log.id} className="h-3" />;

                                return (
                                    <div key={log.id} className={`rounded-lg px-3.5 py-2 border-l-[3px] ${style.border} ${style.bg} ${style.text} text-sm`}>
                                        <div className="flex items-start gap-3">
                                            <span className="text-xs text-muted-foreground tabular-nums flex-shrink-0 w-[72px]">{log.timestamp}</span>
                                            <span className="flex-1 leading-relaxed">{displayMsg}</span>
                                        </div>
                                    </div>
                                );
                            })}

                            {!isCompleted && !isFailed && !isCancelled && (
                                <div className="flex items-center gap-3 mt-2 px-3.5">
                                    <span className="text-xs text-muted-foreground tabular-nums w-[72px]">{currentTime}</span>
                                    <span className="text-primary animate-pulse font-semibold">_</span>
                                </div>
                            )}
                            <div ref={logsEndRef} />
                        </div>
                    </div>

                    {/* ===== Footer ===== */}
                    <div className="flex-shrink-0 px-6 py-3.5 border-t border-border/60 bg-muted/20 flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">
                            {isCompleted ? "扫描完成" : isFailed ? "任务执行失败 — 请检查配置后重试" : isCancelled ? "任务已取消 — 已分析结果已保存" : "正在执行扫描任务..."}
                        </span>

                        <div className="flex items-center gap-2.5">
                            {!isCompleted && !isFailed && !isCancelled && (
                                <Button size="sm" variant="outline" onClick={handleCancel} className="h-8 rounded-lg text-sm">
                                    取消任务
                                </Button>
                            )}
                            {isFailed && (
                                <Button size="sm" variant="outline" onClick={() => window.open('/logs', '_blank')} className="h-8 rounded-lg text-sm">
                                    查看日志
                                </Button>
                            )}
                            {(isCompleted || isFailed || isCancelled) && (
                                <Button size="sm" onClick={() => onOpenChange(false)} className="h-8 rounded-lg px-4 text-sm">
                                    确认关闭
                                </Button>
                            )}
                        </div>
                    </div>
                </DialogPrimitive.Content>
            </DialogPortal>
        </Dialog>
    );
}