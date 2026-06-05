# IaC 扫描支持本地上传 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让「新建 IaC 扫描」抽屉同时支持 Git 仓库项目和本地上传项目（zip/rar/7z/...）走 IaC Semgrep 扫描。

**Architecture:** 后端在 `process_zip_task` 中按 `scan_config["task_type"]` 分流，IaC 走抽出的共用函数 `_run_iac_workspace`（复用 `scan_iac_task` 的扫描+落库逻辑）；前端 `CreateIacTaskDialog` 按项目类型动态切换分支输入/zip 上传 UI，提交时按类型分发到 `/projects/{id}/scan` 或 `/scan/upload-zip`(`/scan-stored-zip`)。

**Tech Stack:** Backend — FastAPI / SQLAlchemy / asyncio；Frontend — React 18 / TypeScript / shadcn-ui / axios。

**参考文档：** `docs/superpowers/specs/2026-06-04-iac-scan-zip-upload-design.md`

---

## File Structure

**后端（修改）：**
- `backend/app/services/scanner.py` — 抽出 `_run_iac_workspace`；`scan_iac_task` 改为调用它
- `backend/app/api/v1/endpoints/scan.py` — `ScanRequest` 增加 `task_type` 字段；`/upload-zip` & `/scan-stored-zip` 透传 `task_type`；`process_zip_task` 按 `task_type` 分流

**前端（修改）：**
- `frontend/src/features/projects/services/repoZipScan.ts` — `scanZipFile` / `scanStoredZipFile` 入参加 `taskType`，写入 `scan_config`
- `frontend/src/components/audit/CreateIacTaskDialog.tsx` — 按项目类型动态切换表单 + 复用 useZipFile/ZipFileSection

**前端（复用，不修改）：**
- `frontend/src/components/audit/hooks/useZipFile.ts`
- `frontend/src/components/audit/components/ZipFileSection.tsx`
- `frontend/src/shared/utils/projectUtils.ts` (`isZipProject`, `isRepositoryProject`)

---

## Task 1：抽出共用函数 `_run_iac_workspace`

**Files:**
- Modify: `backend/app/services/scanner.py:621-702`

- [ ] **Step 1：在 `_collect_iac_files` 之后、`scan_iac_task` 之前插入新函数**

定位 `backend/app/services/scanner.py` 中 `_collect_iac_files` 函数结束、`scan_iac_task` 开始的位置（约 619 行附近），插入：

```python
async def _run_iac_workspace(
    task: AuditTask,
    db: AsyncSession,
    workspace_dir: str,
) -> None:
    """在已物化的 workspace 上跑 IaC Semgrep 扫描并落 issue。

    被 scan_iac_task（Git 仓库路径）和 process_zip_task 的 iac_scan 分支
    （zip 上传路径）共用，保持 issue 落库形态完全一致。
    """
    from app.services.quick_scan import run_semgrep_scan

    iac_rules_path = (
        Path(__file__).resolve().parents[3]
        / "rules" / "semgrep" / "iac-rules.yml"
    )

    workspace_path = Path(workspace_dir)
    iac_files = _collect_iac_files(workspace_path)
    print(f"📦 IaC 扫描发现 {len(iac_files)} 个文件")

    findings = []
    if iac_files:
        findings = run_semgrep_scan(
            workspace_dir=workspace_path,
            source_files=iac_files,
            rules_file=iac_rules_path,
        )

    for f in findings:
        issue = AuditIssue(
            task_id=task.id,
            file_path=f["file_path"],
            line_number=f.get("line_number"),
            column_number=f.get("column_number"),
            issue_type="iac",
            severity=f.get("severity", "medium"),
            title=f.get("title"),
            message=f.get("title"),
            description=f.get("description"),
            suggestion=f.get("suggestion"),
            code_snippet=f.get("code_snippet"),
        )
        db.add(issue)
    task.total_files = len(iac_files)
    task.scanned_files = len(iac_files)
    task.issues_count = len(findings)
```

