/**
 * Create Task Dialog
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
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
  Upload,
  Package,
  Shield,
  Loader2,
  Zap,
  Bot,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/shared/config/database";
import { apiClient } from "@/shared/api/serverClient";
import { getRuleSets, type AuditRuleSet } from "@/shared/api/rules";
import { getPromptTemplates, type PromptTemplate } from "@/shared/api/prompts";
import { createAgentTask } from "@/shared/api/agentTasks";

import { useProjects } from "./hooks/useTaskForm";
import { useZipFile } from "./hooks/useZipFile";
import WhitelistConfig from "./components/WhitelistConfig";

import { runRepositoryAudit } from "@/features/projects/services/repoScan";
import {
  scanZipFile,
  scanStoredZipFile,
  validateZipFile,
} from "@/features/projects/services/repoZipScan";
import { isRepositoryProject, isZipProject } from "@/shared/utils/projectUtils";
import type { Project } from "@/shared/types";

interface CreateTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTaskCreated: () => void;
  onFastScanStarted?: (taskId: string, taskType?: "repository" | "zip") => void;
  preselectedProjectId?: string;
}

const DEFAULT_EXCLUDES: string[] = [];

export default function CreateTaskDialog({
  open,
  onOpenChange,
  onTaskCreated,
  onFastScanStarted,
  preselectedProjectId,
}: CreateTaskDialogProps) {
  const navigate = useNavigate();
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [taskName, setTaskName] = useState("");
  const [branch, setBranch] = useState("main");
  const [branches, setBranches] = useState<string[]>([]);
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [excludePatterns, setExcludePatterns] = useState(DEFAULT_EXCLUDES);
  const [creating, setCreating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduleInterval, setScheduleInterval] = useState("1");
  const [scheduleUnit, setScheduleUnit] = useState<"day" | "hour">("day");
  const [scheduleTime, setScheduleTime] = useState("09:00");

  const [auditMode, setAuditMode] = useState<"fast" | "agent">("fast");

  const [ruleSets, setRuleSets] = useState<AuditRuleSet[]>([]);
  const [promptTemplates, setPromptTemplates] = useState<PromptTemplate[]>([]);
  const [selectedRuleSetId, setSelectedRuleSetId] = useState<string>("");
  const [selectedPromptTemplateId, setSelectedPromptTemplateId] = useState<string>("");

  const [functionWhitelist, setFunctionWhitelist] = useState<string[]>([]);
  const [vulnerabilityWhitelist, setVulnerabilityWhitelist] = useState<string[]>([]);
  const [sanitizerFunctions, setSanitizerFunctions] = useState<string[]>([]);

  const { projects, loading, loadProjects } = useProjects();
  const selectedProject = projects.find((p) => p.id === selectedProjectId);
  const zipState = useZipFile(selectedProject, projects);

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
      } catch (error) {
        const msg = error instanceof Error ? error.message : "未知错误";
        toast.error(`加载分支失败: ${msg}`);
        setBranches([project.default_branch || "main"]);
      } finally {
        setLoadingBranches(false);
      }
    };

    loadBranches();
  }, [selectedProjectId, projects]);

  useEffect(() => {
    const loadRulesAndPrompts = async () => {
      try {
        const [rulesRes, promptsRes] = await Promise.all([
          getRuleSets({ is_active: true }),
          getPromptTemplates({ is_active: true }),
        ]);
        setRuleSets(rulesRes.items);
        setPromptTemplates(promptsRes.items);
        const defaultRuleSet = rulesRes.items.find((r: AuditRuleSet) => r.is_default);
        if (defaultRuleSet) {
          setSelectedRuleSetId(defaultRuleSet.id);
        } else if (rulesRes.items.length > 0) {
          setSelectedRuleSetId(rulesRes.items[0].id);
        }
        const defaultPrompt = promptsRes.items.find((p: PromptTemplate) => p.is_default);
        if (defaultPrompt) {
          setSelectedPromptTemplateId(defaultPrompt.id);
        } else if (promptsRes.items.length > 0) {
          setSelectedPromptTemplateId(promptsRes.items[0].id);
        }
      } catch (error) {
        console.error("加载规则集和提示词失败:", error);
      }
    };
    loadRulesAndPrompts();
  }, []);

  useEffect(() => {
    if (open) {
      loadProjects();
      if (preselectedProjectId) {
        setSelectedProjectId(preselectedProjectId);
      }
      setTaskName("");
      setScheduleEnabled(false);
      setScheduleInterval("1");
      setScheduleUnit("day");
      setScheduleTime("09:00");
      const defaultRuleSet = ruleSets.find(r => r.is_default);
      setSelectedRuleSetId(defaultRuleSet?.id || ruleSets[0]?.id || "");
      const defaultPrompt = promptTemplates.find(p => p.is_default);
      setSelectedPromptTemplateId(defaultPrompt?.id || promptTemplates[0]?.id || "");
      setFunctionWhitelist([]);
      setVulnerabilityWhitelist([]);
      setSanitizerFunctions([]);
      zipState.reset();
    }
  }, [open, preselectedProjectId, ruleSets, promptTemplates]);

  const createScheduleIfEnabled = async (project: Project) => {
    if (!scheduleEnabled) {
      return null;
    }

    const interval = Number(scheduleInterval);
    if (!Number.isFinite(interval) || interval < 1) {
      throw new Error("扫描周期必须大于 0");
    }

    const intervalMinutes = scheduleUnit === "day"
      ? interval * 24 * 60
      : interval * 60;

    // 使用用户选择的时间作为执行时间窗口
    const windowEnd = scheduleTime;
    // 计算开始时间：执行时间前1小时
    const [h, m] = scheduleTime.split(":").map(Number);
    const startH = Math.max(0, h - 1);
    const windowStart = `${String(startH).padStart(2, "0")}:${String(m).padStart(2, "0")}`;

    const response = await apiClient.post("/schedules", {
      project_id: project.id,
      name: auditMode === "agent" ? `定时深度审计-${taskName.trim()}` : `定时扫描-${taskName.trim()}`,
      scan_mode: auditMode,
      branch_name: isRepositoryProject(project) ? branch : null,
      interval_minutes: intervalMinutes,
      time_window_start: windowStart,
      time_window_end: windowEnd,
      timezone: "Asia/Shanghai",
      file_paths: [],
      exclude_patterns: excludePatterns,
      rule_set_id: auditMode === "fast" ? selectedRuleSetId || null : null,
      prompt_template_id: auditMode === "fast" ? selectedPromptTemplateId || null : null,
      functionWhitelist,
      vulnerabilityWhitelist,
      sanitizerFunctions,
      is_active: true,
    });

    return response.data;
  };

  const handleStartScan = async () => {
    if (!selectedProject) {
      toast.error("请选择项目");
      return;
    }
    if (!taskName.trim()) {
      toast.error("请输入任务名称");
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

    try {
      setCreating(true);

      // 启用定时时，仅创建定时计划，不立即执行扫描
      // ScheduledScanRunner 会在 next_run_at 时间自动触发首次扫描
      if (scheduleEnabled) {
        try {
          await createScheduleIfEnabled(selectedProject);
        } catch (error) {
          const msg = error instanceof Error ? error.message : "创建定时计划失败";
          toast.error(`创建定时计划失败: ${msg}`);
          return;
        }

        onOpenChange(false);
        onTaskCreated();
        toast.success("定时计划已创建，扫描将在设定时间自动执行");

        setSelectedProjectId("");
        setTaskName("");
        setExcludePatterns(DEFAULT_EXCLUDES);
        setScheduleEnabled(false);
        return;
      }

      // 未启用定时：立即执行扫描
      let taskId: string;

      if (auditMode === "agent") {
        // 编译后产物项目暂不支持深度审计（agent 目前只处理源码反编译尚未接入）
        if (selectedProject.scan_mode === "compiled") {
          toast.error("编译后产物项目暂不支持深度审计");
          return;
        }
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

        onOpenChange(false);
        onTaskCreated();
        toast.success("深度审计任务已创建");
        navigate(`/agent-audit/${agentTask.id}`);

        setSelectedProjectId("");
        setTaskName("");
        setExcludePatterns(DEFAULT_EXCLUDES);
        setScheduleEnabled(false);
        return;
      }

      if (isZipProject(selectedProject)) {
        // 读取项目的 scan_mode 和 compiled_options（不再由对话框选择）
        const projectScanMode = selectedProject.scan_mode || "source";
        const compiledExtras = projectScanMode === "compiled"
          ? {
              scanMode: "compiled" as const,
              compiledOptions: selectedProject.compiled_options || { enable_sca: true, max_binary_size_mb: 200 },
            }
          : { scanMode: "source" as const };

        if (zipState.useStoredZip && zipState.storedZipInfo?.has_file) {
          taskId = await scanStoredZipFile({
            projectId: selectedProject.id,
            excludePatterns,
            createdBy: "local-user",
            ruleSetId: selectedRuleSetId || undefined,
            promptTemplateId: selectedPromptTemplateId || undefined,
            functionWhitelist,
            vulnerabilityWhitelist,
            sanitizerFunctions,
            ...compiledExtras,
          });
        } else if (zipState.zipFile) {
          taskId = await scanZipFile({
            projectId: selectedProject.id,
            zipFile: zipState.zipFile,
            excludePatterns,
            createdBy: "local-user",
            ruleSetId: selectedRuleSetId || undefined,
            promptTemplateId: selectedPromptTemplateId || undefined,
            functionWhitelist,
            vulnerabilityWhitelist,
            sanitizerFunctions,
            ...compiledExtras,
          });
        } else {
          toast.error("请上传 ZIP 文件");
          return;
        }
      } else {
        if (!selectedProject.repository_url) {
          toast.error("仓库地址为空");
          return;
        }
        taskId = await runRepositoryAudit({
          projectId: selectedProject.id,
          repoUrl: selectedProject.repository_url,
          branch,
          exclude: excludePatterns,
          createdBy: "local-user",
          ruleSetId: selectedRuleSetId || undefined,
          promptTemplateId: selectedPromptTemplateId || undefined,
          functionWhitelist,
          vulnerabilityWhitelist,
          sanitizerFunctions,
        });
      }

      onOpenChange(false);
      onTaskCreated();
      if (onFastScanStarted) {
        onFastScanStarted(taskId, isZipProject(selectedProject) ? "zip" : "repository");
      }
      toast.success("扫描任务已启动");

      setSelectedProjectId("");
      setExcludePatterns(DEFAULT_EXCLUDES);
      setScheduleEnabled(false);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "未知错误";
      toast.error(`启动失败: ${msg}`);
    } finally {
      setCreating(false);
    }
  };

  const canStart = useMemo(() => {
    if (!selectedProject) return false;
    if (!taskName.trim()) return false;
    if (isZipProject(selectedProject)) {
      return (
        (zipState.useStoredZip && zipState.storedZipInfo?.has_file) ||
        !!zipState.zipFile
      );
    }
    return !!selectedProject.repository_url && !!branch.trim();
  }, [selectedProject, zipState, branch]);

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="!w-[min(90vw,480px)] !max-w-none flex flex-col p-0 gap-0 bg-background">
          {/* Header */}
          <SheetHeader className="px-6 py-4 flex-shrink-0">
            <SheetTitle className="flex items-center gap-3 text-lg">
              <div className="p-2 rounded-sm bg-primary/10 border border-primary/20">
                <Shield className="w-5 h-5 text-primary" />
              </div>
              新建审计任务
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
                disabled={loading}
              >
                <SelectTrigger className="h-9 text-xs rounded-sm">
                  {loading ? (
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
                      {zipState.zipFile
                        ? zipState.zipFile.name
                        : zipState.storedZipInfo?.original_filename || "未选择文件"}
                    </span>
                    {zipState.storedZipInfo?.has_file && !zipState.zipFile && (
                      <label className="cursor-pointer">
                        <Badge variant="outline" className="text-xs hover:bg-primary/10 cursor-pointer h-6">
                          <Upload className="w-3 h-3 mr-1" />
                          更换文件
                          <input
                            type="file"
                            accept=".zip,.rar,.7z,.tar,.gz,.tgz,.tar.gz"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                const v = validateZipFile(file);
                                if (!v.valid) {
                                  toast.error(v.error || "文件无效");
                                  e.target.value = "";
                                  return;
                                }
                                zipState.handleFileSelect(file, e.target);
                              }
                            }}
                            className="hidden"
                          />
                        </Badge>
                      </label>
                    )}
                    {zipState.zipFile && (
                      <Button
                        size="sm"
                        onClick={async () => {
                          if (!zipState.zipFile || !selectedProject) return;
                          setUploading(true);
                          try {
                            await api.uploadProjectZip(selectedProject.id, zipState.zipFile);
                            toast.success("文件上传成功");
                            zipState.switchToStored();
                            loadProjects();
                          } catch (error) {
                            const msg = error instanceof Error ? error.message : "上传失败";
                            toast.error(msg);
                          } finally {
                            setUploading(false);
                          }
                        }}
                        disabled={uploading}
                        className="h-7 text-xs px-2"
                      >
                        {uploading ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Upload className="w-3 h-3" />
                        )}
                      </Button>
                    )}
                    {!zipState.storedZipInfo?.has_file && !zipState.zipFile && (
                      <label className="cursor-pointer">
                        <Badge variant="outline" className="text-xs hover:bg-primary/10 cursor-pointer h-6">
                          <Upload className="w-3 h-3 mr-1" />
                          上传文件
                          <input
                            type="file"
                            accept=".zip,.rar,.7z,.tar,.gz,.tgz,.tar.gz"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                const v = validateZipFile(file);
                                if (!v.valid) {
                                  toast.error(v.error || "文件无效");
                                  e.target.value = "";
                                  return;
                                }
                                zipState.handleFileSelect(file, e.target);
                              }
                            }}
                            className="hidden"
                          />
                        </Badge>
                      </label>
                    )}
                  </div>
                )}

                {/* 规则集和提示词选择 - 仅快速扫描模式显示 */}
                {auditMode !== "agent" && (
                  <div className="space-y-2">
                    <div>
                      <Label className="text-xs text-muted-foreground">规则集</Label>
                      <Select value={selectedRuleSetId} onValueChange={setSelectedRuleSetId}>
                        <SelectTrigger className="h-9 text-xs rounded-sm">
                          <SelectValue placeholder="选择规则集" />
                        </SelectTrigger>
                        <SelectContent>
                          {ruleSets.map((rs) => (
                            <SelectItem key={rs.id} value={rs.id} className="text-xs">
                              {rs.name} {rs.is_default && '(默认)'} ({rs.enabled_rules_count})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">提示词模板</Label>
                      <Select value={selectedPromptTemplateId} onValueChange={setSelectedPromptTemplateId}>
                        <SelectTrigger className="h-9 text-xs rounded-sm">
                          <SelectValue placeholder="选择提示词模板" />
                        </SelectTrigger>
                        <SelectContent>
                          {promptTemplates.map((pt) => (
                            <SelectItem key={pt.id} value={pt.id} className="text-xs">
                              {pt.name} {pt.is_default && '(默认)'}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}

                <div className="h-px bg-border" />

                {/* 白名单配置 */}
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
                  onClick={handleStartScan}
                  disabled={!canStart || creating}
                  className="h-10 px-5"
                >
                  {creating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      创建中...
                    </>
                  ) : scheduleEnabled ? (
                    <>
                      <Shield className="w-4 h-4 mr-2" />
                      创建定时计划
                    </>
                  ) : auditMode === "agent" ? (
                    <>
                      <Bot className="w-4 h-4 mr-2" />
                      启动深度审计
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4 mr-2" />
                      开始快速扫描
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
