/**
 * Create IaC Task Dialog
 * IaC 扫描任务创建对话框 - 同时支持 Git 仓库（分支）和本地上传（zip）项目
 */

import { useEffect, useMemo, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiClient } from "@/shared/api/serverClient";
import { api } from "@/shared/api/database";
import {
  scanZipFile,
  scanStoredZipFile,
} from "@/features/projects/services/repoZipScan";
import {
  isZipProject,
  isRepositoryProject,
} from "@/shared/utils/projectUtils";
import { useZipFile } from "./hooks/useZipFile";
import ZipFileSection from "./components/ZipFileSection";
import { toast } from "sonner";
import { ShieldAlert } from "lucide-react";
import type { Project } from "@/shared/types";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated?: (taskId: string) => void;
}

export default function CreateIacTaskDialog({ open, onOpenChange, onCreated }: Props) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState("");
  const [branch, setBranch] = useState("");
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const selectedProject = useMemo(
    () => projects.find((p) => p.id === projectId),
    [projects, projectId],
  );
  const zipState = useZipFile(selectedProject, projects);

  // 加载项目列表（与 useProjects 一致：仅 is_active）
  useEffect(() => {
    if (!open) return;
    setLoadingProjects(true);
    api
      .getProjects()
      .then((list) => {
        const items = (list ?? []).filter((p) => p.is_active);
        setProjects(items);
      })
      .catch(() => toast.error("加载项目失败"))
      .finally(() => setLoadingProjects(false));
  }, [open]);

  // 切换项目时清空分支
  useEffect(() => {
    setBranch("");
  }, [projectId]);

  // 关闭抽屉时复位
  useEffect(() => {
    if (!open) {
      setProjectId("");
      setBranch("");
      zipState.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const projectTypeLabel = (p: Project): string => {
    if (isZipProject(p)) return "本地";
    if (isRepositoryProject(p)) return "Git";
    return "";
  };

  const canSubmit = useMemo(() => {
    if (!selectedProject) return false;
    if (isZipProject(selectedProject)) {
      return (
        (zipState.useStoredZip && zipState.storedZipInfo?.has_file === true) ||
        !!zipState.zipFile
      );
    }
    return true; // Git 项目允许空分支（后端用默认分支）
  }, [selectedProject, zipState]);

  const handleSubmit = async () => {
    if (!selectedProject) {
      toast.error("请选择项目");
      return;
    }
    setSubmitting(true);
    try {
      let taskId: string | undefined;

      if (isZipProject(selectedProject)) {
        if (zipState.useStoredZip && zipState.storedZipInfo?.has_file) {
          taskId = await scanStoredZipFile({
            projectId: selectedProject.id,
            taskType: "iac_scan",
          });
        } else if (zipState.zipFile) {
          taskId = await scanZipFile({
            projectId: selectedProject.id,
            zipFile: zipState.zipFile,
            taskType: "iac_scan",
          });
        } else {
          toast.error("请上传或选择已存压缩包");
          return;
        }
      } else {
        const res = await apiClient.post(`/projects/${selectedProject.id}/scan`, {
          task_type: "iac_scan",
          branch_name: branch || undefined,
          full_scan: true,
        });
        taskId = (res.data as { task_id?: string })?.task_id;
      }

      toast.success("IaC 扫描任务已启动");
      onOpenChange(false);
      setProjectId("");
      setBranch("");
      if (taskId) onCreated?.(taskId);
    } catch (e: unknown) {
      const detail =
        (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      const msg = detail || (e instanceof Error ? e.message : "启动失败");
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const showZipSection = selectedProject && isZipProject(selectedProject);
  const showBranchSection = selectedProject && !isZipProject(selectedProject);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="!w-[min(90vw,480px)] !max-w-none flex flex-col p-0 gap-0 bg-background"
      >
        {/* Header */}
        <SheetHeader className="px-6 py-4 flex-shrink-0">
          <SheetTitle className="flex items-center gap-3 text-lg">
            <div className="p-2 rounded-sm bg-primary/10 border border-primary/20">
              <ShieldAlert className="w-5 h-5 text-primary" />
            </div>
            新建 IaC 扫描
          </SheetTitle>
        </SheetHeader>

        {/* 内容区 */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* 选择项目 */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">目标项目</Label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger className="h-9 text-xs rounded-sm">
                <SelectValue
                  placeholder={loadingProjects ? "加载中..." : "选择项目"}
                />
              </SelectTrigger>
              <SelectContent className="cyber-dialog border-border">
                {projects.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-muted-foreground">
                    {loadingProjects ? "加载中..." : "暂无项目"}
                  </div>
                ) : (
                  projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      <span className="inline-flex items-center gap-2">
                        <span>{p.name}</span>
                        <span className="text-[10px] px-1 rounded-sm bg-muted text-muted-foreground border border-border">
                          {projectTypeLabel(p)}
                        </span>
                      </span>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* 分支 - 仅 Git 项目 */}
          {showBranchSection && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                分支（可选，默认使用项目默认分支）
              </Label>
              <Input
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                placeholder="如 main"
                className="h-9 text-xs rounded-sm"
              />
            </div>
          )}

          {/* 上传/选存压缩包 - 仅 zip 项目 */}
          {showZipSection && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">源代码压缩包</Label>
              <ZipFileSection
                loading={zipState.loading}
                storedZipInfo={zipState.storedZipInfo}
                useStoredZip={zipState.useStoredZip}
                zipFile={zipState.zipFile}
                onSwitchToStored={zipState.switchToStored}
                onSwitchToUpload={zipState.switchToUpload}
                onFileSelect={zipState.handleFileSelect}
              />
            </div>
          )}

          {/* 说明 */}
          <div className="rounded-sm border border-border bg-muted/30 px-3 py-2">
            <p className="text-xs text-muted-foreground leading-relaxed">
              将自动加载全部 IaC 规则集（容器镜像类 / 编排部署类 / CI/CD 类），
              对 Dockerfile、docker-compose、GitHub Actions 等文件进行扫描。
            </p>
          </div>
        </div>

        {/* 底部按钮区 */}
        <div className="border-t border-border px-6 py-3 flex justify-end gap-2 flex-shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            取消
          </Button>
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={submitting || !canSubmit}
          >
            {submitting ? "启动中..." : "开始扫描"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