- [ ] **Step 2：把 `scan_iac_task` 中的扫描+落库逻辑替换为调用 `_run_iac_workspace`**

在 `scan_iac_task`（原 621 行）内，把 step 4/5/6（约 653-689 行）这段：

```python
        # 4) Collect IaC files
        iac_files = _collect_iac_files(workspace_path)
        print(f"📦 IaC 扫描发现 {len(iac_files)} 个文件")

        # 5) Run Semgrep with IaC ruleset
        findings = []
        if iac_files:
            findings = run_semgrep_scan(
                workspace_dir=workspace_path,
                source_files=iac_files,
                rules_file=iac_rules_path,
            )

        # 6) Persist issues
        async with db_session_factory() as db:
            task = await db.get(AuditTask, task_id)
            for f in findings:
                issue = AuditIssue(
                    task_id=task.id,
                    file_path=f["file_path"],
                    line_number=f.get("line_number"),
                    column_number=f.get("column_number"),
                    issue_type="iac",
                    severity=f.get("severity", "medium"),
                    title=f.get("title"),
                    message=f.get("title"),
                    description=f.get("description"),
                    suggestion=f.get("suggestion"),
                    code_snippet=f.get("code_snippet"),
                )
                db.add(issue)
            task.total_files = len(iac_files)
            task.scanned_files = len(iac_files)
            task.issues_count = len(findings)
            task.status = "completed"
            task.completed_at = datetime.now(timezone.utc)
            await db.commit()
        print(f"✅ IaC 任务 {task_id} 完成，共 {len(findings)} 条 issue")
```

替换为：

```python
        # 4) Run IaC scan via shared helper
        async with db_session_factory() as db:
            task = await db.get(AuditTask, task_id)
            await _run_iac_workspace(task, db, workspace_dir)
            task.status = "completed"
            task.completed_at = datetime.now(timezone.utc)
            await db.commit()
        print(f"✅ IaC 任务 {task_id} 完成")
```

同时把函数顶部已经无用的 `from app.services.quick_scan import run_semgrep_scan` 和 `iac_rules_path` 局部变量删掉（它们已迁到 `_run_iac_workspace` 内部）。

- [ ] **Step 3：运行后端语法检查**

```bash
cd /home/test/DeepAudit/backend && python -c "from app.services.scanner import _run_iac_workspace, scan_iac_task; print('ok')"
```

Expected: `ok`

- [ ] **Step 4：Commit**

```bash
cd /home/test/DeepAudit
git add backend/app/services/scanner.py
git commit -m "refactor(scanner): extract _run_iac_workspace shared helper

Pull the IaC collect-scan-persist sequence out of scan_iac_task into a
standalone helper so the zip-upload path can reuse identical issue shape.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2：`ScanRequest` 增加 `task_type` + `/scan-stored-zip` 透传

**Files:**
- Modify: `backend/app/api/v1/endpoints/scan.py:159-170`（`ScanRequest` 类）
- Modify: `backend/app/api/v1/endpoints/scan.py:213-225`（`/scan-stored-zip` 端点 scan_config 写入段）

- [ ] **Step 1：在 `ScanRequest` 模型中增加字段**

定位 `scan.py:159-170`（`class ScanRequest(BaseModel):` 块），在末尾的 `compiled_options` 之后新增：

```python
    # --- task type for routing inside process_zip_task ---
    task_type: Optional[str] = "repository"  # "repository" | "iac_scan"
```

- [ ] **Step 2：在 `/scan-stored-zip` 端点透传 task_type**

定位 `scan.py:213-225`（`if scan_request:` 块）— 在 `compiled_options` 写入后新增一行：

```python
        user_config['scan_config'] = {
            'file_paths': scan_request.file_paths or [],
            'exclude_patterns': scan_request.exclude_patterns or [],
            'rule_set_id': scan_request.rule_set_id,
            'prompt_template_id': scan_request.prompt_template_id,
            'functionWhitelist': scan_request.functionWhitelist or [],
            'vulnerabilityWhitelist': scan_request.vulnerabilityWhitelist or [],
            'sanitizerFunctions': scan_request.sanitizerFunctions or [],
            'scan_mode': scan_request.scan_mode or 'source',
            'compiled_options': scan_request.compiled_options or {},
            'task_type': scan_request.task_type or 'repository',  # <-- 新增
        }
