/**
 * Audit Tasks Page
 * Cyberpunk Terminal Aesthetic
 * 支持普通审计任务和深度审计任务
 */

import { useState, useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Search,
  Plus,
  XCircle,
  Eye,
  Bot,
  } from "lucide-react";
import { api } from "@/shared/config/database";
import { apiClient } from "@/shared/api/serverClient";
import type { AuditTask } from "@/shared/types";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import CreateTaskDialog from "@/components/audit/CreateTaskDialog";
import TerminalProgressDialog from "@/components/audit/TerminalProgressDialog";
import { calculateTaskProgress } from "@/shared/utils/utils";
import { getAgentTasks, cancelAgentTask, type AgentTask } from "@/shared/api/agentTasks";
import CreateAgentTaskDialog from "@/components/agent/CreateAgentTaskDialog";
import CreateIacTaskDialog from "@/components/audit/CreateIacTaskDialog";

// Zombie task detection config
const ZOMBIE_TIMEOUT = 180000; // 3 minutes without progress is potentially stuck

// 任务类型标签
type TaskTab = "regular" | "agent" | "iac";

export default function AuditTasks() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const activeTab: TaskTab = (() => {
    const t = searchParams.get("tab");
    if (t === "agent") return "agent";
    if (t === "iac") return "iac";
    return "regular";
  })();

  // 普通任务状态
  const [tasks, setTasks] = useState<AuditTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [cancellingTaskId, setCancellingTaskId] = useState<string | null>(null);
  const [showTerminal, setShowTerminal] = useState(false);
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);
  const [currentTaskType, setCurrentTaskType] = useState<"repository" | "zip">("repository");

  // Agent任务状态
  const [agentTasks, setAgentTasks] = useState<AgentTask[]>([]);
  const [agentLoading, setAgentLoading] = useState(true);
  const [cancellingAgentTaskId, setCancellingAgentTaskId] = useState<string | null>(null);
  const [showCreateAgentDialog, setShowCreateAgentDialog] = useState(false);
  const [iacDialogOpen, setIacDialogOpen] = useState(false);

  // Zombie task detection: track progress and time for each task
  const taskProgressRef = useRef<Map<string, { progress: number; time: number }>>(new Map());

  useEffect(() => {
    loadTasks();
    loadAgentTasks();
  }, []);

  // 加载Agent任务（支持静默更新，不触发 loading 状态）
  const loadAgentTasks = async (silent = false) => {
    try {
      if (!silent) {
        setAgentLoading(true);
      }
      const data = await getAgentTasks();
      setAgentTasks(data);
    } catch (error) {
      console.error('Failed to load agent tasks:', error);
      if (!silent) {
        toast.error("加载AI任务失败");
      }
    } finally {
      if (!silent) {
        setAgentLoading(false);
      }
    }
  };

  // Silently update active tasks progress (no loading state trigger)
  useEffect(() => {
    const activeTasks = tasks.filter(
      task => task.status === 'running' || task.status === 'pending' || task.status === 'scheduled'
    );

    if (activeTasks.length === 0) {
      taskProgressRef.current.clear();
      return;
    }

    const intervalId = setInterval(async () => {
      try {
        const updatedData = await api.getAuditTasks();

        setTasks(prevTasks => {
          return prevTasks.map(prevTask => {
            const updated = updatedData.find(t => t.id === prevTask.id);
            if (!updated) return prevTask;

            // Zombie task detection
            if (updated.status === 'running') {
              const currentProgress = updated.scanned_files || 0;
              const lastRecord = taskProgressRef.current.get(updated.id);

              if (lastRecord) {
                if (currentProgress !== lastRecord.progress) {
                  taskProgressRef.current.set(updated.id, { progress: currentProgress, time: Date.now() });
                } else if (Date.now() - lastRecord.time > ZOMBIE_TIMEOUT) {
                  toast.warning(`任务 "${updated.project?.name || '未知'}" 可能已停止响应`, {
                    id: `zombie-${updated.id}`,
                    duration: 10000,
                    action: {
                      label: '取消任务',
                      onClick: () => handleCancelTask(updated.id),
                    },
                  });
                  taskProgressRef.current.set(updated.id, { progress: currentProgress, time: Date.now() });
                }
              } else {
                taskProgressRef.current.set(updated.id, { progress: currentProgress, time: Date.now() });
              }
            } else {
              taskProgressRef.current.delete(updated.id);
            }

            if (
              updated.status !== prevTask.status ||
              updated.scanned_files !== prevTask.scanned_files ||
              updated.issues_count !== prevTask.issues_count
            ) {
              return updated;
            }
            return prevTask;
          });
        });
      } catch (error) {
        console.error('静默更新任务列表失败:', error);
        toast.error("获取任务状态失败，请检查网络连接", {
          id: 'network-error',
          duration: 5000,
        });
      }
    }, 3000);

    return () => clearInterval(intervalId);
  }, [tasks.map(t => t.id + t.status).join(',')]);

  // 自动刷新Agent任务（静默更新，不显示 loading）
  useEffect(() => {
    const activeAgentTasks = agentTasks.filter(
      task => task.status === 'running' || task.status === 'pending' || task.status === 'scheduled'
    );

    if (activeAgentTasks.length === 0) return;

    const intervalId = setInterval(() => loadAgentTasks(true), 5000);
    return () => clearInterval(intervalId);
  }, [agentTasks.map(t => t.id + t.status).join(',')]);

  const handleCancelTask = async (taskId: string) => {
    if (cancellingTaskId) return;

    try {
      setCancellingTaskId(taskId);
      await api.cancelAuditTask(taskId);
      toast.success("任务已取消");
      await loadTasks();
    } catch (error: any) {
      console.error('取消任务失败:', error);
      toast.error(error?.response?.data?.detail || "取消任务失败");
    } finally {
      setCancellingTaskId(null);
    }
  };

  const handleCancelAgentTask = async (taskId: string) => {
    if (cancellingAgentTaskId) return;

    try {
      setCancellingAgentTaskId(taskId);
      await cancelAgentTask(taskId);
      toast.success("AI任务已取消");
      // 取消后刷新列表，不使用静默模式以显示最新状态
      await loadAgentTasks(false);
    } catch (error: any) {
      console.error('取消AI任务失败:', error);
      toast.error(error?.response?.data?.detail || "取消AI任务失败");
    } finally {
      setCancellingAgentTaskId(null);
    }
  };


  const loadTasks = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const data = await api.getAuditTasks();
      setTasks(data);
    } catch (error) {
      console.error('Failed to load tasks:', error);
      if (!silent) toast.error("加载任务失败");
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const handleFastScanStarted = (taskId: string, taskType?: "repository" | "zip") => {
    setCurrentTaskId(taskId);
    setCurrentTaskType(taskType || "repository");
    setShowTerminal(true);
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

  const filteredTasks = tasks.filter(task => {
    // 排除 IaC 扫描任务（它们只属于 IaC tab）
    if ((task.task_type as string) === "iac_scan") return false;
    const matchesSearch = task.project?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      task.task_type.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || task.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const filteredAgentTasks = agentTasks.filter(task => {
    const matchesSearch = (task.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      task.task_type.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || task.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if ((activeTab === "regular" && loading) || (activeTab === "agent" && agentLoading) || (activeTab === "iac" && loading)) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4">
          <div className="loading-spinner mx-auto" />
          <p className="text-muted-foreground font-sans text-sm uppercase tracking-wider">加载任务数据...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 px-6 pt-1 pb-6 cyber-bg-elevated min-h-screen font-sans relative">
      {/* Grid background */}
      <div className="absolute inset-0 cyber-grid-subtle pointer-events-none" />

      {/* Agent Task List */}
      {activeTab === "agent" && (
        <div className="cyber-card p-0 relative z-10">
          <div className="p-4 flex items-center gap-3 border-b border-border flex-wrap">
            <div className="relative flex-1 min-w-[180px] max-w-[240px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <Input
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="搜索任务名称"
                className="h-8 text-sm !pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="cyber-input h-8 w-[120px] text-sm">
                <SelectValue placeholder="状态" />
              </SelectTrigger>
              <SelectContent className="cyber-dialog border-border">
                <SelectItem value="all">全部</SelectItem>
                <SelectItem value="scheduled">待扫描</SelectItem>
                <SelectItem value="running">运行中</SelectItem>
                <SelectItem value="completed">已完成</SelectItem>
                <SelectItem value="failed">失败</SelectItem>
              </SelectContent>
            </Select>
            <div className="ml-auto flex gap-2">
              <Button className="cyber-btn-primary h-8" onClick={() => setShowCreateAgentDialog(true)}>
                <Bot className="w-4 h-4 mr-2" />
                新建深度审计
              </Button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="text-left py-2 px-6 font-medium">任务名称</th>
                  <th className="text-left py-2 px-3 font-medium">扫描进度</th>
                  <th className="text-left py-2 px-3 font-medium">文件数</th>
                  <th className="text-left py-2 px-3 font-medium">问题数</th>
                  <th className="text-left py-2 px-3 font-medium">执行结果</th>
                  <th className="text-left py-2 px-3 font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {filteredAgentTasks.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-muted-foreground">
                      {searchTerm || statusFilter !== "all" ? '未找到匹配项' : '当前无深度审计任务'}
                    </td>
                  </tr>
                ) : (
                  filteredAgentTasks.map((task) => (
                    <tr key={task.id} className="border-b border-border/50 hover:bg-muted/50 transition-colors">
                      <td className="py-2.5 px-6">
                        <span className="font-medium text-foreground">{task.name || '深度审计任务'}</span>
                      </td>
                      <td className="py-2.5 px-3 text-muted-foreground">
                        {(task.progress_percentage || 0).toFixed(0)}%
                      </td>
                      <td className="py-2.5 px-3 text-muted-foreground">
                        {task.total_files} 文件
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="font-bold text-warning">{task.findings_count}</span>
                      </td>
                      <td className="py-2.5 px-3">
                        {getStatusBadge(task.status)}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-1">
                          <Link to={`/agent-audit/${task.id}`}>
                            <Button variant="ghost" size="icon" className="cyber-btn-ghost h-7 w-7" title="查看详情">
                              <Eye className="w-3.5 h-3.5" />
                            </Button>
                          </Link>
                          {(task.status === 'running' || task.status === 'pending' || task.status === 'scheduled') && (
                            <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-destructive/12 hover:text-destructive" title="取消任务" onClick={() => handleCancelAgentTask(task.id)} disabled={cancellingAgentTaskId === task.id}>
                              <XCircle className="w-3.5 h-3.5" />
                            </Button>
                          )}
                                                  </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Regular Task List */}
      {activeTab === "regular" && (
        <div className="cyber-card p-0 relative z-10">
          <div className="p-4 flex items-center gap-3 border-b border-border flex-wrap">
            <div className="relative flex-1 min-w-[180px] max-w-[240px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <Input
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="搜索任务名称"
                className="h-8 text-sm !pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="cyber-input h-8 w-[120px] text-sm">
                <SelectValue placeholder="状态" />
              </SelectTrigger>
              <SelectContent className="cyber-dialog border-border">
                <SelectItem value="all">全部</SelectItem>
                <SelectItem value="scheduled">待扫描</SelectItem>
                <SelectItem value="running">运行中</SelectItem>
                <SelectItem value="completed">已完成</SelectItem>
                <SelectItem value="failed">失败</SelectItem>
              </SelectContent>
            </Select>
            <div className="ml-auto flex gap-2">
              <Button className="cyber-btn-primary h-8" onClick={() => setShowCreateDialog(true)}>
                <Plus className="w-4 h-4 mr-2" />
                新建任务
              </Button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="text-left py-2 px-6 font-medium">任务名称</th>
                  <th className="text-left py-2 px-3 font-medium">扫描进度</th>
                  <th className="text-left py-2 px-3 font-medium">文件数</th>
                  <th className="text-left py-2 px-3 font-medium">问题数</th>
                  <th className="text-left py-2 px-3 font-medium">执行结果</th>
                  <th className="text-left py-2 px-3 font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {filteredTasks.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-muted-foreground">
                      {searchTerm || statusFilter !== "all" ? '未找到匹配项' : '当前无审计任务'}
                    </td>
                  </tr>
                ) : (
                  filteredTasks.map((task) => (
                    <tr key={task.id} className="border-b border-border/50 hover:bg-muted/50 transition-colors">
                      <td className="py-2.5 px-6">
                        <span className="font-medium text-foreground">{task.project?.name || '未知项目'}</span>
                      </td>
                      <td className="py-2.5 px-3 text-muted-foreground">
                        {calculateTaskProgress(task.scanned_files, task.total_files)}%
                      </td>
                      <td className="py-2.5 px-3 text-muted-foreground">
                        {task.total_files} 文件
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="font-bold text-warning">{task.issues_count}</span>
                      </td>
                      <td className="py-2.5 px-3">
                        {getStatusBadge(task.status)}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-1">
                          <Link to={`/tasks/${task.id}`}>
                            <Button variant="ghost" size="icon" className="cyber-btn-ghost h-7 w-7" title="查看详情">
                              <Eye className="w-3.5 h-3.5" />
                            </Button>
                          </Link>
                          {(task.status === 'running' || task.status === 'pending' || task.status === 'scheduled') && (
                            <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-destructive/12 hover:text-destructive" title="取消任务" onClick={() => handleCancelTask(task.id)} disabled={cancellingTaskId === task.id}>
                              <XCircle className="w-3.5 h-3.5" />
                            </Button>
                          )}
                                                  </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* IaC Task List */}
      {activeTab === "iac" && (
        <div className="cyber-card p-0 relative z-10">
          <div className="p-4 flex items-center gap-3 border-b border-border flex-wrap">
            <h2 className="text-sm font-semibold">IaC 扫描任务</h2>
            <div className="ml-auto flex gap-2">
              <Button className="cyber-btn-primary h-8" onClick={() => setIacDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                新建 IaC 扫描
              </Button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="text-left py-2 px-6 font-medium">项目</th>
                  <th className="text-left py-2 px-3 font-medium">分支</th>
                  <th className="text-left py-2 px-3 font-medium">状态</th>
                  <th className="text-left py-2 px-3 font-medium">问题数</th>
                  <th className="text-left py-2 px-3 font-medium">创建时间</th>
                  <th className="text-left py-2 px-3 font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {tasks.filter((t) => (t.task_type as string) === "iac_scan").length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-muted-foreground">
                      暂无 IaC 扫描任务
                    </td>
                  </tr>
                ) : (
                  tasks
                    .filter((t) => (t.task_type as string) === "iac_scan")
                    .map((t) => (
                      <tr key={t.id} className="border-b border-border/50 hover:bg-muted/50 transition-colors">
                        <td className="py-2.5 px-6">
                          <span className="font-medium text-foreground">{t.project?.name || '未知项目'}</span>
                        </td>
                        <td className="py-2.5 px-3 text-muted-foreground">{t.branch_name || "-"}</td>
                        <td className="py-2.5 px-3">{getStatusBadge(t.status)}</td>
                        <td className="py-2.5 px-3">
                          <span className="font-bold text-warning">{t.issues_count ?? 0}</span>
                        </td>
                        <td className="py-2.5 px-3 text-muted-foreground">{t.created_at}</td>
                        <td className="py-2.5 px-3">
                          <Link to={`/tasks/${t.id}`}>
                            <Button variant="ghost" size="icon" className="cyber-btn-ghost h-7 w-7" title="查看详情">
                              <Eye className="w-3.5 h-3.5" />
                            </Button>
                          </Link>
                        </td>
                      </tr>
                    ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Task Dialog */}
      <CreateTaskDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onTaskCreated={() => { loadTasks(true); loadAgentTasks(true); }}
        onFastScanStarted={handleFastScanStarted}
      />

      {/* Create Agent Task Dialog */}
      <CreateAgentTaskDialog
        open={showCreateAgentDialog}
        onOpenChange={setShowCreateAgentDialog}
      />

      {/* Create IaC Task Dialog */}
      <CreateIacTaskDialog
        open={iacDialogOpen}
        onOpenChange={setIacDialogOpen}
        onCreated={() => {
          // 静默刷新：避免触发全屏 loading；800ms 让 BackgroundTasks 翻转 task_type
          setTimeout(() => loadTasks(true), 800);
        }}
      />

      {/* Terminal Progress Dialog for Fast Scan */}
      <TerminalProgressDialog
        open={showTerminal}
        onOpenChange={setShowTerminal}
        taskId={currentTaskId}
        taskType={currentTaskType}
      />

    </div>
  );
}
