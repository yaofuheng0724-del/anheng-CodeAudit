/**
 * Agent 审计任务创建侧边栏
 */

import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BranchSelector } from "@/components/ui/branch-selector";
import {
  GitBranch,
  Package,
  Upload,
  Loader2,
  Play,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/shared/config/database";
import { apiClient } from "@/shared/api/serverClient";
import { createAgentTask } from "@/shared/api/agentTasks";
import { isRepositoryProject, isZipProject } from "@/shared/utils/projectUtils";
import { getZipFileInfo, type ZipFileMeta } from "@/shared/utils/zipStorage";
import { validateZipFile } from "@/features/projects/services/repoZipScan";
import type { Project } from "@/shared/types";
import WhitelistConfig from "@/components/audit/components/WhitelistConfig";

interface CreateAgentTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function CreateAgentTaskDialog({
  open,
  onOpenChange,
}: CreateAgentTaskDialogProps) {
  const navigate = useNavigate();

  // 状态
  const [projects, setProjects] = useState<Project[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [taskName, setTaskName] = useState("");
  const [branch, setBranch] = useState("main");
  const [branches, setBranches] = useState<string[]>([]);
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [excludePatterns, setExcludePatterns] = useState<string[]>([]);
  const [functionWhitelist, setFunctionWhitelist] = useState<string[]>([]);
  const [vulnerabilityWhitelist, setVulnerabilityWhitelist] = useState<string[]>([]);
  const [sanitizerFunctions, setSanitizerFunctions] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduleInterval, setScheduleInterval] = useState("1");
  const [scheduleUnit, setScheduleUnit] = useState<"day" | "hour">("day");
  const [scheduleTime, setScheduleTime] = useState("09:00");

  // ZIP 文件状态
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [storedZipInfo, setStoredZipInfo] = useState<ZipFileMeta | null>(null);

  const selectedProject = projects.find((p) => p.id === selectedProjectId);

  // 加载项目列表
  useEffect(() => {
    if (open) {
      setLoadingProjects(true);
      api.getProjects()
        .then((data) => {
          setProjects(data.filter((p: Project) => p.is_active));
        })
        .catch(() => {
          toast.error("加载项目列表失败");
        })
        .finally(() => setLoadingProjects(false));

      // 重置状态
      setSelectedProjectId("");
      setTaskName("");
      setBranch("main");
      setExcludePatterns([]);
      setFunctionWhitelist([]);
      setVulnerabilityWhitelist([]);
      setSanitizerFunctions([]);
      setZipFile(null);
      setStoredZipInfo(null);
      setScheduleEnabled(false);
      setScheduleInterval("1");
      setScheduleUnit("day");
      setScheduleTime("09:00");
    }
  }, [open]);

  // 加载分支列表
  useEffect(() => {
    const loadBranches = async () => {
      const project = projects.find((p) => p.id === selectedProjectId);
      if (!project || !isRepositoryProject(project)) {
        setBranches([]);
        return;
      }

      setLoadingBranches(true);
      try {
        const result = await api.getProjectBranches(project.id);

        if (result.error) {
          toast.error(`加载分支失败: ${result.error}`);
        }

        setBranches(result.branches);
        if (result.default_branch) {
          setBranch(result.default_branch);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "未知错误";
        toast.error(`加载分支失败: ${msg}`);
        setBranches([project.default_branch || "main"]);
      } finally {
        setLoadingBranches(false);
      }
    };

    loadBranches();
  }, [selectedProjectId, projects]);

  // 加载 ZIP 文件信息
  useEffect(() => {
    const loadZipInfo = async () => {
      if (!selectedProject || !isZipProject(selectedProject)) {
        setStoredZipInfo(null);
        return;
      }

      try {
        const info = await getZipFileInfo(selectedProject.id);
        setStoredZipInfo(info);
      } catch {
        setStoredZipInfo(null);
      }
    };

    loadZipInfo();
  }, [selectedProject?.id]);

  // 是否可以开始
  const canStart = useMemo(() => {
    if (!selectedProject) return false;
    if (!taskName.trim()) return false;
    // 编译后产物项目不允许走深度审计
    if (selectedProject.scan_mode === "compiled") return false;
    if (isZipProject(selectedProject)) {
      return storedZipInfo?.has_file || !!zipFile;
    }
    return !!selectedProject.repository_url && !!branch.trim();
  }, [selectedProject, taskName, storedZipInfo, zipFile, branch]);

  // 创建任务
  const handleCreate = async () => {
    if (!selectedProject) return;
    if (!taskName.trim()) {
      toast.error("请输入任务名称");
      return;
    }
    if (selectedProject.scan_mode === "compiled") {
      toast.error("编译后产物项目暂不支持深度审计");
      return;
    }
    if (scheduleEnabled) {
      const interval = Number(scheduleInterval);
      if (!Number.isFinite(interval) || interval < 1) {
        toast.error("扫描周期必须大于 0");
        return;
      }
      if (!scheduleTime) {
        toast.error("请设置执行时间");
        return;
      }
    }

    setCreating(true);
    try {
      const agentTask = await createAgentTask({
        project_id: selectedProject.id,
        name: taskName.trim(),
        branch_name: isRepositoryProject(selectedProject) ? branch : undefined,
        exclude_patterns: excludePatterns,
        verification_level: "sandbox",
        functionWhitelist,
        vulnerabilityWhitelist,
        sanitizerFunctions,
      });

      let scheduleError: string | null = null;
      if (scheduleEnabled) {
        const interval = Number(scheduleInterval);
        const intervalMinutes = scheduleUnit === "day"
          ? interval * 24 * 60
          : interval * 60;
        const windowEnd = scheduleTime;
        const [h, m] = scheduleTime.split(":").map(Number);
        const startH = Math.max(0, h - 1);
        const windowStart = `${String(startH).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
        try {
          await apiClient.post("/schedules", {
            project_id: selectedProject.id,
            name: `定时审计-${taskName.trim()}`,
            scan_mode: "agent",
            branch_name: isRepositoryProject(selectedProject) ? branch : null,
            interval_minutes: intervalMinutes,
            time_window_start: windowStart,
            time_window_end: windowEnd,
            timezone: "Asia/Shanghai",
            file_paths: [],
            exclude_patterns: excludePatterns,
            functionWhitelist,
            vulnerabilityWhitelist,
            sanitizerFunctions,
            is_active: true,
          });
        } catch (error) {
          scheduleError = error instanceof Error ? error.message : "创建定时计划失败";
        }
      }

      onOpenChange(false);
      if (scheduleError) {
        toast.warning(`审计任务已创建，但定时计划创建失败: ${scheduleError}`);
      } else if (scheduleEnabled) {
        toast.success("审计任务已创建，定时计划已创建");
      } else {
        toast.success("审计任务已创建");
      }
      navigate(`/agent-audit/${agentTask.id}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "创建失败";
      toast.error(msg);
    } finally {
      setCreating(false);
    }
  };

  // 处理文件上传
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const validation = validateZipFile(file);
      if (!validation.valid) {
        toast.error(validation.error || "文件无效");
        e.target.value = "";
        return;
      }
      setZipFile(file);
    }
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="!w-[min(90vw,480px)] !max-w-none flex flex-col p-0 gap-0 bg-background">
          {/* Header */}
          <SheetHeader className="px-6 py-4 flex-shrink-0">
            <SheetTitle className="flex items-center gap-3 text-lg">
              <div className="p-2 rounded-sm bg-primary/10 border border-primary/20">
                <Sparkles className="w-5 h-5 text-primary" />
              </div>
              新建深度审计任务
            </SheetTitle>
          </SheetHeader>

          {/* 内容区 */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            {/* 任务名称 */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">任务名称</Label>
              <Input
                placeholder="为本次审计任务命名..."
                value={taskName}
                onChange={(e) => setTaskName(e.target.value)}
                className="h-9 text-xs rounded-sm"
              />
            </div>

            {/* 选择项目 */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">目标项目</Label>
              <Select
                value={selectedProjectId}
                onValueChange={setSelectedProjectId}
                disabled={loadingProjects}
              >
                <SelectTrigger className="h-9 text-xs rounded-sm">
                  {loadingProjects ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-muted-foreground">加载项目...</span>
                    </div>
                  ) : (
                    <SelectValue placeholder="选择要审计的项目" />
                  )}
                </SelectTrigger>
                <SelectContent className="max-h-[240px]">
                  {projects.length === 0 ? (
                    <div className="py-8 text-center text-muted-foreground text-xs">
                      <Package className="w-4 h-4 mx-auto mb-2 opacity-50" />
                      暂无可用项目
                    </div>
                  ) : (
                    projects.map((project) => (
                      <SelectItem key={project.id} value={project.id} className="text-xs">
                        <div className="flex items-center gap-1.5">
                          <span>{project.name}</span>
                          <Badge variant="secondary" className="text-xs px-1 py-0 leading-none">
                            {isRepositoryProject(project) ? "Git" : "ZIP"}
                          </Badge>
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* 项目配置（选择项目后显示） */}
            {selectedProject && (
              <>
                <div className="h-px bg-border" />

                {/* 仓库项目：分支选择 */}
                {isRepositoryProject(selectedProject) && (
                  <div className="flex items-center gap-3">
                    <GitBranch className="w-4 h-4 text-muted-foreground" />
                    <Label className="text-xs text-muted-foreground w-12">分支</Label>
                    {loadingBranches ? (
                      <div className="flex items-center gap-2 flex-1">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="text-xs text-muted-foreground">加载分支...</span>
                      </div>
                    ) : (
                      <BranchSelector
                        value={branch}
                        onChange={setBranch}
                        branches={branches}
                        placeholder="选择分支"
                        className="flex-1 h-9"
                      />
                    )}
                  </div>
                )}

                {/* ZIP 项目：文件显示 + 更换 */}
                {isZipProject(selectedProject) && (
                  <div className="flex items-center gap-3 h-9 px-3 rounded-sm border border-border bg-muted/30">
                    <Package className="w-4 h-4 text-muted-foreground" />
                    <span className="text-xs flex-1 truncate">
                      {zipFile ? zipFile.name : storedZipInfo?.original_filename || "未选择文件"}
                    </span>
                    <label className="cursor-pointer">
                      <Badge variant="outline" className="text-xs hover:bg-primary/10 cursor-pointer h-6">
                        <Upload className="w-3 h-3 mr-1" />
                        更换文件
                        <input
                          type="file"
                          accept=".zip"
                          onChange={handleFileChange}
                          className="hidden"
                        />
                      </Badge>
                    </label>
                  </div>
                )}

                <div className="h-px bg-border" />

                {/* 过滤与白名单配置 */}
                <WhitelistConfig
                  functionWhitelist={functionWhitelist}
                  vulnerabilityWhitelist={vulnerabilityWhitelist}
                  sanitizerFunctions={sanitizerFunctions}
                  onChange={(field, values) => {
                    if (field === 'functionWhitelist') setFunctionWhitelist(values);
                    else if (field === 'vulnerabilityWhitelist') setVulnerabilityWhitelist(values);
                    else if (field === 'sanitizerFunctions') setSanitizerFunctions(values);
                  }}
                />

                {/* 时间配置 */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-muted-foreground">时间配置</Label>
                    <Switch checked={scheduleEnabled} onCheckedChange={setScheduleEnabled} className="h-5 w-9 [&>span]:size-3.5 [&>span]:data-[state=unchecked]:translate-x-0.5 [&>span]:data-[state=checked]:translate-x-[18px]" />
                  </div>

                  {scheduleEnabled && (
                    <div className="p-2 rounded-sm border border-border bg-muted/20 space-y-2">
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">执行周期</Label>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            min="1"
                            value={scheduleInterval}
                            onChange={(e) => setScheduleInterval(e.target.value)}
                            className="h-9 text-xs rounded-sm"
                          />
                          <Select value={scheduleUnit} onValueChange={(v: string) => setScheduleUnit(v as "day" | "hour")}>
                            <SelectTrigger className="h-9 text-xs rounded-sm flex-1">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="day">天</SelectItem>
                              <SelectItem value="hour">小时</SelectItem>
                            </SelectContent>
                          </Select>
                          <span className="text-xs text-muted-foreground whitespace-nowrap">执行一次</span>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">执行时间</Label>
                        <Input
                          type="time"
                          value={scheduleTime}
                          onChange={(e) => setScheduleTime(e.target.value)}
                          className="h-9 text-xs rounded-sm w-full"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          <div className="flex-shrink-0 px-6 py-4 border-t border-border bg-muted/30">
            <div className="flex items-center justify-between">
              <div className="text-xs text-muted-foreground">
                {selectedProject ? (
                  <span>已选择 <strong className="text-foreground">{selectedProject.name}</strong></span>
                ) : (
                  <span>请先选择项目</span>
                )}
              </div>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={creating}
                  className="h-10 px-4"
                >
                  取消
                </Button>
                <Button
                  onClick={handleCreate}
                  disabled={!canStart || creating}
                  className="h-10 px-5"
                >
                  {creating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      启动中...
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 mr-2" />
                      开始审计
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}