```

- [ ] **Step 3：在 `/upload-zip` 端点透传 task_type**

定位 `scan.py:139-150`（`if parsed_scan_config:` 块），同样在末尾新增 `task_type` 字段：

```python
        user_config['scan_config'] = {
            'file_paths': parsed_scan_config.get('file_paths', []),
            'exclude_patterns': parsed_scan_config.get('exclude_patterns', []),
            'rule_set_id': parsed_scan_config.get('rule_set_id'),
            'prompt_template_id': parsed_scan_config.get('prompt_template_id'),
            'functionWhitelist': parsed_scan_config.get('functionWhitelist', []),
            'vulnerabilityWhitelist': parsed_scan_config.get('vulnerabilityWhitelist', []),
            'sanitizerFunctions': parsed_scan_config.get('sanitizerFunctions', []),
            'scan_mode': parsed_scan_config.get('scan_mode') or 'source',
            'compiled_options': parsed_scan_config.get('compiled_options') or {},
            'task_type': parsed_scan_config.get('task_type') or 'repository',  # <-- 新增
        }
```

- [ ] **Step 4：运行后端语法检查**

```bash
cd /home/test/DeepAudit/backend && python -c "from app.api.v1.endpoints.scan import ScanRequest; r = ScanRequest(task_type='iac_scan'); print(r.task_type)"
```

Expected: `iac_scan`

- [ ] **Step 5：Commit**

```bash
cd /home/test/DeepAudit
git add backend/app/api/v1/endpoints/scan.py
git commit -m "feat(scan): add task_type to ScanRequest and zip endpoints

Propagate task_type through scan_config so process_zip_task can route
between source-scan and iac-scan branches.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3：`process_zip_task` 增加 iac_scan 分流

**Files:**
- Modify: `backend/app/api/v1/endpoints/scan.py:43-68`（`process_zip_task` 函数）

- [ ] **Step 1：改写 process_zip_task 主体，在解压后按 task_type 分流**

定位 `scan.py:43-68`（`async def process_zip_task` 整个函数），整体替换为：

```python
async def process_zip_task(task_id: str, file_path: str, db_session_factory, user_config: dict = None):
    """后台本地文件处理任务"""
    async with db_session_factory() as db:
        task = await db.get(AuditTask, task_id)
        if not task:
            return

        extract_dir = Path(f"/tmp/{task_id}")
        try:
            task.status = "running"
            task.started_at = datetime.now(timezone.utc)
            await db.commit()
            extract_dir.mkdir(parents=True, exist_ok=True)
            extract_archive_recursive(file_path, extract_dir)

            # 按 scan_config.task_type 分流：iac_scan 走 IaC Semgrep，
            # 其它走现有源码/编译产物扫描管道
            scan_cfg = (user_config or {}).get("scan_config", {}) or {}
            requested_task_type = scan_cfg.get("task_type") or "repository"

            if requested_task_type == "iac_scan":
                # 回写 task.task_type 让前端列表/详情正确识别为 IaC 任务
                task.task_type = "iac_scan"
                await db.commit()
                from app.services.scanner import _run_iac_workspace
                await _run_iac_workspace(task, db, str(extract_dir))
                task.status = "completed"
                task.completed_at = datetime.now(timezone.utc)
                await db.commit()
            else:
                await scan_local_workspace(task, db, str(extract_dir), user_config=user_config)

            task_control.cleanup_task(task_id)

        except Exception as e:
            print(f"❌ 本地文件扫描失败: {e}")
            task.status = "failed"
            task.completed_at = datetime.now(timezone.utc)
            await db.commit()
            task_control.cleanup_task(task_id)
        finally:
            if extract_dir.exists():
                shutil.rmtree(extract_dir)
```

