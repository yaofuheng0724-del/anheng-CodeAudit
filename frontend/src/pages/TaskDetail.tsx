/**
 * Task Detail Page
 * Matching Project Detail layout style
 */

import { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ArrowLeft,
  Search,
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  FileText,
  Calendar,
  GitBranch,
  Bug,
  Code,
  Lightbulb,
  Info,
  Zap,
  XCircle,
  Sparkles,
  Loader2,
  ChevronDown,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { api } from "@/shared/config/database";
import type { AuditTask, AuditIssue, AggregatedAuditIssue } from "@/shared/types";
import { ISSUE_STATUS_LABELS, ISSUE_STATUS_BADGE_CLASS, ISSUE_STATUS } from "@/shared/constants";
import { toast } from "sonner";
import { calculateTaskProgress, safeJsonParseArray } from "@/shared/utils/utils";
import IssueDetailSheet from "@/components/issues/IssueDetailSheet";
import { CodeAnalysisPanel } from "@/components/code-analysis/CodeAnalysisPanel";
import { APIAssetsList } from "@/components/code-analysis/APIAssetsList";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiClient } from "@/shared/api/serverClient";

// Issues Table Component
function IssuesTable({ issues, total, hasMore, onLoadMore, loadingMore, onStatusChange, onViewDetail, onAiInvestigate }: {
  issues: AuditIssue[];
  total: number;
  hasMore: boolean;
  onLoadMore: () => void;
  loadingMore: boolean;
  onStatusChange?: (issue: AuditIssue, newStatus: string) => void;
  onViewDetail?: (issue: AuditIssue) => void;
  onAiInvestigate?: (issue: AuditIssue) => void;
}) {
  const getSeverityBadge = (severity: string) => {
    const baseClass = "font-bold uppercase px-2 py-1 rounded text-xs inline-flex justify-center min-w-[56px] text-center";
    switch (severity) {
      case 'critical': return <Badge className={`severity-critical ${baseClass}`}>严重</Badge>;
      case 'high': return <Badge className={`severity-high ${baseClass}`}>高</Badge>;
      case 'medium': return <Badge className={`severity-medium ${baseClass}`}>中</Badge>;
      case 'low': return <Badge className={`severity-low ${baseClass}`}>低</Badge>;
      default: return <Badge className={`severity-info ${baseClass}`}>信息</Badge>;
    }
  };

  const getStatusLabel = (status: string) => ISSUE_STATUS_LABELS[status] || status;
  const getStatusBadgeClass = (status: string) => ISSUE_STATUS_BADGE_CLASS[status] || "bg-warning/15 text-warning dark:text-warning border-warning/25";

  const hasAiSuggestion = (issue: AuditIssue) => !!(issue as any).ai_suggestion;
  const isAiAnalyzing = (issue: AuditIssue) => {
    if (!(issue as any).ai_suggestion) return false;
    try { return JSON.parse((issue as any).ai_suggestion).verdict === "analyzing"; } catch { return false; }
  };

  if (issues.length === 0) {
    return (
      <div className="cyber-card p-0">
        <div className="p-12 text-center">
          <CheckCircle className="w-16 h-16 text-primary dark:text-emerald-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2 uppercase">未发现问题</h3>
          <p className="text-sm text-muted-foreground font-sans">代码质量检查通过，没有发现任何问题</p>
        </div>
      </div>
    );
  }

  return (
    <div className="cyber-card p-0">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th className="text-left py-2 px-6 font-medium">问题名称</th>
              <th className="text-left py-2 px-3 font-medium">严重程度</th>
              <th className="text-left py-2 px-3 font-medium">文件路径</th>
              <th className="text-left py-2 px-3 font-medium">状态</th>
              <th className="text-left py-2 px-3 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {issues.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-12 text-center text-muted-foreground">
                  无匹配问题
                </td>
              </tr>
            ) : (
              issues.map((issue, index) => (
                <tr key={issue.id || index} className="border-b border-border/50 hover:bg-muted/50 transition-colors">
                  <td className="py-2.5 px-6">
                    <span className="font-medium text-foreground">{issue.title}</span>
                  </td>
                  <td className="py-2.5 px-3">
                    {getSeverityBadge(issue.severity)}
                    {(issue as any).issue_type === "iac" && (
                      <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-violet-500/20 text-violet-300 border border-violet-500/40">
                        IaC
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 px-3">
                    <span className="text-muted-foreground text-xs bg-muted px-2 py-0.5 rounded border border-border">
                      {issue.file_path || "-"}
                      {issue.line_number && issue.line_number > 0 ? `:${issue.line_number}` : (() => {
                        const rid = (issue as { rule_id?: string }).rule_id || "";
                        if (rid.startsWith("compiled.binary.dangerous_func.")) return " [符号引用]";
                        if (rid.startsWith("compiled.binary.secret.") || rid.startsWith("compiled.apk.secret.")) return " [字符串匹配]";
                        if (rid.startsWith("compiled.apk.permission.")) return " [Manifest 权限]";
                        if (rid.startsWith("compiled.sca.")) return " [CVE]";
                        if (rid.startsWith("compiled.engine.")) return " [扫描引擎]";
                        return "";
                      })()}
                    </span>
                  </td>
                  <td className="py-2.5 px-3">
                    {onStatusChange ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm" className={`text-xs font-sans border w-[60px] h-[26px] justify-center ${getStatusBadgeClass(issue.status)}`}>
                            {getStatusLabel(issue.status)}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => onStatusChange(issue, ISSUE_STATUS.FIXED)}>已修复</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onStatusChange(issue, ISSUE_STATUS.NOT_FIXED)}>未修复</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onStatusChange(issue, ISSUE_STATUS.FALSE_POSITIVE)}>误报</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onStatusChange(issue, ISSUE_STATUS.SUSPICIOUS)}>存疑</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : (
                      <span className={`text-xs border px-2 py-1 rounded w-[52px] h-[22px] inline-flex justify-center items-center ${getStatusBadgeClass(issue.status)}`}>
                        {getStatusLabel(issue.status)}
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 flex items-center gap-1">
                    {/* AI排查按钮 */}
                    {onAiInvestigate && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className={`h-7 ${hasAiSuggestion(issue)
                          ? 'text-muted-foreground cursor-not-allowed'
                          : isAiAnalyzing(issue)
                            ? 'text-purple-500'
                            : 'hover:bg-purple-500/12 hover:text-purple-500'}`}
                        disabled={hasAiSuggestion(issue) && !isAiAnalyzing(issue)}
                        onClick={() => onAiInvestigate(issue)}
                      >
                        {isAiAnalyzing(issue) ? (
                          <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                        ) : hasAiSuggestion(issue) ? (
                          <CheckCircle className="w-3.5 h-3.5 mr-1" />
                        ) : (
                          <Sparkles className="w-3.5 h-3.5 mr-1" />
                        )}
                        {isAiAnalyzing(issue) ? '排查中' : hasAiSuggestion(issue) ? '已排查' : 'AI排查'}
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="hover:bg-primary/12 hover:text-primary h-7"
                      onClick={() => onViewDetail?.(issue)}
                    >
                      <FileText className="w-3.5 h-3.5 mr-1" />
                      查看详情
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {/* 分页加载更多 */}
      {hasMore && (
        <div className="flex items-center justify-center py-4 border-t border-border">
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-sm gap-1 border-border hover:bg-primary/10 hover:text-primary"
            onClick={onLoadMore}
            disabled={loadingMore}
          >
            {loadingMore ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
            {loadingMore ? '加载中...' : `加载更多 (还有 ${total - issues.length} 条)`}
          </Button>
        </div>
      )}
      {!hasMore && issues.length > 0 && (
        <div className="flex items-center justify-center py-3 border-t border-border">
          <span className="text-xs text-muted-foreground">已加载全部 {issues.length} 条问题</span>
        </div>
      )}
    </div>
  );
}

export default function TaskDetail() {
  const { id } = useParams<{ id: string }>();
  const [task, setTask] = useState<AuditTask | null>(null);
  const [issues, setIssues] = useState<AuditIssue[]>([]);
  const [totalIssues, setTotalIssues] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const PAGE_SIZE = 20;
    const [cancelling, setCancelling] = useState(false);
    const [nameFilter, setNameFilter] = useState("");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Issue detail Sheet
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedIssue, setSelectedIssue] = useState<AuditIssue | null>(null);

  // API 资产（与问题列表同一 Tab 区域展示）
  const [apiEndpoints, setApiEndpoints] = useState<unknown[]>([]);

  // 加载 API 资产（独立加载，不阻塞主流程）
  // IaC 任务无代码资产概念，跳过此请求
  useEffect(() => {
    if (!id || task?.task_type === 'iac_scan') return;
    // 只取 api_endpoints 这一节，不再下载整个 code_analysis_results（可达数百 MB）
    apiClient
      .get(`/tasks/${id}/code-analysis/api_endpoints`)
      .then((res) => {
        setApiEndpoints(Array.isArray(res.data) ? res.data : []);
      })
      .catch(() => setApiEndpoints([]));
  }, [id, task?.task_type]);

  const handleViewDetail = (issue: AuditIssue) => {
    setSelectedIssue(issue);
    setDetailOpen(true);
  };

  // Zombie task detection
  const [lastProgressTime, setLastProgressTime] = useState<number>(Date.now());
  const [lastProgress, setLastProgress] = useState<number>(0);
  const ZOMBIE_TIMEOUT = 180000;

  useEffect(() => {
    if (id) {
      loadTaskDetail();
    }
  }, [id]);

  // Silent progress update for running tasks
  useEffect(() => {
    if (!task || !id) {
      return;
    }

    if (task.status === 'running' || task.status === 'pending') {
      const intervalId = setInterval(async () => {
        try {
          const [taskData, issuesData] = await Promise.all([
            api.getAuditTaskById(id),
            api.getAuditIssues(id, { skip: 0, limit: issues.length > PAGE_SIZE ? issues.length : PAGE_SIZE })
          ]);

          if (!taskData) {
            console.error('任务数据获取失败');
            return;
          }

          const currentProgress = taskData.scanned_files || 0;
          if (currentProgress !== lastProgress) {
            setLastProgress(currentProgress);
            setLastProgressTime(Date.now());
          } else if (taskData.status === 'running' && Date.now() - lastProgressTime > ZOMBIE_TIMEOUT) {
            toast.warning("任务可能已停止响应，建议取消后重试", {
              id: 'zombie-warning',
              duration: 10000,
            });
          }

          if (
            taskData.status !== task.status ||
            taskData.scanned_files !== task.scanned_files ||
            taskData.issues_count !== task.issues_count
          ) {
            setTask(taskData);
            setIssues(issuesData.items || []);
            setTotalIssues(issuesData.total || 0);

            if (['completed', 'failed', 'cancelled'].includes(taskData.status)) {
              clearInterval(intervalId);
            }
          }
        } catch (error: unknown) {
          console.error('静默更新任务失败:', error);
          // 区分临时性错误 vs 严重错误，临时性错误不弹窗
          const isTransient = typeof error === 'object' && error !== null && 'isTransient' in error;
          if (!isTransient) {
            toast.error("获取任务状态失败，请检查网络连接", {
              id: 'network-error',
              duration: 5000,
            });
          }
          // 临时性错误静默重试，不中断轮询
        }
      }, 3000);

      return () => clearInterval(intervalId);
    }
  }, [task?.status, task?.scanned_files, id, lastProgress, lastProgressTime]);

  const handleCancelTask = async () => {
    if (!id || cancelling) return;

    try {
      setCancelling(true);
      await api.cancelAuditTask(id);
      toast.success("任务已取消");
      const taskData = await api.getAuditTaskById(id);
      if (taskData) {
        setTask(taskData);
      }
    } catch (error: any) {
      console.error('取消任务失败:', error);
      toast.error(error?.response?.data?.detail || "取消任务失败");
    } finally {
      setCancelling(false);
    }
  };

  const loadTaskDetail = async () => {
    if (!id) return;

    try {
      setLoading(true);
      const [taskData, issuesData] = await Promise.all([
        api.getAuditTaskById(id),
        api.getAuditIssues(id, { skip: 0, limit: PAGE_SIZE })
      ]);

      setTask(taskData);
      setIssues(issuesData.items || []);
      setTotalIssues(issuesData.total || 0);
    } catch (error) {
      console.error('Failed to load task detail:', error);
      toast.error("加载任务详情失败");
    } finally {
      setLoading(false);
    }
  };

  // 加载更多问题
  const loadMoreIssues = useCallback(async () => {
    if (!id || loadingMore) return;
    try {
      setLoadingMore(true);
      const issuesData = await api.getAuditIssues(id, { skip: issues.length, limit: PAGE_SIZE });
      setIssues(prev => [...prev, ...(issuesData.items || [])]);
      setTotalIssues(issuesData.total || 0);
    } catch (error) {
      console.error('Failed to load more issues:', error);
      toast.error("加载更多问题失败");
    } finally {
      setLoadingMore(false);
    }
  }, [id, issues.length, loadingMore]);

  const filteredIssues = issues.filter(i => {
    if (nameFilter && !i.title.toLowerCase().includes(nameFilter.toLowerCase())) return false;
    if (severityFilter !== "all" && i.severity !== severityFilter) return false;
    if (statusFilter !== "all" && (i.status || 'not_fixed') !== statusFilter) return false;
    return true;
  });

  const handleIssueStatusChange = async (issue: AuditIssue, newStatus: string) => {
    if (!id) return;
    try {
      await api.updateAuditIssue(id, issue.id, { status: newStatus } as any);
      toast.success("状态已更新");
      const issuesData = await api.getAuditIssues(id, { skip: 0, limit: issues.length > PAGE_SIZE ? issues.length : PAGE_SIZE });
      setIssues(issuesData.items || []);
      setTotalIssues(issuesData.total || 0);
    } catch (error) {
      console.error("Failed to update issue status:", error);
      toast.error("状态更新失败");
    }
  };

  const handleAiInvestigate = async (issue: AuditIssue) => {
    if (!id) return;
    try {
      await api.aiInvestigateIssue(id, issue.id);
      toast.success("AI排查已启动，请稍候刷新查看结果");
      // 5秒后自动刷新
      setTimeout(async () => {
        const issuesData = await api.getAuditIssues(id, { skip: 0, limit: issues.length > PAGE_SIZE ? issues.length : PAGE_SIZE });
        setIssues(issuesData.items || []);
        setTotalIssues(issuesData.total || 0);
      }, 5000);
    } catch (error: any) {
      console.error("AI排查启动失败:", error);
      toast.error(error?.response?.data?.detail || "AI排查启动失败");
    }
  };

  // 批量AI排查
  const [aiBatchInProgress, setAiBatchInProgress] = useState(false);
  const [aiBatchProgress, setAiBatchProgressData] = useState({ completed: 0, total: 0 });

  const handleBatchAiInvestigate = async () => {
    if (!id) return;
    try {
      const res = await api.aiInvestigateBatch(id);
      if (!res.batch_id || res.total === 0) {
        toast.info(res.message || "没有需要排查的问题");
        return;
      }
      setAiBatchInProgress(true);
      setAiBatchProgressData({ completed: 0, total: res.total });
      toast.success(`批量AI排查已启动，共 ${res.total} 个问题`);

      // 轮询进度
      const pollInterval = setInterval(async () => {
        try {
          const status = await api.getAiInvestigateBatchStatus(id, res.batch_id);
          setAiBatchProgressData({ completed: status.completed, total: status.total });
          if (status.status === "completed") {
            clearInterval(pollInterval);
            setAiBatchInProgress(false);
            toast.success("批量AI排查完成");
            const issuesData = await api.getAuditIssues(id, { skip: 0, limit: issues.length > PAGE_SIZE ? issues.length : PAGE_SIZE });
            setIssues(issuesData.items || []);
            setTotalIssues(issuesData.total || 0);
          }
        } catch {
          // 轮询失败，继续
        }
      }, 3000);

      // 60秒超时保护
      setTimeout(() => {
        clearInterval(pollInterval);
        if (aiBatchInProgress) {
          setAiBatchInProgress(false);
          // 最终刷新
          api.getAuditIssues(id, { skip: 0, limit: issues.length > PAGE_SIZE ? issues.length : PAGE_SIZE }).then(res => {
            setIssues(res.items || []);
            setTotalIssues(res.total || 0);
          });
        }
      }, 60000);
    } catch (error: any) {
      console.error("批量AI排查启动失败:", error);
      toast.error(error?.response?.data?.detail || "批量AI排查启动失败");
      setAiBatchInProgress(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="cyber-badge-success">完成</Badge>;
      case 'running':
        return <Badge className="cyber-badge-info">运行中</Badge>;
      case 'scheduled':
        return <Badge className="cyber-badge-warning">待扫描</Badge>;
      case 'failed':
        return <Badge className="cyber-badge-danger">失败</Badge>;
      case 'cancelled':
        return <Badge className="cyber-badge-muted">已取消</Badge>;
      default:
        return <Badge className="cyber-badge-muted">等待中</Badge>;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4">
          <div className="loading-spinner mx-auto" />
          <p className="text-muted-foreground font-sans text-sm uppercase tracking-wider">加载任务详情...</p>
        </div>
      </div>
    );
  }

  if (!task) {
    return (
      <div className="space-y-4 px-6 pt-1 pb-6 cyber-bg-elevated min-h-screen font-sans">
        <div className="flex items-center space-x-4">
          <Link to="/audit-tasks">
            <Button variant="outline" size="sm" className="cyber-btn-ghost h-10 w-10 p-0">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
        </div>
        <div className="cyber-card p-16 text-center">
          <AlertTriangle className="w-16 h-16 text-destructive mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-foreground uppercase mb-2">任务不存在</h3>
          <p className="text-muted-foreground font-sans">请检查任务ID是否正确</p>
        </div>
      </div>
    );
  }

  const scanConfig = (() => {
    try {
      return task?.scan_config ? JSON.parse(task.scan_config) : {};
    } catch {
      return {};
    }
  })();
  const isCompiledScan = task.project?.scan_mode
    ? task.project.scan_mode === "compiled"
    : (scanConfig as { scan_mode?: string }).scan_mode === "compiled";
  const isIacTask = task.task_type === 'iac_scan';

  return (
    <div className="space-y-4 px-6 pt-1 pb-6 cyber-bg-elevated min-h-screen font-sans relative">
      {/* Grid background */}
      <div className="absolute inset-0 cyber-grid-subtle pointer-events-none" />

      {/* 顶部操作栏 */}
      <div className="relative z-10 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link to="/audit-tasks">
            <Button variant="outline" size="sm" className="cyber-btn-ghost h-10 w-10 p-0 flex items-center justify-center">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <h1 className="text-2xl font-semibold text-foreground uppercase tracking-wider">
            {isIacTask
              ? 'IaC 扫描任务'
              : (task.task_type === 'repository' ? '仓库审计任务' : '即时分析任务')}
            {!isIacTask && (
              isCompiledScan ? (
                <span className="ml-2 rounded bg-purple-100 px-2 py-0.5 text-xs text-purple-700">
                  编译后扫描
                </span>
              ) : (
                <span className="ml-2 rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-700">
                  源代码扫描
                </span>
              )
            )}
          </h1>
        </div>

        <div className="flex items-center space-x-3">
          {(task.status === 'running' || task.status === 'pending') && (
            <Button
              size="sm"
              className="cyber-btn bg-destructive/90 border-destructive/40 text-foreground hover:bg-destructive h-10"
              onClick={handleCancelTask}
              disabled={cancelling}
            >
              <XCircle className="w-4 h-4 mr-2" />
              {cancelling ? '取消中...' : '取消任务'}
            </Button>
          )}

                  </div>
      </div>

      {/* 任务信息 */}
      <div className={`grid ${isIacTask ? 'grid-cols-1' : 'grid-cols-2'} gap-4 relative z-10`}>
        <div className="cyber-card p-4">
          <div className="space-y-3 font-sans">
            {task.project && (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground uppercase">项目名称</span>
                  <Link to={`/projects/${task.project.id}`} className="text-sm font-bold text-primary hover:underline">
                    {task.project.name}
                  </Link>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground uppercase">项目负责人</span>
                  <span className="text-sm text-foreground">{task.project.owner?.full_name || task.project.owner?.phone || '未知'}</span>
                </div>

                {task.project.programming_languages && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground uppercase">项目语言</span>
                    <div className="flex flex-wrap gap-2">
                      {safeJsonParseArray(task.project.programming_languages).map((lang: string) => (
                        <Badge key={lang} className="cyber-badge-primary">
                          {lang}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                <div className="border-t border-border" />
              </>
            )}

            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground uppercase">任务类型</span>
              <span className="text-sm font-bold text-foreground">
                {isIacTask
                  ? 'IaC 扫描任务'
                  : (task.task_type === 'repository' ? '仓库审计任务' : '即时分析任务')}
              </span>
            </div>

            {!isIacTask && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground uppercase">目标分支</span>
                <span className="text-sm text-foreground flex items-center">
                  <GitBranch className="w-3.5 h-3.5 mr-1" />
                  {task.branch_name || '默认分支'}
                </span>
              </div>
            )}

            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground uppercase">创建时间</span>
              <span className="text-sm text-foreground">{formatDate(task.created_at)}</span>
            </div>

            {task.completed_at && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground uppercase">完成时间</span>
                <span className="text-sm text-foreground">{formatDate(task.completed_at)}</span>
              </div>
            )}

            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground uppercase">文件数</span>
              <span className="text-sm text-foreground">{task.total_files ?? 0}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground uppercase">问题数</span>
              <span className={`text-sm font-bold ${task.issues_count > 0 ? 'text-warning' : 'text-foreground'}`}>{task.issues_count}</span>
            </div>

            {task.scan_config && (() => {
              let config: any = {};
              try { config = JSON.parse(task.scan_config); } catch {}
              const excludePatterns: string[] = Array.isArray(config.exclude_patterns) ? config.exclude_patterns : [];
              return excludePatterns.length > 0 && (
                <div>
                  <div className="flex items-start justify-between">
                    <span className="text-sm text-muted-foreground uppercase pt-0.5">白名单</span>
                    <div className="flex flex-wrap gap-2 justify-end max-w-[70%]">
                      {excludePatterns.map((pattern: string) => (
                        <Badge key={pattern} className="cyber-badge-muted">
                          {pattern}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })()}

            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground uppercase">任务状态</span>
              {getStatusBadge(task.status)}
            </div>

            <div className="border-t border-border" />
          </div>
        </div>
        {!isIacTask && <CodeAnalysisPanel taskId={id!} taskType="quick" hideApi />}
      </div>

      {/* 问题列表 / API 资产（Tab 切换） */}
      <div className="relative z-10">
        <Tabs defaultValue="issues" className="w-full">
          <TabsList className="mb-3">
            <TabsTrigger value="issues">
              问题列表
              <span className="ml-1 text-[11px] text-muted-foreground">({totalIssues})</span>
            </TabsTrigger>
            {!isIacTask && (
              <TabsTrigger value="api">
                API 接口资产
                <span className="ml-1 text-[11px] text-muted-foreground">({apiEndpoints.length})</span>
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="issues">
            <div className="flex items-center gap-3 p-4 border-b border-border flex-wrap">
              <div className="relative flex-1 min-w-[180px] max-w-[240px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <Input
                  value={nameFilter}
                  onChange={e => setNameFilter(e.target.value)}
                  placeholder="搜索问题名称"
                  className="h-8 text-sm !pl-9"
                />
              </div>
              <Select value={severityFilter} onValueChange={setSeverityFilter}>
                <SelectTrigger className="cyber-input h-8 w-[120px] text-sm">
                  <SelectValue placeholder="全部程度" />
                </SelectTrigger>
                <SelectContent className="cyber-dialog border-border">
                  <SelectItem value="all">全部程度</SelectItem>
                  <SelectItem value="critical">严重 ({issues.filter(i => i.severity === 'critical').length})</SelectItem>
                  <SelectItem value="high">高 ({issues.filter(i => i.severity === 'high').length})</SelectItem>
                  <SelectItem value="medium">中 ({issues.filter(i => i.severity === 'medium').length})</SelectItem>
                  <SelectItem value="low">低 ({issues.filter(i => i.severity === 'low').length})</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="cyber-input h-8 w-[120px] text-sm">
                  <SelectValue placeholder="全部状态" />
                </SelectTrigger>
                <SelectContent className="cyber-dialog border-border">
                  <SelectItem value="all">全部状态</SelectItem>
                  {Object.entries(
                    issues.reduce((acc: Record<string, number>, i) => {
                      const key = i.status || 'not_fixed';
                      acc[key] = (acc[key] || 0) + 1;
                      return acc;
                    }, {})
                  ).map(([key, count]) => (
                    <SelectItem key={key} value={key}>
                      {ISSUE_STATUS_LABELS[key] || key} ({count})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {/* 批量AI排查按钮（IaC 任务不参与 AI 排查） */}
              {!isIacTask && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-sm border-purple-500/30 hover:bg-purple-500/12 hover:text-purple-500 hover:border-purple-500/50"
                  disabled={aiBatchInProgress}
                  onClick={handleBatchAiInvestigate}
                >
                  <Sparkles className="w-3.5 h-3.5 mr-1" />
                  {aiBatchInProgress ? `排查中 (${aiBatchProgress.completed}/${aiBatchProgress.total})` : '批量AI排查'}
                </Button>
              )}
            </div>

            <IssuesTable
              issues={filteredIssues}
              total={totalIssues}
              hasMore={filteredIssues.length < totalIssues}
              onLoadMore={loadMoreIssues}
              loadingMore={loadingMore}
              onStatusChange={handleIssueStatusChange}
              onViewDetail={handleViewDetail}
              onAiInvestigate={isIacTask ? undefined : handleAiInvestigate}
            />
          </TabsContent>

          {!isIacTask && (
            <TabsContent value="api">
              <div className="cyber-card p-4">
                <APIAssetsList data={apiEndpoints} />
              </div>
            </TabsContent>
          )}
        </Tabs>
      </div>

      {/* Issue detail Sheet */}
      <IssueDetailSheet
        open={detailOpen}
        onOpenChange={setDetailOpen}
        auditIssue={selectedIssue as any}
      />

          </div>
  );
}