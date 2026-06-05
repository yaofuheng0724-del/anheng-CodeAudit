/**
 * Project Detail Page
 * Cyberpunk Terminal Aesthetic
 */

import { useMemo, useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  XCircle,
  Terminal
} from "lucide-react";
import { api } from "@/shared/config/database";
import type { Project, AuditTask, AuditIssue } from "@/shared/types";
import type { AgentFinding, AgentTask } from "@/shared/api/agentTasks";
import { getAgentTasks, updateAgentFinding, aiInvestigateFinding } from "@/shared/api/agentTasks";
import { apiClient } from "@/shared/api/serverClient";
import { toast } from "sonner";
import CreateTaskDialog from "@/components/audit/CreateTaskDialog";
import TerminalProgressDialog from "@/components/audit/TerminalProgressDialog";
import type { AggregatedAgentFinding, AggregatedAuditIssue, IssuesSummary, LatestProblem, UnifiedTask } from "@/shared/types";
import {
  PROJECT_DETAIL_ISSUES_FETCH_CONCURRENCY as ISSUES_FETCH_CONCURRENCY,
  PROJECT_DETAIL_ISSUES_MAX_TASKS as ISSUES_MAX_TASKS,
  PROJECT_DETAIL_REQUEST_TIMEOUT_MS as REQUEST_TIMEOUT_MS
} from "@/shared/constants";
import { ProjectIssuesTab } from "@/pages/project-detail/components/ProjectIssuesTab";
import { ProjectTasksTab } from "@/pages/project-detail/components/ProjectTasksTab";
import { safeJsonParseArray } from "@/shared/utils/utils";

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [auditTasks, setAuditTasks] = useState<AuditTask[]>([]);
  const [agentTasks, setAgentTasks] = useState<AgentTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateTaskDialog, setShowCreateTaskDialog] = useState(false);
  const [showTerminalDialog, setShowTerminalDialog] = useState(false);
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("tasks");
  const [latestIssues, setLatestIssues] = useState<AggregatedAuditIssue[]>([]);
  const [latestFindings, setLatestFindings] = useState<AggregatedAgentFinding[]>([]);
  const [loadingIssues, setLoadingIssues] = useState(false);
  const [issuesSummary, setIssuesSummary] = useState<IssuesSummary>({
    completedAuditTasksCount: 0,
    completedAgentTasksCount: 0,
    fetchedAuditTasksCount: 0,
    fetchedAgentTasksCount: 0,
    isLimited: false,
    maxTasks: 20
  });

  // ============ Helpers ============

  async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
    let timeoutId: number | undefined;
    const timeoutPromise = new Promise<T>((_resolve, reject) => {
      timeoutId = window.setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
    });
    try {
      return await Promise.race([promise, timeoutPromise]);
    } finally {
      if (timeoutId != null) window.clearTimeout(timeoutId);
    }
  }

  async function mapWithConcurrency<T, R>(
    items: T[],
    concurrency: number,
    mapper: (item: T) => Promise<R>
  ): Promise<PromiseSettledResult<R>[]> {
    const results: PromiseSettledResult<R>[] = new Array(items.length);
    let nextIndex = 0;

    async function worker(): Promise<void> {
      while (true) {
        const currentIndex = nextIndex++;
        if (currentIndex >= items.length) return;
        try {
          const value = await mapper(items[currentIndex]);
          results[currentIndex] = { status: "fulfilled", value };
        } catch (reason) {
          results[currentIndex] = { status: "rejected", reason };
        }
      }
    }

    const workers = Array.from({ length: Math.max(1, concurrency) }, () => worker());
    await Promise.all(workers);
    return results;
  }

  async function fetchAuditIssues(taskId: string): Promise<AuditIssue[]> {
    // Use apiClient directly so we can control timeout behavior at the call site
    // Backend returns {total, items, skip, limit} — extract items
    const res = await withTimeout(apiClient.get(`/tasks/${taskId}/issues`, { params: { skip: 0, limit: 200 } }), REQUEST_TIMEOUT_MS, `GET /tasks/${taskId}/issues`);
    const data = res.data;
    // Handle both old (array) and new (paginated object) response formats
    return Array.isArray(data) ? data : (data.items || []);
  }

  async function fetchAgentFindings(taskId: string): Promise<AgentFinding[]> {
    const res = await withTimeout(apiClient.get(`/agent-tasks/${taskId}/findings`), REQUEST_TIMEOUT_MS, `GET /agent-tasks/${taskId}/findings`);
    return res.data;
  }

  useEffect(() => {
    if (activeTab === 'issues' && (auditTasks.length > 0 || agentTasks.length > 0)) {
      loadLatestIssues();
    }
  }, [activeTab, auditTasks, agentTasks]);

  const loadLatestIssues = async () => {
    // 包含 completed 和 failed 的任务：failed 的任务也可能有有效问题
    const completedAuditTasks = auditTasks
      .filter((t: AuditTask) => t.status === 'completed' || t.status === 'failed')
      .sort((a: AuditTask, b: AuditTask) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    const completedAgentTasks = agentTasks
      .filter((t: AgentTask) => t.status === 'completed' || t.status === 'failed')
      .sort((a: AgentTask, b: AgentTask) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const limitedAuditTasks = completedAuditTasks.slice(0, ISSUES_MAX_TASKS);
    const limitedAgentTasks = completedAgentTasks.slice(0, ISSUES_MAX_TASKS);

    setIssuesSummary({
      completedAuditTasksCount: completedAuditTasks.length,
      completedAgentTasksCount: completedAgentTasks.length,
      fetchedAuditTasksCount: limitedAuditTasks.length,
      fetchedAgentTasksCount: limitedAgentTasks.length,
      isLimited: completedAuditTasks.length > ISSUES_MAX_TASKS || completedAgentTasks.length > ISSUES_MAX_TASKS,
      maxTasks: ISSUES_MAX_TASKS
    });

    if (limitedAuditTasks.length === 0 && limitedAgentTasks.length === 0) {
      setLatestIssues([]);
      setLatestFindings([]);
      return;
    }

      setLoadingIssues(true);
      try {
      const [issuesResults, findingsResults] = await Promise.all([
        mapWithConcurrency(limitedAuditTasks, ISSUES_FETCH_CONCURRENCY, async (task: AuditTask) => {
          const issues = await fetchAuditIssues(task.id);
          const enriched: AggregatedAuditIssue[] = (issues || []).map((issue) => ({
            ...(issue as AuditIssue),
            task_created_at: task.created_at,
            task_completed_at: task.completed_at
          }));
          return enriched;
        }),
        mapWithConcurrency(limitedAgentTasks, ISSUES_FETCH_CONCURRENCY, async (task: AgentTask) => {
          const findings = await fetchAgentFindings(task.id);
          const enriched: AggregatedAgentFinding[] = (findings || []).map((finding) => ({
            ...(finding as AgentFinding),
            task_created_at: task.created_at,
            task_completed_at: task.completed_at
          }));
          return enriched;
        })
      ]);

      const flatIssues = issuesResults
        .filter((r: PromiseSettledResult<AggregatedAuditIssue[]>): r is PromiseFulfilledResult<AggregatedAuditIssue[]> => r.status === 'fulfilled')
        .flatMap((r: PromiseFulfilledResult<AggregatedAuditIssue[]>) => r.value);
      const flatFindings = findingsResults
        .filter((r: PromiseSettledResult<AggregatedAgentFinding[]>): r is PromiseFulfilledResult<AggregatedAgentFinding[]> => r.status === 'fulfilled')
        .flatMap((r: PromiseFulfilledResult<AggregatedAgentFinding[]>) => r.value);

      const severityRank: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };
      flatIssues.sort((a: AggregatedAuditIssue, b: AggregatedAuditIssue) => {
        const createdAtA = new Date(a.created_at).getTime();
        const createdAtB = new Date(b.created_at).getTime();
        if (createdAtA !== createdAtB) return createdAtB - createdAtA;

        const severityA = severityRank[a.severity] ?? 0;
        const severityB = severityRank[b.severity] ?? 0;
        if (severityA !== severityB) return severityB - severityA;

        const taskCreatedAtA = a.task_created_at ? new Date(a.task_created_at).getTime() : 0;
        const taskCreatedAtB = b.task_created_at ? new Date(b.task_created_at).getTime() : 0;
        return taskCreatedAtB - taskCreatedAtA;
      });

      setLatestIssues(flatIssues);
      flatFindings.sort((a: AggregatedAgentFinding, b: AggregatedAgentFinding) => {
        const createdAtA = new Date(a.created_at).getTime();
        const createdAtB = new Date(b.created_at).getTime();
        if (createdAtA !== createdAtB) return createdAtB - createdAtA;

        const severityA = severityRank[String(a.severity || '').toLowerCase()] ?? 0;
        const severityB = severityRank[String(b.severity || '').toLowerCase()] ?? 0;
        if (severityA !== severityB) return severityB - severityA;

        const taskCreatedAtA = a.task_created_at ? new Date(a.task_created_at).getTime() : 0;
        const taskCreatedAtB = b.task_created_at ? new Date(b.task_created_at).getTime() : 0;
        return taskCreatedAtB - taskCreatedAtA;
      });
      setLatestFindings(flatFindings);
      } catch (error) {
        console.error('Failed to load issues:', error);
        toast.error("加载问题列表失败");
      } finally {
        setLoadingIssues(false);
      }
  };

  const latestProblems: LatestProblem[] = useMemo(() => {
    const parsePathLineFromTitle = (title: string) => {
      // Pattern examples:
      // "path/to/File.java:66 - Something"
      // "path/to/File.java:137-138 - Something"
      // Security hardening:
      // - Cap title length
      // - Restrict acceptable path characters
      // - Reject absolute paths and path traversal segments
      const safeTitle = String(title || "").slice(0, 500);
      const match = safeTitle.match(/^([A-Za-z0-9_.\-\/]+):(\d+)(?:-(\d+))?\s*-\s*(.+)$/);
      if (!match) return null;
      const [, rawPath, lineStartStr, lineEndStr, rest] = match;

      if (rawPath.startsWith("/") || rawPath.includes("..") || rawPath.includes("\u0000")) return null;

      const lineStart = Number(lineStartStr);
      const lineEnd = lineEndStr ? Number(lineEndStr) : null;
      const normalizedLineStart = Number.isFinite(lineStart) ? lineStart : NaN;
      const normalizedLineEnd = lineEnd != null && Number.isFinite(lineEnd) ? lineEnd : null;
      if (!Number.isFinite(normalizedLineStart) || normalizedLineStart <= 0) return null;
      return {
        file_path: rawPath,
        line_start: normalizedLineStart,
        line_end: normalizedLineEnd != null && normalizedLineEnd > 0 ? normalizedLineEnd : null,
        rest_title: rest,
      };
    };

    const normalizeSeverity = (s: unknown): LatestProblem['severity'] => {
      const v = String(s || '').toLowerCase();
      if (v === 'critical') return 'critical';
      if (v === 'high') return 'high';
      if (v === 'medium') return 'medium';
      return 'low';
    };

    const audit: LatestProblem[] = latestIssues.map((i) => ({
      // AuditIssue 在后端 schema 里可能叫 message（frontend type 没显式定义），这里做兼容兜底
      // 同时优先展示更"可读"的说明字段，避免 UI 出现大量 '-'
      kind: 'audit',
      id: i.id,
      task_id: i.task_id,
      task_created_at: i.task_created_at,
      created_at: i.created_at,
      severity: normalizeSeverity(i.severity),
      title: i.title || '(未命名问题)',
      description:
        i.description ??
        (i as any).message ??
        (i as any).ai_explanation ??
        (i as any).suggestion ??
        (i as any).code_snippet ??
        null,
      file_path: i.file_path,
      line_number: i.line_number ?? null,
      category: (i as any).issue_type ?? null,
      status: i.status ?? null,
      ai_suggestion: (i as any).ai_suggestion ?? null,
    }));

    const agent: LatestProblem[] = latestFindings.map((f) => {
      const rawTitle = f.title || '(未命名漏洞)';
      const parsed = (!f.file_path || f.file_path === '-') ? parsePathLineFromTitle(rawTitle) : null;

      return {
        kind: 'agent',
        id: f.id,
        task_id: f.task_id,
        task_created_at: f.task_created_at,
        created_at: f.created_at,
        severity: normalizeSeverity(f.severity),
        // 如果 title 里带了 "path:line - xxx"，则剥离掉路径前缀，仅保留 xxx，避免标题重复且过长
        title: parsed?.rest_title || rawTitle,
        description: f.description,
        // 如果后端没给 file_path，尽量从 title 解析出来填到"文件"列
        file_path: f.file_path ?? parsed?.file_path ?? null,
        line_number: ((f.line_start ?? parsed?.line_start ?? null) as any),
        line_end: ((f.line_end ?? parsed?.line_end ?? null) as any),
        category: (f as any).vulnerability_type ?? null,
        status: f.status ?? null,
        ai_suggestion: (f as any).ai_suggestion ?? null,
      };
    });

    const merged = [...audit, ...agent];
    // 按时间倒序（最新在前），时间相同再按严重程度
    const severityRank: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };
    merged.sort((a, b) => {
      const createdAtA = new Date(a.created_at).getTime();
      const createdAtB = new Date(b.created_at).getTime();
      if (createdAtA !== createdAtB) return createdAtB - createdAtA;

      const severityA = severityRank[a.severity] ?? 0;
      const severityB = severityRank[b.severity] ?? 0;
      if (severityA !== severityB) return severityB - severityA;

      const taskCreatedAtA = a.task_created_at ? new Date(a.task_created_at).getTime() : 0;
      const taskCreatedAtB = b.task_created_at ? new Date(b.task_created_at).getTime() : 0;
      return taskCreatedAtB - taskCreatedAtA;
    });
    return merged;
  }, [latestIssues, latestFindings]);

  const handleStatusChange = async (problem: LatestProblem, newStatus: string) => {
    try {
      if (problem.kind === "agent") {
        await updateAgentFinding(problem.task_id, problem.id, { status: newStatus });
      } else {
        await api.updateAuditIssue(problem.task_id, problem.id, { status: newStatus } as any);
      }
      toast.success("状态已更新");
      await loadLatestIssues();
    } catch (error) {
      console.error("Failed to update status:", error);
      toast.error("状态更新失败");
    }
  };

  // AI排查
  const handleAiInvestigate = async (problem: LatestProblem) => {
    try {
      if (problem.kind === "agent") {
        await aiInvestigateFinding(problem.task_id, problem.id);
      } else {
        await api.aiInvestigateIssue(problem.task_id, problem.id);
      }
      toast.success("AI排查已启动，请稍候刷新查看结果");
      // 5秒后自动刷新
      setTimeout(() => loadLatestIssues(), 5000);
    } catch (error: any) {
      console.error("AI排查启动失败:", error);
      toast.error(error?.response?.data?.detail || "AI排查启动失败");
    }
  };

  // 批量AI排查
  const [aiBatchInProgress, setAiBatchInProgress] = useState(false);
  const [aiBatchProgressData, setAiBatchProgress] = useState({ completed: 0, total: 0 });

  const handleBatchAiInvestigate = async () => {
    if (!id) return;
    try {
      const res = await api.aiInvestigateProjectBatch(id);
      if (!res.batch_id || res.total === 0) {
        toast.info(res.message || "没有需要排查的问题");
        return;
      }
      setAiBatchInProgress(true);
      setAiBatchProgress({ completed: 0, total: res.total });
      toast.success(`批量AI排查已启动，共 ${res.total} 个问题`);

      const pollInterval = setInterval(async () => {
        try {
          const status = await api.getAiInvestigateProjectBatchStatus(id, res.batch_id);
          setAiBatchProgress({ completed: status.completed, total: status.total });
          if (status.status === "completed") {
            clearInterval(pollInterval);
            setAiBatchInProgress(false);
            toast.success("批量AI排查完成");
            await loadLatestIssues();
          }
        } catch {
          // 轮询失败，继续
        }
      }, 3000);

      // 120秒超时保护
      setTimeout(() => {
        clearInterval(pollInterval);
        if (aiBatchInProgress) {
          setAiBatchInProgress(false);
          loadLatestIssues();
        }
      }, 120000);
    } catch (error: any) {
      console.error("批量AI排查启动失败:", error);
      toast.error(error?.response?.data?.detail || "批量AI排查启动失败");
      setAiBatchInProgress(false);
    }
  };

  useEffect(() => {
    if (id) {
      loadProjectData();
    }
  }, [id]);

  const loadProjectData = async () => {
    if (!id) return;

    try {
      setLoading(true);
      const [projectRes, auditTasksRes, agentTasksRes] = await Promise.allSettled([
        api.getProjectById(id),
        api.getAuditTasks(id),
        getAgentTasks({ project_id: id })
      ]);

      if (projectRes.status === 'fulfilled') {
        setProject(projectRes.value);
      } else {
        console.error('Failed to load project:', projectRes.reason);
        setProject(null);
      }

      if (auditTasksRes.status === 'fulfilled') {
        setAuditTasks(Array.isArray(auditTasksRes.value) ? auditTasksRes.value : []);
      } else {
        console.error('Failed to load audit tasks:', auditTasksRes.reason);
        setAuditTasks([]);
      }

      if (agentTasksRes.status === 'fulfilled') {
        setAgentTasks(Array.isArray(agentTasksRes.value) ? agentTasksRes.value : []);
      } else {
        // do not silently swallow: log for debugging and degrade gracefully
        console.warn('Failed to load agent tasks:', agentTasksRes.reason);
        setAgentTasks([]);
      }

    } catch (error) {
      console.error('Failed to load project data:', error);
      toast.error("加载项目数据失败");
    } finally {
      setLoading(false);
    }
  };

  const unifiedTasks: UnifiedTask[] = useMemo(() => {
    const merged: UnifiedTask[] = [
      ...auditTasks.map((t) => ({ kind: 'audit' as const, task: t })),
      ...agentTasks.map((t) => ({ kind: 'agent' as const, task: t })),
    ];
    merged.sort((a, b) => new Date((b.task as any).created_at).getTime() - new Date((a.task as any).created_at).getTime());
    return merged;
  }, [auditTasks, agentTasks]);

  const handleRunAudit = () => {
    setShowCreateTaskDialog(true);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="cyber-badge-success">完成</Badge>;
      case 'running':
        return <Badge className="cyber-badge-info">运行中</Badge>;
      case 'failed':
        return <Badge className="cyber-badge-danger">失败</Badge>;
      case 'cancelled':
        return <Badge className="cyber-badge-muted">已取消</Badge>;
      default:
        return <Badge className="cyber-badge-muted">等待中</Badge>;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="w-4 h-4 text-primary" />;
      case 'running': return <Activity className="w-4 h-4 text-secondary" />;
      case 'failed': return <AlertTriangle className="w-4 h-4 text-destructive" />;
      case 'cancelled': return <XCircle className="w-4 h-4 text-muted-foreground" />;
      default: return <Clock className="w-4 h-4 text-muted-foreground" />;
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

  const handleCreateTask = () => {
    setShowCreateTaskDialog(true);
  };

  const handleTaskCreated = () => {
    toast.success("审计任务已创建", {
      description: '因为网络和代码文件大小等因素，审计时长通常至少需要1分钟，请耐心等待...',
      duration: 5000
    });
    loadProjectData();
  };

  const handleFastScanStarted = (taskId: string) => {
    setCurrentTaskId(taskId);
    setShowTerminalDialog(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4">
          <div className="loading-spinner mx-auto" />
          <p className="text-muted-foreground font-sans text-sm uppercase tracking-wider">加载项目数据...</p>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="cyber-card p-8 text-center">
          <AlertTriangle className="w-16 h-16 text-destructive mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-foreground mb-2 uppercase">项目未找到</h2>
          <p className="text-muted-foreground mb-4 font-sans">请检查项目ID是否正确</p>
          <Link to="/projects">
            <Button className="cyber-btn-primary">
              <ArrowLeft className="w-4 h-4 mr-2" />
              返回项目列表
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 px-6 pt-1 pb-6 cyber-bg-elevated min-h-screen font-sans relative">
      {/* Grid background */}
      <div className="absolute inset-0 cyber-grid-subtle pointer-events-none" />

      {/* 顶部操作栏 */}
      <div className="relative z-10 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link to="/projects">
            <Button variant="outline" size="sm" className="cyber-btn-ghost h-10 w-10 p-0 flex items-center justify-center">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold text-foreground uppercase tracking-wider">{project.name}</h1>
        </div>

              </div>

      {/* 项目信息 */}
      <div className="cyber-card p-4 relative z-10">
        <div className="space-y-3 font-sans">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground uppercase">项目描述</span>
            <span className="text-sm text-foreground">{project.description || '暂无描述'}</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground uppercase">创建时间</span>
            <span className="text-sm text-foreground">{formatDate(project.created_at)}</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground uppercase">项目负责人</span>
            <span className="text-sm text-foreground">{project.owner?.full_name || project.owner?.phone || '未知'}</span>
          </div>

          {project.programming_languages && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground uppercase">项目语言</span>
              <div className="flex flex-wrap gap-2">
                {safeJsonParseArray(project.programming_languages).map((lang: string) => (
                  <Badge key={lang} className="cyber-badge-primary">
                    {lang}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 主要内容 */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full relative z-10 gap-0">
        <TabsList className="grid w-full grid-cols-2 bg-muted border border-border p-1 h-auto gap-1 rounded">
          <TabsTrigger value="tasks" className="data-[state=active]:bg-primary data-[state=active]:text-foreground font-sans font-medium uppercase py-2 text-muted-foreground transition-all rounded-sm">任务列表</TabsTrigger>
          <TabsTrigger value="issues" className="data-[state=active]:bg-primary data-[state=active]:text-foreground font-sans font-medium uppercase py-2 text-muted-foreground transition-all rounded-sm">问题列表</TabsTrigger>
        </TabsList>

        <TabsContent value="tasks" className="flex flex-col gap-4 mt-2">
          <ProjectTasksTab
            unifiedTasks={unifiedTasks}
            onCreateTask={handleCreateTask}
            formatDate={formatDate}
            renderStatusBadge={getStatusBadge}
            renderStatusIcon={getStatusIcon}
          />
        </TabsContent>

        <TabsContent value="issues" className="flex flex-col gap-4 mt-2">
          <ProjectIssuesTab
            hasAnyTasks={auditTasks.length > 0 || agentTasks.length > 0}
            issuesSummary={issuesSummary}
            loading={loadingIssues}
            latestProblems={latestProblems}
            latestIssues={latestIssues}
            latestFindings={latestFindings}
            formatDate={formatDate}
            onStatusChange={handleStatusChange}
            onAiInvestigate={handleAiInvestigate}
            onBatchAiInvestigate={handleBatchAiInvestigate}
            aiBatchProgress={{ completed: aiBatchProgressData.completed, total: aiBatchProgressData.total, inProgress: aiBatchInProgress }}
          />
        </TabsContent>

        </Tabs>

      {/* 创建任务对话框 */}
      <CreateTaskDialog
        open={showCreateTaskDialog}
        onOpenChange={setShowCreateTaskDialog}
        onTaskCreated={handleTaskCreated}
        onFastScanStarted={handleFastScanStarted}
        preselectedProjectId={id}
      />

      {/* 终端进度对话框 */}
      <TerminalProgressDialog
        open={showTerminalDialog}
        onOpenChange={setShowTerminalDialog}
        taskId={currentTaskId}
        taskType="repository"
      />
    </div>
  );
}
