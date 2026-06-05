/**
 * Export Report Dialog — Redesigned
 * Left: Document cover preview mockup
 * Right: Report info cards + export action
 */

import { useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Download,
    Loader2,
    Shield,
    FolderOpen,
    User,
    FileText,
    Hash,
    AlertTriangle,
} from "lucide-react";
import type { AuditTask, AuditIssue } from "@/shared/types";
import { exportToPDF } from "@/features/reports/services/reportExport";
import { toast } from "sonner";

interface ExportReportDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    task: AuditTask;
    issues: AuditIssue[];
}

export default function ExportReportDialog({
    open,
    onOpenChange,
    task,
    issues,
}: ExportReportDialogProps) {
    const [isExporting, setIsExporting] = useState(false);

    const handleExport = async () => {
        setIsExporting(true);
        try {
            await exportToPDF(task, issues);
            toast.success("PDF 报告已导出");
            onOpenChange(false);
        } catch (error) {
            console.error("导出报告失败:", error);
            toast.error("导出报告失败，请重试");
        } finally {
            setIsExporting(false);
        }
    };

    const projectName = task.project?.name || "未知";
    const projectOwner = task.project?.owner?.full_name || task.project?.owner?.phone || "未知";
    const taskName = task.task_type === "repository" ? "仓库审计任务" : "即时分析任务";
    const fileCount = task.total_files ?? 0;
    const issueCount = issues.length;
    const today = new Date().toLocaleDateString("zh-CN", {
        year: "numeric",
        month: "long",
        day: "numeric",
    });

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[720px] cyber-dialog border-border p-0 overflow-hidden">
                {/* Header */}
                <div className="px-6 pt-5 pb-0">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-3 text-lg font-semibold uppercase tracking-wider text-foreground">
                            <Download className="w-5 h-5 text-primary" />
                            导出审计报告
                        </DialogTitle>
                    </DialogHeader>
                </div>

                {/* Body: two-column layout */}
                <div className="px-6 py-5 flex gap-6">
                    {/* ====== Left: Document Preview ====== */}
                    <div className="w-[220px] flex-shrink-0 flex flex-col items-center">
                        <div className="relative w-full bg-white dark:bg-zinc-900 rounded-lg shadow-lg border border-border/60 overflow-hidden"
                            style={{ aspectRatio: "210 / 297" }}
                        >
                            {/* PDF badge */}
                            <div className="absolute top-2.5 right-2.5 z-10">
                                <Badge className="bg-red-500 text-white text-[8px] px-1.5 py-0 border-0 font-bold shadow-sm">
                                    PDF
                                </Badge>
                            </div>

                            <div className="p-5 h-full flex flex-col">
                                {/* Top accent stripe */}
                                <div className="h-2 rounded-full bg-gradient-to-r from-primary to-violet-500 mb-5" />

                                {/* Logo + title */}
                                <div className="flex items-center gap-2 mb-2">
                                    <Shield className="w-6 h-6 text-primary" />
                                    <span className="text-[11px] font-extrabold text-foreground/90 uppercase tracking-[0.15em]">
                                        Audit Report
                                    </span>
                                </div>

                                <div className="h-px bg-border/60 mb-4" />

                                {/* Fields */}
                                <div className="space-y-3 flex-1">
                                    <div>
                                        <div className="text-[8px] text-muted-foreground uppercase tracking-wider font-semibold mb-0.5">
                                            项目名称
                                        </div>
                                        <div className="text-[11px] font-bold text-foreground leading-tight truncate">
                                            {projectName}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-[8px] text-muted-foreground uppercase tracking-wider font-semibold mb-0.5">
                                            项目负责人
                                        </div>
                                        <div className="text-[11px] font-semibold text-foreground leading-tight">
                                            {projectOwner}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-[8px] text-muted-foreground uppercase tracking-wider font-semibold mb-0.5">
                                            任务名称
                                        </div>
                                        <div className="text-[11px] font-semibold text-foreground leading-tight">
                                            {taskName}
                                        </div>
                                    </div>

                                    {/* Stats row */}
                                    <div className="flex gap-4 pt-1">
                                        <div>
                                            <div className="text-[8px] text-muted-foreground uppercase tracking-wider font-semibold">
                                                文件数
                                            </div>
                                            <div className="text-[13px] font-extrabold text-foreground">
                                                {fileCount}
                                            </div>
                                        </div>
                                        <div>
                                            <div className="text-[8px] text-muted-foreground uppercase tracking-wider font-semibold">
                                                问题数
                                            </div>
                                            <div className="text-[13px] font-extrabold text-amber-600">
                                                {issueCount}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Bottom date + divider */}
                                <div className="mt-auto pt-3 border-t border-border/40">
                                    <div className="text-[8px] text-muted-foreground">
                                        {today}
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="text-[10px] text-muted-foreground font-sans uppercase tracking-wider mt-2.5">
                            报告封面预览
                        </div>
                    </div>

                    {/* ====== Right: Info + Action ====== */}
                    <div className="flex-1 flex flex-col min-w-0">
                        {/* Info cards */}
                        <div className="space-y-2.5 flex-1">
                            {[
                                {
                                    icon: FolderOpen,
                                    label: "项目名称",
                                    value: projectName,
                                    color: "text-primary",
                                },
                                {
                                    icon: User,
                                    label: "项目负责人",
                                    value: projectOwner,
                                    color: "text-primary",
                                },
                                {
                                    icon: FileText,
                                    label: "任务名称",
                                    value: taskName,
                                    color: "text-primary",
                                },
                                {
                                    icon: Hash,
                                    label: "文件数",
                                    value: String(fileCount),
                                    color: "text-primary",
                                },
                                {
                                    icon: AlertTriangle,
                                    label: "问题数",
                                    value: String(issueCount),
                                    color: "text-amber-600",
                                },
                            ].map((item) => (
                                <div
                                    key={item.label}
                                    className="flex items-center gap-3 px-3.5 py-2.5 rounded-lg bg-muted/40 border border-border/50"
                                >
                                    <item.icon className={`w-4 h-4 ${item.color} flex-shrink-0`} />
                                    <span className="text-[11px] text-muted-foreground uppercase font-sans tracking-wider flex-shrink-0 w-16">
                                        {item.label}
                                    </span>
                                    <span className="text-sm font-bold text-foreground truncate">
                                        {item.value}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 pb-5">
                    <Button
                        onClick={handleExport}
                        disabled={isExporting}
                        className="cyber-btn-primary w-full h-11 text-sm font-bold uppercase tracking-wider"
                    >
                        {isExporting ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                正在生成报告...
                            </>
                        ) : (
                            <>
                                <Download className="w-4 h-4 mr-2" />
                                导出 PDF 报告
                            </>
                        )}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}