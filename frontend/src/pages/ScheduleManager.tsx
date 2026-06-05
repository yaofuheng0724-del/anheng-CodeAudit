import { useEffect, useState } from "react";
import { CalendarClock, Edit, Eye, Plus, Search, Terminal, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { apiClient } from "@/shared/api/serverClient";
import type { Project } from "@/shared/types";

type ScheduledScan = {
  id: string;
  project_id: string;
  name: string;
  scan_mode?: "fast" | "agent";
  branch_name?: string;
  interval_minutes: number;
  time_window_start?: string;
  time_window_end?: string;
  timezone?: string;
  exclude_patterns: string[];
  file_paths: string[];
  is_active: boolean;
  next_run_at?: string;
  last_run_at?: string;
};

function formatDate(value?: string) {
  if (!value) return "-";
  return new Date(value).toLocaleString("zh-CN");
}

function parseCommaList(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function ScheduleManager() {
  const [loadingSchedules, setLoadingSchedules] = useState(false);
  const [createSheetOpen, setCreateSheetOpen] = useState(false);
  const [viewSheetOpen, setViewSheetOpen] = useState(false);
  const [editSheetOpen, setEditSheetOpen] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState<ScheduledScan | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [schedules, setSchedules] = useState<ScheduledScan[]>([]);

  const [filterName, setFilterName] = useState("");
  const [filterProject, setFilterProject] = useState("");
  const [filterMode, setFilterMode] = useState("all");

  const [createForm, setCreateForm] = useState({
    project_id: "",
    name: "",
    scan_mode: "fast",
    branch_name: "main",
    interval_minutes: "60",
    time_window_start: "",
    time_window_end: "",
    timezone: "Asia/Shanghai",
    file_paths: "",
    exclude_patterns: "",
  });

  const [editForm, setEditForm] = useState({
    project_id: "",
    name: "",
    scan_mode: "fast" as "fast" | "agent",
    branch_name: "main",
    interval_minutes: "60",
    time_window_start: "",
    time_window_end: "",
    timezone: "Asia/Shanghai",
    file_paths: "",
    exclude_patterns: "",
    is_active: true,
  });

  const loadProjects = async () => {
    try {
      const response = await apiClient.get<Project[]>("/projects/");
      setProjects(response.data);
    } catch (error) {
      console.error("加载项目列表失败", error);
    }
  };

  const loadSchedules = async () => {
    setLoadingSchedules(true);
    try {
      const response = await apiClient.get<ScheduledScan[]>("/schedules");
      setSchedules(response.data);
      if (!createForm.project_id && response.data.length === 0 && projects.length > 0) {
        setCreateForm((prev) => ({ ...prev, project_id: projects[0].id }));
      }
    } catch (error) {
      console.error("加载计划任务失败", error);
      toast.error("加载计划任务失败");
    } finally {
      setLoadingSchedules(false);
    }
  };

  useEffect(() => {
    void loadProjects();
    void loadSchedules();
  }, []);

  useEffect(() => {
    if (!createForm.project_id && projects.length > 0) {
      setCreateForm((prev) => ({ ...prev, project_id: projects[0].id }));
    }
  }, [projects, createForm.project_id]);

  const openViewSheet = (item: ScheduledScan) => {
    setSelectedSchedule(item);
    setViewSheetOpen(true);
  };

  const openEditSheet = (item: ScheduledScan) => {
    setSelectedSchedule(item);
    setEditForm({
      project_id: item.project_id,
      name: item.name,
      scan_mode: item.scan_mode || "fast",
      branch_name: item.branch_name || "main",
      interval_minutes: String(item.interval_minutes),
      time_window_start: item.time_window_start || "",
      time_window_end: item.time_window_end || "",
      timezone: item.timezone || "Asia/Shanghai",
      file_paths: (item.file_paths || []).join(", "),
      exclude_patterns: (item.exclude_patterns || []).join(", "),
      is_active: item.is_active,
    });
    setEditSheetOpen(true);
  };

  const handleCreateSchedule = async () => {
    if (!createForm.project_id || !createForm.name) {
      toast.error("请填写任务名称并选择项目");
      return;
    }
    try {
      // 将空字符串或默认 "00:00"/"23:59" 转为 null（表示"无时间窗口限制"）
      const normalizeTimeWindow = (value: string | undefined | null): string | null => {
        if (!value) return null;
        // "00:00" + "23:59" 组合表示用户未自定义，等同于"不限"
        return value || null;
      };
      const twStart = normalizeTimeWindow(createForm.time_window_start);
      const twEnd = normalizeTimeWindow(createForm.time_window_end);
      // 如果只设了开始没设结束，或反过来，都视为无效，两端都传 null
      const finalStart = (twStart && twEnd) ? twStart : null;
      const finalEnd = (twStart && twEnd) ? twEnd : null;

      await apiClient.post("/schedules", {
        project_id: createForm.project_id,
        name: createForm.name,
        scan_mode: createForm.scan_mode,
        branch_name: createForm.branch_name || null,
        interval_minutes: Number(createForm.interval_minutes || 60),
        time_window_start: finalStart,
        time_window_end: finalEnd,
        timezone: createForm.timezone || "Asia/Shanghai",
        file_paths: parseCommaList(createForm.file_paths),
        exclude_patterns: parseCommaList(createForm.exclude_patterns),
        is_active: true,
      });
      toast.success("计划任务已创建");
      setCreateForm((prev) => ({
        ...prev,
        name: "",
        scan_mode: "fast",
        branch_name: "main",
        interval_minutes: "60",
        time_window_start: "",
        time_window_end: "",
        timezone: "Asia/Shanghai",
        file_paths: "",
        exclude_patterns: "",
      }));
      setCreateSheetOpen(false);
      await loadSchedules();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "创建计划任务失败");
    }
  };

  const handleUpdateSchedule = async () => {
    if (!selectedSchedule) return;
    if (!editForm.project_id || !editForm.name) {
      toast.error("请填写任务名称并选择项目");
      return;
    }
    try {
      // 将空字符串转为 null（表示"无时间窗口限制"）
      const normalizeTimeWindow = (value: string | undefined | null): string | null => {
        if (!value) return null;
        return value || null;
      };
      const twStart = normalizeTimeWindow(editForm.time_window_start);
      const twEnd = normalizeTimeWindow(editForm.time_window_end);
      // 如果只设了开始没设结束，或反过来，都视为无效，两端都传 null
      const finalStart = (twStart && twEnd) ? twStart : null;
      const finalEnd = (twStart && twEnd) ? twEnd : null;

      await apiClient.put(`/schedules/${selectedSchedule.id}`, {
        project_id: editForm.project_id,
        name: editForm.name,
        scan_mode: editForm.scan_mode,
        branch_name: editForm.branch_name || null,
        interval_minutes: Number(editForm.interval_minutes || 60),
        time_window_start: finalStart,
        time_window_end: finalEnd,
        timezone: editForm.timezone || "Asia/Shanghai",
        file_paths: parseCommaList(editForm.file_paths),
        exclude_patterns: parseCommaList(editForm.exclude_patterns),
        is_active: editForm.is_active,
      });
      toast.success("计划任务已更新");
      setEditSheetOpen(false);
      await loadSchedules();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "更新计划任务失败");
    }
  };

  const handleToggleSchedule = async (target: ScheduledScan) => {
    try {
      await apiClient.put(`/schedules/${target.id}`, { is_active: !target.is_active });
      toast.success(`计划已${target.is_active ? "停用" : "启用"}`);
      await loadSchedules();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "更新计划失败");
    }
  };

  const handleDeleteSchedule = async (target: ScheduledScan) => {
    try {
      await apiClient.delete(`/schedules/${target.id}`);
      toast.success("计划已删除");
      await loadSchedules();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "删除计划失败");
    }
  };

  const getProjectName = (projectId: string) =>
    projects.find((p) => p.id === projectId)?.name || projectId;

  const filteredSchedules = schedules.filter((item) => {
    if (filterName && !item.name.toLowerCase().includes(filterName.toLowerCase())) return false;
    if (filterProject && !getProjectName(item.project_id).toLowerCase().includes(filterProject.toLowerCase())) return false;
    if (filterMode !== "all" && item.scan_mode !== filterMode) return false;
    return true;
  });

  if (loadingSchedules && schedules.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen cyber-bg-elevated">
        <div className="text-center space-y-4">
          <div className="loading-spinner mx-auto" />
          <p className="text-muted-foreground font-sans text-sm uppercase tracking-wider">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 px-6 pt-1 pb-6 cyber-bg-elevated min-h-screen font-sans relative">
      <div className="absolute inset-0 cyber-grid-subtle pointer-events-none" />

      <div className="relative z-10">
        <div className="cyber-card p-0">
          {/* Toolbar: filters + actions */}
          <div className="p-4 flex items-center gap-3 border-b border-border flex-wrap">
            <div className="relative flex-1 min-w-[180px] max-w-[240px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <Input
                value={filterName}
                onChange={(e) => setFilterName(e.target.value)}
                placeholder="搜索任务名称"
                className="h-8 text-sm !pl-9"
              />
            </div>
            <div className="relative flex-1 min-w-[180px] max-w-[240px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <Input
                value={filterProject}
                onChange={(e) => setFilterProject(e.target.value)}
                placeholder="搜索项目名称"
                className="h-8 text-sm !pl-9"
              />
            </div>
            <Select value={filterMode} onValueChange={setFilterMode}>
              <SelectTrigger className="cyber-input h-8 w-[140px] text-sm">
                <SelectValue placeholder="扫描方式" />
              </SelectTrigger>
              <SelectContent className="cyber-dialog border-border">
                <SelectItem value="all">全部方式</SelectItem>
                <SelectItem value="fast">快速审计</SelectItem>
                <SelectItem value="agent">深度审计</SelectItem>
              </SelectContent>
            </Select>
            <div className="ml-auto flex gap-2">
              <Button className="cyber-btn-primary h-8" onClick={() => setCreateSheetOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                新建计划任务
              </Button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="text-left py-2 px-6 font-medium">任务名称</th>
                  <th className="text-left py-2 px-3 font-medium">项目名称</th>
                  <th className="text-left py-2 px-3 font-medium">扫描方式</th>
                  <th className="text-left py-2 px-3 font-medium">执行时间</th>
                  <th className="text-left py-2 px-3 font-medium">状态</th>
                  <th className="text-left py-2 px-3 font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {filteredSchedules.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-muted-foreground">
                      {loadingSchedules ? "加载中..." : "暂无计划任务"}
                    </td>
                  </tr>
                ) : (
                  filteredSchedules.map((item) => (
                    <tr key={item.id} className="border-b border-border/50 hover:bg-muted/50 transition-colors">
                      <td className="py-2.5 px-6">
                        <span className="font-medium text-foreground">{item.name}</span>
                      </td>
                      <td className="py-2.5 px-3 text-muted-foreground">{getProjectName(item.project_id)}</td>
                      <td className="py-2.5 px-3 text-muted-foreground">
                        {item.scan_mode === "agent" ? "深度审计" : "快速审计"}
                      </td>
                      <td className="py-2.5 px-3 text-muted-foreground">{formatDate(item.next_run_at)}</td>
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={item.is_active}
                            onCheckedChange={() => void handleToggleSchedule(item)}
                            className="h-5 w-9 data-[state=checked]:bg-violet-300 data-[state=unchecked]:bg-muted [&>[data-slot=switch-thumb]]:w-4 [&>[data-slot=switch-thumb]]:h-4 [&>[data-slot=switch-thumb]]:data-[state=checked]:translate-x-4 [&>[data-slot=switch-thumb]]:data-[state=unchecked]:translate-x-0.5"
                          />
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openViewSheet(item)} className="h-7 w-7 hover:bg-primary/12 hover:text-primary">
                            <Eye className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => openEditSheet(item)} className="h-7 w-7 hover:bg-primary/12 hover:text-primary">
                            <Edit className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => void handleDeleteSchedule(item)} className="h-7 w-7 hover:bg-destructive/12 hover:text-destructive">
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* View Schedule Sheet */}
      <Sheet open={viewSheetOpen} onOpenChange={setViewSheetOpen}>
        <SheetContent side="right" className="!w-[min(90vw,500px)] sm:max-w-[500px] !sm:max-w-none flex flex-col p-0 gap-0 border-border overflow-y-auto">
          <SheetHeader className="px-6 py-4 border-b border-border flex-shrink-0 bg-muted">
            <SheetTitle className="flex items-center gap-3 font-sans text-foreground">
              <div className="p-2 bg-primary/20 rounded border border-primary/30">
                <Eye className="w-5 h-5 text-primary" />
              </div>
              <span className="text-lg font-semibold uppercase tracking-wider">查看计划任务</span>
            </SheetTitle>
          </SheetHeader>

          {selectedSchedule && (
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground uppercase">任务名称</Label>
                <p className="text-sm text-foreground">{selectedSchedule.name}</p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground uppercase">项目</Label>
                <p className="text-sm text-foreground">{getProjectName(selectedSchedule.project_id)}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground uppercase">扫描方式</Label>
                  <p className="text-sm text-foreground">{selectedSchedule.scan_mode === "agent" ? "深度审计" : "快速审计"}</p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground uppercase">分支</Label>
                  <p className="text-sm text-foreground">{selectedSchedule.branch_name || "-"}</p>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground uppercase">扫描周期</Label>
                <p className="text-sm text-foreground">{selectedSchedule.interval_minutes} 分钟</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground uppercase">允许开始时间</Label>
                  <p className="text-sm text-foreground">{selectedSchedule.time_window_start || "-"}</p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground uppercase">允许结束时间</Label>
                  <p className="text-sm text-foreground">{selectedSchedule.time_window_end || "-"}</p>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground uppercase">时区</Label>
                <p className="text-sm text-foreground">{selectedSchedule.timezone || "-"}</p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground uppercase">限定文件</Label>
                <p className="text-sm text-foreground">{selectedSchedule.file_paths?.length > 0 ? selectedSchedule.file_paths.join(", ") : "-"}</p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground uppercase">排除模式</Label>
                <p className="text-sm text-foreground">{selectedSchedule.exclude_patterns?.length > 0 ? selectedSchedule.exclude_patterns.join(", ") : "-"}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground uppercase">状态</Label>
                  <p className="text-sm text-foreground">{selectedSchedule.is_active ? "启用" : "停用"}</p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground uppercase">下次执行</Label>
                  <p className="text-sm text-foreground">{formatDate(selectedSchedule.next_run_at)}</p>
                </div>
              </div>
              {selectedSchedule.last_run_at && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground uppercase">上次执行</Label>
                  <p className="text-sm text-foreground">{formatDate(selectedSchedule.last_run_at)}</p>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Edit Schedule Sheet */}
      <Sheet open={editSheetOpen} onOpenChange={setEditSheetOpen}>
        <SheetContent side="right" className="!w-[min(90vw,500px)] sm:max-w-[500px] !sm:max-w-none flex flex-col p-0 gap-0 border-border overflow-y-auto">
          <SheetHeader className="px-6 py-4 border-b border-border flex-shrink-0 bg-muted">
            <SheetTitle className="flex items-center gap-3 font-sans text-foreground">
              <div className="p-2 bg-primary/20 rounded border border-primary/30">
                <Edit className="w-5 h-5 text-primary" />
              </div>
              <span className="text-lg font-semibold uppercase tracking-wider">编辑计划任务</span>
            </SheetTitle>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground uppercase">项目 *</Label>
              <Select value={editForm.project_id} onValueChange={(value) => setEditForm((prev) => ({ ...prev, project_id: value }))}>
                <SelectTrigger className="cyber-input">
                  <SelectValue placeholder="选择项目" />
                </SelectTrigger>
                <SelectContent className="cyber-dialog border-border">
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground uppercase">任务名称 *</Label>
              <Input value={editForm.name} onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))} className="cyber-input" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground uppercase">扫描方式</Label>
                <Select value={editForm.scan_mode} onValueChange={(value) => setEditForm((prev) => ({ ...prev, scan_mode: value as "fast" | "agent" }))}>
                  <SelectTrigger className="cyber-input">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="cyber-dialog border-border">
                    <SelectItem value="fast">快速审计</SelectItem>
                    <SelectItem value="agent">深度审计</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground uppercase">分支</Label>
                <Input value={editForm.branch_name} onChange={(e) => setEditForm((prev) => ({ ...prev, branch_name: e.target.value }))} className="cyber-input" />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground uppercase">扫描周期（分钟）</Label>
              <Input type="number" min="1" value={editForm.interval_minutes} onChange={(e) => setEditForm((prev) => ({ ...prev, interval_minutes: e.target.value }))} className="cyber-input" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground uppercase">允许开始时间</Label>
                <Input type="time" value={editForm.time_window_start} onChange={(e) => setEditForm((prev) => ({ ...prev, time_window_start: e.target.value }))} className="cyber-input" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground uppercase">允许结束时间</Label>
                <Input type="time" value={editForm.time_window_end} onChange={(e) => setEditForm((prev) => ({ ...prev, time_window_end: e.target.value }))} className="cyber-input" />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground uppercase">时区</Label>
              <Input value={editForm.timezone} onChange={(e) => setEditForm((prev) => ({ ...prev, timezone: e.target.value }))} className="cyber-input" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground uppercase">限定文件（逗号分隔）</Label>
              <Input value={editForm.file_paths} onChange={(e) => setEditForm((prev) => ({ ...prev, file_paths: e.target.value }))} className="cyber-input" placeholder="cmd/main.go,src/App.tsx" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground uppercase">排除模式（逗号分隔）</Label>
              <Input value={editForm.exclude_patterns} onChange={(e) => setEditForm((prev) => ({ ...prev, exclude_patterns: e.target.value }))} className="cyber-input" placeholder="node_modules/**,dist/**" />
            </div>
            <div className="h-10 px-3 border border-border rounded-md flex items-center justify-between bg-background">
              <span className="text-sm text-muted-foreground">启用状态</span>
              <Switch checked={editForm.is_active} onCheckedChange={(checked) => setEditForm((prev) => ({ ...prev, is_active: checked }))} />
            </div>
          </div>

          <div className="flex-shrink-0 flex justify-end gap-3 px-6 py-4 bg-muted border-t border-border">
            <Button variant="outline" onClick={() => setEditSheetOpen(false)} className="cyber-btn-outline">取消</Button>
            <Button className="cyber-btn-primary" onClick={() => void handleUpdateSchedule()}>保存</Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Create Schedule Sheet */}
      <Sheet open={createSheetOpen} onOpenChange={setCreateSheetOpen}>
        <SheetContent side="right" className="!w-[min(90vw,500px)] sm:max-w-[500px] !sm:max-w-none flex flex-col p-0 gap-0 border-border overflow-y-auto">
          <SheetHeader className="px-6 py-4 border-b border-border flex-shrink-0 bg-muted">
            <SheetTitle className="flex items-center gap-3 font-sans text-foreground">
              <div className="p-2 bg-primary/20 rounded border border-primary/30">
                <Terminal className="w-5 h-5 text-primary" />
              </div>
              <span className="text-lg font-semibold uppercase tracking-wider">新建计划任务</span>
            </SheetTitle>
            <SheetDescription className="text-xs text-muted-foreground font-normal">
              按分钟周期自动生成审计任务，支持项目、分支和排除规则配置。
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground uppercase">项目 *</Label>
              <Select value={createForm.project_id} onValueChange={(value) => setCreateForm((prev) => ({ ...prev, project_id: value }))}>
                <SelectTrigger className="cyber-input">
                  <SelectValue placeholder="选择项目" />
                </SelectTrigger>
                <SelectContent className="cyber-dialog border-border">
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground uppercase">任务名称 *</Label>
              <Input value={createForm.name} onChange={(e) => setCreateForm((prev) => ({ ...prev, name: e.target.value }))} className="cyber-input" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground uppercase">扫描方式</Label>
                <Select value={createForm.scan_mode} onValueChange={(value) => setCreateForm((prev) => ({ ...prev, scan_mode: value }))}>
                  <SelectTrigger className="cyber-input">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="cyber-dialog border-border">
                    <SelectItem value="fast">快速审计</SelectItem>
                    <SelectItem value="agent">深度审计</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground uppercase">分支</Label>
                <Input value={createForm.branch_name} onChange={(e) => setCreateForm((prev) => ({ ...prev, branch_name: e.target.value }))} className="cyber-input" />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground uppercase">扫描周期（分钟）</Label>
              <Input type="number" min="1" value={createForm.interval_minutes} onChange={(e) => setCreateForm((prev) => ({ ...prev, interval_minutes: e.target.value }))} className="cyber-input" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground uppercase">允许开始时间</Label>
                <Input type="time" value={createForm.time_window_start} onChange={(e) => setCreateForm((prev) => ({ ...prev, time_window_start: e.target.value }))} className="cyber-input" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground uppercase">允许结束时间</Label>
                <Input type="time" value={createForm.time_window_end} onChange={(e) => setCreateForm((prev) => ({ ...prev, time_window_end: e.target.value }))} className="cyber-input" />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground uppercase">时区</Label>
              <Input value={createForm.timezone} onChange={(e) => setCreateForm((prev) => ({ ...prev, timezone: e.target.value }))} className="cyber-input" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground uppercase">限定文件（逗号分隔）</Label>
              <Input value={createForm.file_paths} onChange={(e) => setCreateForm((prev) => ({ ...prev, file_paths: e.target.value }))} className="cyber-input" placeholder="cmd/main.go,src/App.tsx" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground uppercase">排除模式（逗号分隔）</Label>
              <Input value={createForm.exclude_patterns} onChange={(e) => setCreateForm((prev) => ({ ...prev, exclude_patterns: e.target.value }))} className="cyber-input" placeholder="node_modules/**,dist/**" />
            </div>
          </div>

          <div className="flex-shrink-0 flex justify-end gap-3 px-6 py-4 bg-muted border-t border-border">
            <Button variant="outline" onClick={() => setCreateSheetOpen(false)} className="cyber-btn-outline">取消</Button>
            <Button className="cyber-btn-primary" onClick={() => void handleCreateSchedule()}>保存</Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