- [ ] **Step 2：运行后端导入检查（验证两个函数可联动）**

```bash
cd /home/test/DeepAudit/backend && python -c "
from app.api.v1.endpoints.scan import process_zip_task
from app.services.scanner import _run_iac_workspace
print('imports ok')
"
```

Expected: `imports ok`

- [ ] **Step 3：Commit**

```bash
cd /home/test/DeepAudit
git add backend/app/api/v1/endpoints/scan.py
git commit -m "feat(scan): route iac_scan task_type in process_zip_task

When uploaded zip task carries scan_config.task_type='iac_scan',
write task.task_type='iac_scan' and invoke _run_iac_workspace
instead of scan_local_workspace. Defaults to 'repository' for
backward compatibility.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4：前端 service 层增加 `taskType` 入参

**Files:**
- Modify: `frontend/src/features/projects/services/repoZipScan.ts:21-89`

- [ ] **Step 1：给 `scanZipFile` 入参类型加 `taskType` 并写入 scan_config**

定位 `repoZipScan.ts` 中 `export async function scanZipFile(params: { ... })` 块（约 21-60 行），在入参对象类型末尾增加：

```typescript
  scanMode?: "source" | "compiled";
  compiledOptions?: CompiledScanOptions;
  taskType?: "repository" | "iac_scan";   // <-- 新增
}): Promise<string> {
```

然后在函数体里的 `scanConfig` 对象末尾增加 `task_type` 字段：

```typescript
  const scanConfig = {
    file_paths: params.filePaths,
    full_scan: !params.filePaths || params.filePaths.length === 0,
    exclude_patterns: params.excludePatterns || [],
    rule_set_id: params.ruleSetId,
    prompt_template_id: params.promptTemplateId,
    functionWhitelist: params.functionWhitelist || [],
    vulnerabilityWhitelist: params.vulnerabilityWhitelist || [],
    sanitizerFunctions: params.sanitizerFunctions || [],
    scan_mode: params.scanMode || "source",
    compiled_options: params.compiledOptions || null,
    task_type: params.taskType || "repository",   // <-- 新增
  };
```

- [ ] **Step 2：给 `scanStoredZipFile` 做同样的扩展**

定位同文件 `export async function scanStoredZipFile(params: { ... })`（约 65-89 行），同样在入参类型末尾新增 `taskType?: "repository" | "iac_scan"`，然后在请求 body 里增加 `task_type: params.taskType || "repository"`。

具体在请求体处（搜 `const scanRequest = {` 或类似变量）末尾增加一行 `task_type: params.taskType || "repository",`。如果该文件中调用方式是直接 `apiClient.post(..., { ... })` 内联对象，则在该对象末尾添加同样的字段。

- [ ] **Step 3：类型检查**

```bash
cd /home/test/DeepAudit/frontend && npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "repoZipScan|error TS" | head -20
```

Expected: 无输出（无错误）

- [ ] **Step 4：Commit**

```bash
cd /home/test/DeepAudit
git add frontend/src/features/projects/services/repoZipScan.ts
git commit -m "feat(zip-scan): plumb taskType through scan_config

Adds optional taskType param to scanZipFile/scanStoredZipFile so callers
can request iac_scan instead of the default repository scan path.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5：重写 `CreateIacTaskDialog` 支持双路径

**Files:**
- Modify: `frontend/src/components/audit/CreateIacTaskDialog.tsx`（整体重写）

- [ ] **Step 1：整体替换文件内容**

把 `CreateIacTaskDialog.tsx` 全文替换为：

```tsx
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
```

- [ ] **Step 2：类型检查**

```bash
cd /home/test/DeepAudit/frontend && npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "CreateIacTaskDialog|error TS" | head -20
```

Expected: 无输出（无错误）

- [ ] **Step 3：Commit**

```bash
cd /home/test/DeepAudit
git add frontend/src/components/audit/CreateIacTaskDialog.tsx
git commit -m "feat(iac): support local zip projects in IaC scan dialog

The dialog now switches between branch input (Git projects) and
upload/use-stored zip UI (zip projects) based on selected project type.
Zip projects flow through scan/upload-zip with taskType='iac_scan'.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6：端到端冒烟测试（手测）

**Files:**
- 无代码改动；手动验证

- [ ] **Step 1：启动后端和前端，登录系统**

确保后端服务和前端 dev server 都在运行（参考项目 README 启动命令）。

- [ ] **Step 2：场景 A — Git 项目 IaC 扫描**

1. 进入"审计任务"页 → 点"新建 IaC 扫描"
2. 验证：项目下拉显示 Git 类型项目带 "Git" 徽章
3. 选一个 Git 项目 → 验证：显示"分支"输入框
4. 留空分支或填 `main` → 点"开始扫描"
5. 验证：toast 提示成功，任务列表新建任务 task_type=iac_scan，issue 类型为 iac

- [ ] **Step 3：场景 B — zip 项目 IaC 扫描（上传新包）**

1. 准备一个含 `Dockerfile` 或 `docker-compose.yml` 的压缩包（zip 即可）
2. "新建 IaC 扫描" → 选一个 zip 类型项目（带 "本地" 徽章）
3. 验证：显示 ZipFileSection（上传/选存包 UI），不再显示分支输入
4. 上传新压缩包 → 点"开始扫描"
5. 验证：任务列表新建任务 task_type=iac_scan，issue 类型为 iac

- [ ] **Step 4：场景 C — zip 项目（使用已存包）**

1. 用 step 3 已上传 zip 的项目，再次"新建 IaC 扫描"
2. 验证：默认选中"使用已存储的文件"，显示文件元信息
3. 点"开始扫描"
4. 验证：任务正确创建（走 `/scan-stored-zip`），无重复上传

- [ ] **Step 5：场景 D — 切换项目类型**

1. 抽屉里先选 zip 项目 → 切到 Git 项目
2. 验证：zip 上传区消失，分支输入出现，按钮可用状态正确

- [ ] **Step 6：边界 — 未选项目/未传包**

1. 不选项目就点"开始扫描" → 按钮 disabled
2. 选 zip 项目（无已存包）但不上传 → 按钮 disabled

- [ ] **Step 7：手测通过后不需要 commit（无代码变更）**

如果手测中发现 bug，回到对应 Task 修复，再回到此任务重测。

---

## Self-Review

**Spec 覆盖：**
- ✅ `_run_iac_workspace` 抽出：Task 1
- ✅ `process_zip_task` 分流：Task 3
- ✅ `ScanRequest` 加 task_type 字段、两个端点透传：Task 2
- ✅ 前端 service 加 taskType：Task 4
- ✅ Dialog 双路径切换：Task 5
- ✅ 测试场景覆盖：Task 6（场景 A/B/C 对应 spec 测试场景 1/2/3，D 对应场景 4）
- ✅ task_type 回写 AuditTask：Task 3 Step 1（`task.task_type = "iac_scan"`）

**Placeholder：** 无 TBD/TODO；每个 step 都给出完整代码或精确命令。

**类型一致性：**
- 后端：`scan_config["task_type"]` 字符串在三处保持一致
- 前端：`taskType?: "repository" | "iac_scan"` 在 service 入参和 Dialog 调用处一致
- Pydantic `ScanRequest.task_type` 默认值 `"repository"`，与前端默认值对齐

**风险确认：**
- Task 3 改动 `process_zip_task` 后，原有 source/compiled 路径走 else 分支不变；scan_config 缺 task_type 时 `requested_task_type` fallback 为 `"repository"`，向后兼容。
- Task 1 抽函数时把 `task.status / completed_at` 留在调用方设置（不进 helper），保证 helper 不抢调用方的 commit 时机控制。
