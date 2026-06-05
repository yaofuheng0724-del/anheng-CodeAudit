# IaC 扫描支持本地上传设计文档

## 背景

当前「新建 IaC 扫描」抽屉只支持 Git 仓库项目（选择项目 + 分支），不支持本地上传压缩包走 IaC 扫描。而「新建审计任务」抽屉同时支持 Git 仓库和 zip 上传两种方式。本设计让 IaC 扫描对齐该能力。

## 目标

让 IaC 扫描抽屉能同时处理两种项目类型：

- **Git 仓库项目**（现有）——选项目 + 分支，走 `POST /projects/{id}/scan`（`task_type=iac_scan`）
- **本地上传项目**（新）——选项目 + 上传/选存压缩包，走 `POST /scan/upload-zip` 或 `/scan-stored-zip`（带 `task_type=iac_scan`）

不在范围：编译产物扫描、定时扫描、规则集选择（IaC 用固定全量 `iac-rules.yml`，与现状一致）。

## 架构与数据流

```
CreateIacTaskDialog
├── [选中 Git 项目]
│   └── apiClient.post(`/projects/{id}/scan`, {task_type:"iac_scan", branch})
│       └── scan_iac_task (已有，不变)
│           └── materialize_repository_workspace (Git/SVN/SSH 拉取)
│           └── _run_iac_workspace (新抽共用函数)
│               └── _collect_iac_files + run_semgrep_scan(iac-rules.yml)
│
└── [选中 zip 项目]
    └── scanZipFile/scanStoredZipFile({taskType:"iac_scan", ...})
        └── POST /scan/upload-zip  或  POST /scan-stored-zip
            └── process_zip_task (新增 iac_scan 分支)
                └── 解压
                └── if scan_config["task_type"] == "iac_scan":
                    ├── task.task_type = "iac_scan"  (回写入库)
                    └── _run_iac_workspace(...)
                  else:
                    └── scan_local_workspace(...)  (现有)

                        (新加)

                          (新加，同一个函数体)
```

### task_type 流转

前端发起：

- `scanZipFile` / `scanStoredZipFile` 入参增加 `taskType?: "repository" | "iac_scan"`  
  默认 `"repository"`（向后兼容）。
- 将该值写入 `scan_config` JSON 的 `task_type` 字段，随 FormData / body 发送。

后端接收：

- `/scan/upload-zip`：从已解析的 `scan_config` 中读 `task_type`，写入 `user_config['scan_config']['task_type']`
- `/scan-stored-zip`：`ScanRequest` 模型增加 `task_type` 字段，同样写进 `user_config['scan_config']['task_type']`
- `process_zip_task` 收到 `user_config['scan_config']['task_type']`:
  - `"iac_scan"` → 回写 `task.task_type = "iac_scan"`，调用 `_run_iac_workspace`
  - 其它 → 走现有 `scan_local_workspace`

### 共用函数 _run_iac_workspace

抽自现有 `scan_iac_task`（`scanner.py:653-689`）

```python
async def _run_iac_workspace(workspace_dir: str, task: AuditTask, db: AsyncSession):
    """在已物化的 workspace 目录上运行 IaC Semgrep 扫描并落 issue。"""
    iac_files = _collect_iac_files(Path(workspace_dir))
    findings = []
    if iac_files:
        findings = run_semgrep_scan(workspace_dir, iac_files, IAC_RULES_PATH)
    task.total_files = len(iac_files)
    task.scanned_files = len(iac_files)
    task.issues_count = len(findings)
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
```

`scan_iac_task` 简化为此调用：

```python
workspace_dir = await materialize_repository_workspace(...)
async with db_session_factory() as db:
    task = await db.get(AuditTask, task_id)
    await _run_iac_workspace(workspace_dir, task, db)
    task.status = "completed"
    task.completed_at = datetime.now(timezone.utc)
    await db.commit()
```

## 具体改动

### 后端

| 文件 | 改动 |
|------|------|
| `app/services/scanner.py` | 抽 `_run_iac_workspace` 函数（约 30 行）；`scan_iac_task` 精简为该函数前调 `materialize_repository_workspace`，后调该函数 |
| `app/api/v1/endpoints/scan.py` | `ScanRequest` 模型新增 `task_type: Optional[str] = "repository"`；`/scan-stored-zip` 把 `scan_request.task_type` 写进 `user_config['scan_config']['task_type']`；`/upload-zip` 从已解析的 `scan_config` JSON 做同样写入；`process_zip_task` 新增 iac_scan 分流分支 |

### 前端

| 文件 | 改动 |
|------|------|
| `features/projects/services/repoZipScan.ts` | `scanZipFile` / `scanStoredZipFile` 参数接口增加 `taskType?: "repository" \| "iac_scan"`，写入 `scan_config` |
| `components/audit/CreateIacTaskDialog.tsx` | 按项目类型动态切换表单：Git 项目显示分支输入，zip 项目显示上传/选存包 UI；提交时按项目类型分发调用 |

### 组件细节

CreateIacTaskDialog 结构（与 CreateTaskDialog 一致的 Body/Footer 分区）：

```
SheetContent (side="right", !w-[min(90vw,480px)] ...)
  ├── SheetHeader ── 图标 + "新建 IaC 扫描"
  ├── scroll body
  │   ├── 目标项目 (Select)
  │   ├── [仅 Git 项目] 分支 (Input)
  │   └── [仅 zip 项目] 文件上传区 (复用 useZipFile)
  │       ├── 上传压缩包 (drag/drop + file input)
  │       └── 或使用已存包 (checkbox + 文件元信息显示)
  └── Footer ── [取消] [开始扫描]
```

zip 项目状态下，说明文字同步更新提示可扫描 IaC 文件类型。

## 错误处理

- **未选项目**：`toast.error("请选择项目")`（现状保留）
- **zip 项目未传/未选包**：按钮 disabled，`toast.error("请上传或选择已存压缩包")`
- **上传中点提交**：用 `uploading || submitting` 联合禁用按钮
- **后端 `scan_config` 缺 `task_type`**：视为 `"repository"`，行为不变（向后兼容）
- **IaC 扫描 0 文件**：task 标 completed，issues_count=0（现状行为，无特殊处理）

## 测试场景

1. Git 项目 → 选项目 → 分支输入 → 启动 → 任务列表标 IaC（绿色徽章）→ issue 正常
2. zip 项目 → 选项目 → 上传包含 IaC 文件的压缩包 → 启动 → 任务列表标 IaC → issue 正常
3. zip 项目 → 选项目 → 勾选「使用已存包」→ 查看元信息 → 启动 → 正常
4. zip 项目选 Git→切换回 zip → 表单字段正确清空
5. 已存包 zip 项目 → 未上传过文件 → 提交 → 后端 400 正常透传
6. Git 项目 → 提交 → 分支输入为空 → 使用项目默认分支

## 不做

- 编译产物扫描（IaC + compiled 无实际意义）
- 定时扫描（IaC 抽屉目前没有，不引入新功能）
- 规则集/提示词模板选择（IaC 用固定全量 iac-rules.yml，与现状一致）
- IaC 抽屉的代理模式（agent audit，与现有快速 IaC 概念不符）

## 风险与缓解

| 风险 | 缓解 |
|------|------|
| `process_zip_task` 三路分发（source/compiled/iac）后复杂度上升 | 分发逻辑在函数开头完成，三个分支体彼此独立互不嵌套；每个分支体最多 10 行 |
| 复用 `scan_config` 透传 `task_type` 可能和既有的 `scan_config` 字段冲突 | 该字段名是字符串，不在既有字段集合中；同时在 `ScanRequest` 中显式声明 |
| zip 上传后 task_type="iac_scan" 但 `user_config['scan_config']` 中途被截断丢失 | 在 `/upload-zip` 的 `scan_config` 解析分支后，额外写入此行（与 `/scan-stored-zip` 一致） |