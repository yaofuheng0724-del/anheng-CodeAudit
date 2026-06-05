# IaC 扫描功能 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 DeepAudit 上新增最小可用的 IaC（基础设施即代码）静态扫描能力，覆盖 Dockerfile / docker-compose / GitHub Actions 三类文件，共 10 条规则。

**Architecture:** 完全复用现有 Semgrep 扫描器、`AuditTask`、`AuditIssue` 与规则集模型。后端新增一份 IaC 专用 Semgrep 规则文件 + 一个 `iac_scan` 任务类型分支；规则集以 `rule_type="iac"` 预置 3 个（容器镜像类 / 编排部署类 / CI/CD 类）。前端：顶部「审计任务 ▾」加 `IaC扫描` 入口；「审计规则 → 静态规则」`RULE_TYPES` 新增 `IaC规则` 类型。

**Tech Stack:** Python 3.11 + FastAPI + SQLAlchemy (async)；React 18 + TypeScript + shadcn/ui；Semgrep CLI。

**Spec:** `docs/superpowers/specs/2026-06-03-iac-scanning-design.md`

---

## 文件结构

**新建：**
- `rules/semgrep/iac-rules.yml` — IaC Semgrep 规则集（10 条规则）
- `backend/tests/iac/fixtures/` — 每条规则的正反样本
- `backend/tests/iac/test_iac_scan.py` — IaC 扫描集成测试
- `frontend/src/components/audit/CreateIacTaskDialog.tsx` — IaC 任务创建对话框

**修改：**
- `backend/app/services/quick_scan.py` — `run_semgrep_scan` 支持 `rules_file` 参数（不破坏现有调用）
- `backend/app/services/scanner.py` — 新增 `scan_iac_task` 入口
- `backend/app/services/init_templates.py` — 追加 3 个 IaC 规则集到 `SYSTEM_RULE_SETS`
- `backend/app/api/v1/endpoints/projects.py` — 启动扫描接口支持 `task_type=iac_scan`
- `frontend/src/components/layout/Sidebar.tsx` — `auditSubItems` 加 IaC 扫描
- `frontend/src/pages/AuditTasks.tsx` — `TaskTab` 增加 `iac`，新增 IaC 列表与创建按钮
- `frontend/src/pages/AuditRules.tsx` — `RULE_TYPES` / `CATEGORY_ABBREV` 加 `iac`
- `frontend/src/pages/TaskDetail.tsx` — Issue 列表渲染紫色 `IaC` Tag

---

## Task 1: 编写 IaC Semgrep 规则文件

**Files:**
- Create: `rules/semgrep/iac-rules.yml`

- [ ] **Step 1: 创建 IaC 规则文件**

完整内容写入 `rules/semgrep/iac-rules.yml`：

```yaml
rules:
  # ============ 容器镜像类 (4 条) ============
  - id: IAC-CTR-001
    message: "Dockerfile 未指定非 root USER，容器将以 root 运行"
    severity: WARNING
    languages: [generic]
    paths:
      include: ["Dockerfile", "*.dockerfile", "Dockerfile.*"]
    patterns:
      - pattern-either:
          - pattern: USER root
          - pattern: USER 0
    metadata:
      category: iac
      iac_target: dockerfile
      rule_code: IAC-CTR-001

  - id: IAC-CTR-002
    message: "镜像使用 :latest 标签，不利于复现"
    severity: WARNING
    languages: [generic]
    paths:
      include: ["Dockerfile", "*.dockerfile", "Dockerfile.*"]
    pattern-regex: '^FROM\s+\S+:latest(\s|$)'
    metadata:
      category: iac
      iac_target: dockerfile
      rule_code: IAC-CTR-002

  - id: IAC-CTR-003
    message: "Dockerfile 使用 ADD 抓取远程 URL，建议改用 RUN curl + 校验"
    severity: WARNING
    languages: [generic]
    paths:
      include: ["Dockerfile", "*.dockerfile", "Dockerfile.*"]
    pattern-regex: '^ADD\s+https?://'
    metadata:
      category: iac
      iac_target: dockerfile
      rule_code: IAC-CTR-003

  - id: IAC-CTR-004
    message: "Dockerfile 出现 'curl ... | sh' 模式，远程脚本执行风险"
    severity: ERROR
    languages: [generic]
    paths:
      include: ["Dockerfile", "*.dockerfile", "Dockerfile.*"]
    pattern-regex: '(curl|wget)[^\n]*\|\s*(sh|bash)'
    metadata:
      category: iac
      iac_target: dockerfile
      rule_code: IAC-CTR-004

  # ============ 编排部署类 (3 条) ============
  - id: IAC-ORC-001
    message: "容器以 privileged: true 运行，等同于 root 主机权限"
    severity: ERROR
    languages: [yaml]
    paths:
      include: ["docker-compose*.yml", "docker-compose*.yaml", "compose.yml", "compose.yaml"]
    pattern: "privileged: true"
    metadata:
      category: iac
      iac_target: compose
      rule_code: IAC-ORC-001

  - id: IAC-ORC-002
    message: "服务使用 network_mode: host，破坏容器网络隔离"
    severity: WARNING
    languages: [yaml]
    paths:
      include: ["docker-compose*.yml", "docker-compose*.yaml", "compose.yml", "compose.yaml"]
    pattern-regex: 'network_mode:\s*["'"'"']?host["'"'"']?'
    metadata:
      category: iac
      iac_target: compose
      rule_code: IAC-ORC-002

  - id: IAC-ORC-003
    message: "容器挂载 /var/run/docker.sock，等同于授予宿主机 root"
    severity: ERROR
    languages: [yaml]
    paths:
      include: ["docker-compose*.yml", "docker-compose*.yaml", "compose.yml", "compose.yaml"]
    pattern-regex: '/var/run/docker\.sock'
    metadata:
      category: iac
      iac_target: compose
      rule_code: IAC-ORC-003

  # ============ CI/CD 类 (3 条) ============
  - id: IAC-CI-001
    message: "pull_request_target 触发器存在权限提升风险，避免直接 checkout PR 头"
    severity: ERROR
    languages: [yaml]
    paths:
      include: [".github/workflows/*.yml", ".github/workflows/*.yaml"]
    pattern: "pull_request_target"
    metadata:
      category: iac
      iac_target: github_actions
      rule_code: IAC-CI-001

  - id: IAC-CI-002
    message: "GitHub Action 未固定 commit SHA，存在供应链篡改风险"
    severity: WARNING
    languages: [yaml]
    paths:
      include: [".github/workflows/*.yml", ".github/workflows/*.yaml"]
    pattern-regex: 'uses:\s+[\w\-]+/[\w\-]+@(v\d+(\.\d+)*|main|master|latest|\w{1,39})$'
    metadata:
      category: iac
      iac_target: github_actions
      rule_code: IAC-CI-002

  - id: IAC-CI-003
    message: "secrets 直接出现在 run 脚本里，可能被日志/进程列表泄漏，建议改用 env 注入"
    severity: ERROR
    languages: [yaml]
    paths:
      include: [".github/workflows/*.yml", ".github/workflows/*.yaml"]
    patterns:
      - pattern-regex: 'run:[^\n]*\$\{\{\s*secrets\.'
    metadata:
      category: iac
      iac_target: github_actions
      rule_code: IAC-CI-003
```

- [ ] **Step 2: 验证规则文件语法**

Run: `semgrep --validate --config rules/semgrep/iac-rules.yml`
Expected: 输出 `Configuration is valid`（或等价提示），返回码 0。

- [ ] **Step 3: 提交**

```bash
git add rules/semgrep/iac-rules.yml
git commit -m "feat(iac): add semgrep ruleset for Dockerfile/compose/github-actions

10 rules across 3 categories: container image, orchestration, CI/CD."
```

---

## Task 2: 添加测试 fixtures + 集成测试

**Files:**
- Create: `backend/tests/iac/__init__.py`
- Create: `backend/tests/iac/fixtures/Dockerfile.bad`
- Create: `backend/tests/iac/fixtures/Dockerfile.good`
- Create: `backend/tests/iac/fixtures/docker-compose.bad.yml`
- Create: `backend/tests/iac/fixtures/docker-compose.good.yml`
- Create: `backend/tests/iac/fixtures/.github/workflows/bad.yml`
- Create: `backend/tests/iac/fixtures/.github/workflows/good.yml`
- Create: `backend/tests/iac/test_iac_scan.py`

- [ ] **Step 1: 创建 Dockerfile 正反样本**

`backend/tests/iac/fixtures/Dockerfile.bad`：

```dockerfile
FROM ubuntu:latest
ADD https://example.com/install.sh /tmp/install.sh
RUN curl https://get.docker.com | sh
USER root
CMD ["/bin/bash"]
```

`backend/tests/iac/fixtures/Dockerfile.good`：

```dockerfile
FROM ubuntu:22.04
COPY install.sh /tmp/install.sh
RUN sha256sum -c install.sh.sha256 && bash /tmp/install.sh
USER appuser
CMD ["/bin/bash"]
```

- [ ] **Step 2: 创建 docker-compose 正反样本**

`backend/tests/iac/fixtures/docker-compose.bad.yml`：

```yaml
version: "3"
services:
  app:
    image: nginx
    privileged: true
    network_mode: host
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
```

`backend/tests/iac/fixtures/docker-compose.good.yml`：

```yaml
version: "3"
services:
  app:
    image: nginx:1.25
    ports:
      - "8080:80"
    volumes:
      - ./data:/usr/share/nginx/html
```

- [ ] **Step 3: 创建 GitHub Actions 正反样本**

`backend/tests/iac/fixtures/.github/workflows/bad.yml`：

```yaml
name: bad
on:
  pull_request_target:
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: deploy
        run: echo "${{ secrets.DEPLOY_KEY }}" > /tmp/k
```

`backend/tests/iac/fixtures/.github/workflows/good.yml`：

```yaml
name: good
on:
  push:
    branches: [main]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@8e5e7e5ab8b370d6c329ec480221332ada57f0ab
      - name: deploy
        env:
          DEPLOY_KEY: ${{ secrets.DEPLOY_KEY }}
        run: echo "$DEPLOY_KEY" > /tmp/k
```

- [ ] **Step 4: 创建测试文件**

`backend/tests/iac/__init__.py`：留空。

`backend/tests/iac/test_iac_scan.py`：

```python
"""IaC Semgrep 规则集成测试 - 验证规则触发与未误报。"""
import json
import shutil
import subprocess
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[3]
RULES_PATH = REPO_ROOT / "rules" / "semgrep" / "iac-rules.yml"
FIXTURES = Path(__file__).parent / "fixtures"


@pytest.fixture(scope="module")
def semgrep_findings() -> dict:
    """对 fixtures 目录跑一次 IaC 规则集，返回 rule_id -> [file_path, ...]。"""
    if not shutil.which("semgrep"):
        pytest.skip("semgrep CLI 未安装")
    result = subprocess.run(
        ["semgrep", "scan", "--json", "--quiet", "--config", str(RULES_PATH), str(FIXTURES)],
        capture_output=True,
        text=True,
        timeout=60,
        check=False,
    )
    assert result.returncode in (0, 1), result.stderr
    payload = json.loads(result.stdout or "{}")
    findings = {}
    for item in payload.get("results", []):
        findings.setdefault(item["check_id"], []).append(item["path"])
    return findings


EXPECTED_BAD_HITS = [
    ("IAC-CTR-001", "Dockerfile.bad"),
    ("IAC-CTR-002", "Dockerfile.bad"),
    ("IAC-CTR-003", "Dockerfile.bad"),
    ("IAC-CTR-004", "Dockerfile.bad"),
    ("IAC-ORC-001", "docker-compose.bad.yml"),
    ("IAC-ORC-002", "docker-compose.bad.yml"),
    ("IAC-ORC-003", "docker-compose.bad.yml"),
    ("IAC-CI-001", "bad.yml"),
    ("IAC-CI-002", "bad.yml"),
    ("IAC-CI-003", "bad.yml"),
]


@pytest.mark.parametrize("rule_id,filename", EXPECTED_BAD_HITS)
def test_bad_fixture_triggers_rule(semgrep_findings, rule_id, filename):
    hits = semgrep_findings.get(rule_id, [])
    assert any(filename in p for p in hits), f"{rule_id} 未在 {filename} 中触发，命中={hits}"


GOOD_FILES = ["Dockerfile.good", "docker-compose.good.yml", "good.yml"]


def test_good_fixtures_do_not_trigger(semgrep_findings):
    for rule_id, hits in semgrep_findings.items():
        for path in hits:
            for good in GOOD_FILES:
                assert good not in path, f"规则 {rule_id} 在 good 样本 {path} 误报"
```

- [ ] **Step 5: 运行测试，确认全部通过**

Run: `cd backend && pytest tests/iac/test_iac_scan.py -v`
Expected: 11 tests pass (10 bad fixture triggers + 1 good fixtures clean)。如有失败，回到 Task 1 调整对应规则正则。

- [ ] **Step 6: 提交**

```bash
git add backend/tests/iac/
git commit -m "test(iac): add fixtures and integration tests for 10 iac rules"
```

---

## Task 3: 改造 run_semgrep_scan 支持自定义规则文件

**Files:**
- Modify: `backend/app/services/quick_scan.py:763-810` (函数 `run_semgrep_scan`)

- [ ] **Step 1: 给 run_semgrep_scan 增加 rules_file 参数**

将函数签名与规则路径解析改为：

```python
def run_semgrep_scan(
    workspace_dir: str | Path,
    source_files: list[dict[str, Any]],
    exclude_patterns: list[str] | None = None,
    timeout_seconds: int = 120,
    rules_file: str | Path | None = None,
) -> list[dict[str, Any]]:
    if not shutil.which("semgrep"):
        return []

    if rules_file is not None:
        rules_path = Path(rules_file)
    else:
        rules_path = Path(__file__).resolve().parents[3] / "rules" / "semgrep" / "deepaudit-rules.yml"
    if not rules_path.exists():
        return []
```

其余正文保持不变（仍然 `--config str(rules_path)`）。

- [ ] **Step 2: 验证未破坏现有调用**

Run: `cd backend && python -c "from app.services.quick_scan import run_semgrep_scan; import inspect; print(inspect.signature(run_semgrep_scan))"`
Expected: 打印新签名，含 `rules_file=None` 默认参数。所有现有调用站点（不传 `rules_file`）行为不变。

- [ ] **Step 3: 提交**

```bash
git add backend/app/services/quick_scan.py
git commit -m "refactor(scan): allow run_semgrep_scan to accept custom rules file"
```

---

## Task 4: 新增 scan_iac_task 入口

**Files:**
- Modify: `backend/app/services/scanner.py` (在文件末尾新增函数)

- [ ] **Step 1: 阅读 scan_repo_task 现有结构**

Run: `sed -n '526,560p' backend/app/services/scanner.py`
目的：了解克隆/解压/状态更新模式，新函数将复用其骨架。

- [ ] **Step 2: 在 scanner.py 末尾新增 scan_iac_task 函数**

追加以下内容（依赖现有 import：`AuditTask` / `AuditIssue` / `AsyncSession` / `select` / `Path` / `uuid` 等已在文件顶部，无需新增）：

```python
# ============ IaC 扫描入口 ============

IAC_FILE_GLOBS = [
    "**/Dockerfile",
    "**/Dockerfile.*",
    "**/*.dockerfile",
    "**/docker-compose*.yml",
    "**/docker-compose*.yaml",
    "**/compose.yml",
    "**/compose.yaml",
    "**/.github/workflows/*.yml",
    "**/.github/workflows/*.yaml",
]


def _collect_iac_files(workspace: Path) -> list[dict[str, Any]]:
    """收集 IaC 文件，返回 run_semgrep_scan 所需 source_files 结构。"""
    seen: set[Path] = set()
    files: list[dict[str, Any]] = []
    for pattern in IAC_FILE_GLOBS:
        for abs_path in workspace.glob(pattern):
            if not abs_path.is_file() or abs_path in seen:
                continue
            seen.add(abs_path)
            rel = abs_path.relative_to(workspace).as_posix()
            files.append({
                "path": rel,
                "absolute_path": str(abs_path),
                "language": "yaml" if abs_path.suffix in {".yml", ".yaml"} else "generic",
            })
    return files


async def scan_iac_task(task_id: str, db_session_factory, user_config: dict | None = None):
    """IaC 扫描任务入口：克隆仓库 → 收集 IaC 文件 → 跑 IaC Semgrep 规则 → 落 Issue。"""
    from datetime import datetime, timezone
    from app.services.quick_scan import run_semgrep_scan

    iac_rules_path = Path(__file__).resolve().parents[3] / "rules" / "semgrep" / "iac-rules.yml"

    async with db_session_factory() as db:
        task = await db.get(AuditTask, task_id)
        if not task:
            print(f"❌ IaC 任务 {task_id} 不存在")
            return
        task.status = "running"
        task.started_at = datetime.now(timezone.utc)
        await db.commit()

    workspace_dir: Optional[Path] = None
    try:
        # 复用 scan_repo_task 的仓库准备逻辑
        async with db_session_factory() as db:
            task = await db.get(AuditTask, task_id)
            project = await db.get(Project, task.project_id)

        workspace_dir = Path(tempfile.mkdtemp(prefix="iac_scan_"))
        await clone_repository(project, workspace_dir, task.branch_name)

        # 收集 IaC 文件
        iac_files = _collect_iac_files(workspace_dir)
        print(f"📦 IaC 扫描发现 {len(iac_files)} 个文件")

        # 调用 Semgrep
        findings = []
        if iac_files:
            findings = run_semgrep_scan(
                workspace_dir=workspace_dir,
                source_files=iac_files,
                rules_file=iac_rules_path,
            )

        # 写入 Issue
        async with db_session_factory() as db:
            task = await db.get(AuditTask, task_id)
            for f in findings:
                issue = AuditIssue(
                    task_id=task.id,
                    file_path=f["file_path"],
                    line_number=f.get("line_number"),
                    column_number=f.get("column_number"),
                    issue_type="iac",  # category 字段在 AuditIssue 中名为 issue_type
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

    except Exception as exc:
        print(f"❌ IaC 任务 {task_id} 失败: {exc}")
        async with db_session_factory() as db:
            task = await db.get(AuditTask, task_id)
            if task:
                task.status = "failed"
                task.completed_at = datetime.now(timezone.utc)
                await db.commit()
    finally:
        if workspace_dir and workspace_dir.exists():
            shutil.rmtree(workspace_dir, ignore_errors=True)
```

> **注意：** 若 `scan_repo_task` 中克隆逻辑不是封装为独立 `clone_repository` 函数，则将其内联到本函数（复制对应代码片段），不要因为追求复用而改动 `scan_repo_task`。先 grep 确认：`grep -n "def clone_repository\|async def clone_repository" backend/app/services/scanner.py`。如果不存在该函数，把上方 `await clone_repository(...)` 一行替换为 `scan_repo_task` 中的实际克隆代码段。

- [ ] **Step 3: 语法 + import 自检**

Run: `cd backend && python -c "from app.services.scanner import scan_iac_task, _collect_iac_files; print('ok')"`
Expected: 输出 `ok`，无 ImportError。

- [ ] **Step 4: 单元测试 _collect_iac_files**

新建 `backend/tests/iac/test_collect.py`：

```python
from pathlib import Path
import shutil
import tempfile

from app.services.scanner import _collect_iac_files


def test_collect_iac_files_finds_all_three_types():
    tmp = Path(tempfile.mkdtemp())
    try:
        (tmp / "Dockerfile").write_text("FROM alpine\n")
        (tmp / "docker-compose.yml").write_text("services: {}\n")
        wf = tmp / ".github" / "workflows"
        wf.mkdir(parents=True)
        (wf / "ci.yml").write_text("name: ci\n")
        (tmp / "README.md").write_text("ignored\n")

        files = _collect_iac_files(tmp)
        paths = sorted(f["path"] for f in files)
        assert paths == [".github/workflows/ci.yml", "Dockerfile", "docker-compose.yml"]
    finally:
        shutil.rmtree(tmp)
```

Run: `cd backend && pytest tests/iac/test_collect.py -v`
Expected: 1 passed。

- [ ] **Step 5: 提交**

```bash
git add backend/app/services/scanner.py backend/tests/iac/test_collect.py
git commit -m "feat(scan): add scan_iac_task entrypoint for IaC scanning"
```

---

## Task 5: 预置 3 个 IaC 规则集到 init_templates

**Files:**
- Modify: `backend/app/services/init_templates.py` (向 `SYSTEM_RULE_SETS` 列表追加 3 个字典)

- [ ] **Step 1: 在 SYSTEM_RULE_SETS 末尾追加 IaC 规则集**

打开文件，找到 `SYSTEM_RULE_SETS = [` 列表的右括号 `]`（约 1722 行附近），**在其前面**追加：

```python
    # ============ IaC 规则集 ============
    {
        "name": "IaC规则-容器镜像类",
        "description": "Dockerfile 与容器镜像安全规则（root、latest 标签、远程 ADD、curl|sh）",
        "language": "all",
        "rule_type": "iac",
        "is_default": False,
        "sort_order": 100,
        "severity_weights": {"critical": 10, "high": 5, "medium": 2, "low": 1},
        "rules": [
            {
                "rule_code": "IAC-CTR-001",
                "name": "镜像以 root 用户运行",
                "description": "Dockerfile 未指定非 root USER 或显式使用 USER root",
                "category": "security",
                "severity": "medium",
                "fix_suggestion": "为镜像创建非特权用户并通过 USER appuser 切换",
                "reference_url": "https://docs.docker.com/develop/develop-images/dockerfile_best-practices/#user",
            },
            {
                "rule_code": "IAC-CTR-002",
                "name": "镜像使用 :latest 标签",
                "description": "FROM 指令使用 :latest 标签或省略 tag，破坏构建可复现性",
                "category": "security",
                "severity": "medium",
                "fix_suggestion": "固定到具体版本号，如 FROM ubuntu:22.04 或镜像 digest",
                "reference_url": "https://docs.docker.com/develop/develop-images/dockerfile_best-practices/#from",
            },
            {
                "rule_code": "IAC-CTR-003",
                "name": "Dockerfile 使用 ADD 远程 URL",
                "description": "ADD 抓取远程文件无校验，可能引入恶意内容",
                "category": "security",
                "severity": "medium",
                "fix_suggestion": "改用 RUN curl/wget 下载并通过 sha256sum 校验",
                "reference_url": "https://docs.docker.com/develop/develop-images/dockerfile_best-practices/#add-or-copy",
            },
            {
                "rule_code": "IAC-CTR-004",
                "name": "Dockerfile 出现 curl|sh 模式",
                "description": "通过管道执行远程脚本属于供应链高风险操作",
                "category": "security",
                "severity": "high",
                "fix_suggestion": "下载脚本后校验完整性再执行，或使用官方包管理器",
                "reference_url": "https://owasp.org/www-project-top-ten/",
            },
        ],
    },
    {
        "name": "IaC规则-编排部署类",
        "description": "docker-compose 编排安全规则（privileged、host 网络、Docker socket 挂载）",
        "language": "all",
        "rule_type": "iac",
        "is_default": False,
        "sort_order": 101,
        "severity_weights": {"critical": 10, "high": 5, "medium": 2, "low": 1},
        "rules": [
            {
                "rule_code": "IAC-ORC-001",
                "name": "容器以 privileged 模式运行",
                "description": "privileged: true 授予容器近似宿主机 root 权限",
                "category": "security",
                "severity": "high",
                "fix_suggestion": "改用细粒度 cap_add 仅添加必要 Linux capabilities",
                "reference_url": "https://docs.docker.com/engine/reference/run/#runtime-privilege-and-linux-capabilities",
            },
            {
                "rule_code": "IAC-ORC-002",
                "name": "服务使用主机网络",
                "description": "network_mode: host 取消容器网络隔离，监听宿主机端口",
                "category": "security",
                "severity": "medium",
                "fix_suggestion": "使用默认 bridge 网络并通过 ports 映射端口",
                "reference_url": "https://docs.docker.com/network/host/",
            },
            {
                "rule_code": "IAC-ORC-003",
                "name": "容器挂载 Docker socket",
                "description": "挂载 /var/run/docker.sock 等同于授予容器宿主机 root 权限",
                "category": "security",
                "severity": "high",
                "fix_suggestion": "使用 Docker-in-Docker 或专门的 build-server 隔离",
                "reference_url": "https://owasp.org/www-community/Docker-Security",
            },
        ],
    },
    {
        "name": "IaC规则-CI/CD类",
        "description": "GitHub Actions 工作流安全规则（pull_request_target、未固定 Action、secrets 在 run）",
        "language": "all",
        "rule_type": "iac",
        "is_default": False,
        "sort_order": 102,
        "severity_weights": {"critical": 10, "high": 5, "medium": 2, "low": 1},
        "rules": [
            {
                "rule_code": "IAC-CI-001",
                "name": "pull_request_target 触发器风险",
                "description": "pull_request_target 在仓库上下文运行 PR 代码，可被利用窃取 secrets",
                "category": "security",
                "severity": "high",
                "fix_suggestion": "改用 pull_request 触发器；如必须用 pull_request_target，避免 checkout PR 头",
                "reference_url": "https://securitylab.github.com/research/github-actions-preventing-pwn-requests/",
            },
            {
                "rule_code": "IAC-CI-002",
                "name": "引用的 Action 未固定 commit SHA",
                "description": "使用 @v1/@main 等可变引用，存在供应链篡改风险",
                "category": "security",
                "severity": "medium",
                "fix_suggestion": "将 uses 指向具体 commit SHA（40 位），如 actions/checkout@8e5e7e5...",
                "reference_url": "https://docs.github.com/en/actions/security-guides/security-hardening-for-github-actions#using-third-party-actions",
            },
            {
                "rule_code": "IAC-CI-003",
                "name": "secrets 直接出现在 run 脚本中",
                "description": "在 run: 内联使用 ${{ secrets.* }} 可能被进程列表或日志泄漏",
                "category": "security",
                "severity": "high",
                "fix_suggestion": "通过 step 的 env: 注入 secrets，run 中以环境变量名引用",
                "reference_url": "https://docs.github.com/en/actions/security-guides/security-hardening-for-github-actions#using-secrets",
            },
        ],
    },
```

- [ ] **Step 2: 触发初始化 / 验证写入数据库**

如果项目有"重新加载内置规则"的脚本或 admin 接口，调用之；否则用以下临时脚本验证：

```bash
cd backend && python -c "
import asyncio
from app.db.base import AsyncSessionLocal
from app.services.init_templates import init_templates_and_rules
asyncio.run((lambda: init_templates_and_rules.__call__(AsyncSessionLocal()) if False else None)() or asyncio.run(_run()))
" 2>/dev/null || true
```

更稳的做法 —— 在 `backend/tests/iac/test_init_templates.py` 加一个断言：

```python
from app.services.init_templates import SYSTEM_RULE_SETS


def test_iac_rule_sets_present():
    iac_sets = [rs for rs in SYSTEM_RULE_SETS if rs["rule_type"] == "iac"]
    names = sorted(rs["name"] for rs in iac_sets)
    assert names == ["IaC规则-CI/CD类", "IaC规则-容器镜像类", "IaC规则-编排部署类"]
    total_rules = sum(len(rs["rules"]) for rs in iac_sets)
    assert total_rules == 10


def test_iac_rule_codes_are_unique():
    iac_sets = [rs for rs in SYSTEM_RULE_SETS if rs["rule_type"] == "iac"]
    codes = [r["rule_code"] for rs in iac_sets for r in rs["rules"]]
    assert len(codes) == len(set(codes)) == 10
```

Run: `cd backend && pytest tests/iac/test_init_templates.py -v`
Expected: 2 passed。

- [ ] **Step 3: 提交**

```bash
git add backend/app/services/init_templates.py backend/tests/iac/test_init_templates.py
git commit -m "feat(rules): seed 3 IaC rule sets (10 rules) into system templates"
```

---

## Task 6: 启动扫描 API 支持 task_type=iac_scan

**Files:**
- Modify: `backend/app/api/v1/endpoints/projects.py:546-633` (start scan endpoint)

- [ ] **Step 1: 阅读现有 endpoint 结构**

Run: `sed -n '540,635p' backend/app/api/v1/endpoints/projects.py`
关注：`scan_request` 类型 `ScanRequest`，及 `background_tasks.add_task(scan_repo_task, ...)` 调用。

- [ ] **Step 2: 给 ScanRequest 加可选 task_type 字段**

找到 `class ScanRequest(BaseModel)` 定义（grep 定位：`grep -n "class ScanRequest" backend/app/api/v1/endpoints/projects.py`），追加字段：

```python
    task_type: Optional[str] = "repository"  # repository | iac_scan
```

- [ ] **Step 3: 在 endpoint 中分支调度**

将 `task_type="repository"` 行（约 570 行）改为：

```python
        task_type=(scan_request.task_type if scan_request and scan_request.task_type in {"repository", "iac_scan"} else "repository"),
```

并在文件顶部 import 区追加（与 `scan_repo_task` 同级）：

```python
from app.services.scanner import scan_iac_task  # 已有 scan_repo_task 的 import 处一并加
```

将 `background_tasks.add_task(scan_repo_task, ...)` 行（约 631 行）替换为：

```python
    if task.task_type == "iac_scan":
        background_tasks.add_task(scan_iac_task, task.id, AsyncSessionLocal, user_config)
    else:
        background_tasks.add_task(scan_repo_task, task.id, AsyncSessionLocal, user_config)
```

- [ ] **Step 4: 手工冒烟（curl）**

启动后端后执行（替换 `<TOKEN>` / `<PROJECT_ID>`）：

```bash
curl -X POST "http://localhost:8000/api/v1/projects/<PROJECT_ID>/scan" \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"task_type":"iac_scan","branch_name":"main"}'
```

Expected: 返回 `{"task_id":"...","status":"started"}`，随后查 `GET /api/v1/audit-tasks/<task_id>` 状态最终为 `completed`，issues_count ≥ 0。

> 若环境无可用项目，跳过此步骤，仅靠 Task 2/5 测试覆盖。

- [ ] **Step 5: 提交**

```bash
git add backend/app/api/v1/endpoints/projects.py
git commit -m "feat(api): support task_type=iac_scan in start-scan endpoint"
```

---

## Task 7: Sidebar 加 IaC 扫描入口

**Files:**
- Modify: `frontend/src/components/layout/Sidebar.tsx:52-55`

- [ ] **Step 1: 确认 Container 图标是否已导入**

Run: `grep -n "Container\|Box" frontend/src/components/layout/Sidebar.tsx | head -5`
若未导入 `Container`，则在 `import { ... } from "lucide-react"` 中追加 `Container,`。

- [ ] **Step 2: 修改 auditSubItems**

找到（约 52-55 行）：

```ts
const auditSubItems = [
  { path: "/audit-tasks?tab=regular", name: "快速审计", icon: <FileSearch className="h-[18px] w-[18px]" /> },
  { path: "/audit-tasks?tab=agent", name: "深度审计", icon: <Bot className="h-[18px] w-[18px]" /> },
];
```

改为：

```ts
const auditSubItems = [
  { path: "/audit-tasks?tab=regular", name: "快速审计", icon: <FileSearch className="h-[18px] w-[18px]" /> },
  { path: "/audit-tasks?tab=agent", name: "深度审计", icon: <Bot className="h-[18px] w-[18px]" /> },
  { path: "/audit-tasks?tab=iac", name: "IaC扫描", icon: <Container className="h-[18px] w-[18px]" /> },
];
```

- [ ] **Step 3: 启动前端冒烟**

Run: `cd frontend && npm run dev` 后浏览器访问，悬停「审计任务」，确认下拉菜单出现 3 项，最后一项为「IaC扫描」。

- [ ] **Step 4: 提交**

```bash
git add frontend/src/components/layout/Sidebar.tsx
git commit -m "feat(ui): add IaC scan entry to audit menu"
```

---

## Task 8: AuditTasks 页面支持 iac tab + 创建对话框

**Files:**
- Modify: `frontend/src/pages/AuditTasks.tsx` (TaskTab 类型、tab 解析、列表渲染、创建按钮)
- Create: `frontend/src/components/audit/CreateIacTaskDialog.tsx`

- [ ] **Step 1: 创建 CreateIacTaskDialog 组件**

`frontend/src/components/audit/CreateIacTaskDialog.tsx`：

```tsx
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { api } from "@/shared/config/database";
import { toast } from "sonner";

interface Project {
  id: string;
  name: string;
  default_branch?: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated?: (taskId: string) => void;
}

export default function CreateIacTaskDialog({ open, onOpenChange, onCreated }: Props) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState("");
  const [branch, setBranch] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    api.get("/projects").then(res => {
      const list: Project[] = res.data?.items ?? res.data ?? [];
      setProjects(list);
    }).catch(() => toast.error("加载项目失败"));
  }, [open]);

  const handleSubmit = async () => {
    if (!projectId) {
      toast.error("请选择项目");
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.post(`/projects/${projectId}/scan`, {
        task_type: "iac_scan",
        branch_name: branch || undefined,
      });
      toast.success("IaC 扫描任务已启动");
      onOpenChange(false);
      setProjectId("");
      setBranch("");
      onCreated?.(res.data?.task_id);
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || "启动失败");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="cyber-dialog border-border">
        <DialogHeader>
          <DialogTitle>新建 IaC 扫描</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>项目</Label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger><SelectValue placeholder="选择项目" /></SelectTrigger>
              <SelectContent className="cyber-dialog border-border">
                {projects.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>分支（可选，默认使用项目默认分支）</Label>
            <Input value={branch} onChange={e => setBranch(e.target.value)} placeholder="如 main" />
          </div>
          <p className="text-xs text-muted-foreground">
            将自动加载全部 IaC 规则集（容器镜像类 / 编排部署类 / CI/CD 类）对 Dockerfile、docker-compose、GitHub Actions 文件进行扫描。
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
          <Button onClick={handleSubmit} disabled={submitting}>{submitting ? "启动中..." : "开始扫描"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

> **若你的 `api` / `Dialog` / `Select` 路径与上面不同**，先 `grep -rn "api.post\|from \"@/shared/api\|from \"@/components/ui/dialog" frontend/src/pages/AuditTasks.tsx` 对齐项目实际写法再贴。

- [ ] **Step 2: 改 AuditTasks.tsx TaskTab 类型**

找到（约 35 行）：

```ts
type TaskTab = "regular" | "agent";
```

改为：

```ts
type TaskTab = "regular" | "agent" | "iac";
```

找到（约 40 行）：

```ts
const activeTab: TaskTab = searchParams.get("tab") === "agent" ? "agent" : "regular";
```

改为：

```ts
const activeTab: TaskTab = (() => {
  const t = searchParams.get("tab");
  if (t === "agent") return "agent";
  if (t === "iac") return "iac";
  return "regular";
})();
```

- [ ] **Step 3: 在 AuditTasks.tsx 增加 IaC tab 渲染**

在 import 区追加：

```ts
import CreateIacTaskDialog from "@/components/audit/CreateIacTaskDialog";
```

在组件 state 区追加：

```ts
const [iacDialogOpen, setIacDialogOpen] = useState(false);
```

在现有 `{activeTab === "regular" && ( ... )}` 块之后，追加：

```tsx
{activeTab === "iac" && (
  <div className="space-y-4">
    <div className="flex justify-between items-center">
      <h2 className="text-xl font-semibold">IaC 扫描任务</h2>
      <Button onClick={() => setIacDialogOpen(true)}>新建 IaC 扫描</Button>
    </div>
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-border">
          <th className="text-left py-2 px-3 font-medium">任务名 / 项目</th>
          <th className="text-left py-2 px-3 font-medium">状态</th>
          <th className="text-left py-2 px-3 font-medium">问题数</th>
          <th className="text-left py-2 px-3 font-medium">创建时间</th>
          <th className="text-left py-2 px-3 font-medium">操作</th>
        </tr>
      </thead>
      <tbody>
        {tasks.filter(t => t.task_type === "iac_scan").length === 0 ? (
          <tr><td colSpan={5} className="py-8 text-center text-muted-foreground">暂无 IaC 扫描任务</td></tr>
        ) : tasks.filter(t => t.task_type === "iac_scan").map(t => (
          <tr key={t.id} className="border-b border-border hover:bg-muted/30">
            <td className="py-2 px-3">{t.project_name || t.project_id}</td>
            <td className="py-2 px-3">{t.status}</td>
            <td className="py-2 px-3">{t.issues_count ?? 0}</td>
            <td className="py-2 px-3">{t.created_at}</td>
            <td className="py-2 px-3">
              <Link to={`/audit-tasks/${t.id}`} className="text-primary hover:underline">查看</Link>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
    <CreateIacTaskDialog
      open={iacDialogOpen}
      onOpenChange={setIacDialogOpen}
      onCreated={() => loadTasks?.()}
    />
  </div>
)}
```

> 若 `tasks` 列表数据结构字段名与上面不同（如 `project_name` 不存在），保持你项目里 `regular` tab 的渲染列结构即可，关键是用 `t.task_type === "iac_scan"` 做过滤。

- [ ] **Step 4: 启动验证**

Run: `cd frontend && npm run build`
Expected: 编译通过，无 TS 错误。然后浏览器访问 `/audit-tasks?tab=iac`：
1. 看到「新建 IaC 扫描」按钮
2. 点击 → 弹窗 → 选项目 → 启动 → toast 显示成功
3. 列表出现新行

- [ ] **Step 5: 提交**

```bash
git add frontend/src/pages/AuditTasks.tsx frontend/src/components/audit/CreateIacTaskDialog.tsx
git commit -m "feat(ui): add IaC scan tab and create dialog in audit tasks page"
```

---

## Task 9: AuditRules 静态规则页面加 IaC 类型

**Files:**
- Modify: `frontend/src/pages/AuditRules.tsx:73-93` (CATEGORY_ABBREV 与 RULE_TYPES)

- [ ] **Step 1: 修改 CATEGORY_ABBREV**

找到（约 73-77 行）：

```ts
const CATEGORY_ABBREV: Record<string, string> = {
  security: 'SEC',
  performance: 'PERF',
  quality: 'QLTY',
};
```

改为：

```ts
const CATEGORY_ABBREV: Record<string, string> = {
  security: 'SEC',
  performance: 'PERF',
  quality: 'QLTY',
  iac: 'IAC',
};
```

- [ ] **Step 2: 修改 RULE_TYPES**

找到（约 88-93 行）：

```ts
const RULE_TYPES = [
  { value: 'security', label: '漏洞规则' },
  { value: 'quality', label: '质量规则' },
  { value: 'performance', label: '性能规则' },
  { value: 'custom', label: '自定义规则' },
];
```

改为：

```ts
const RULE_TYPES = [
  { value: 'security', label: '漏洞规则' },
  { value: 'quality', label: '质量规则' },
  { value: 'performance', label: '性能规则' },
  { value: 'iac', label: 'IaC规则' },
  { value: 'custom', label: '自定义规则' },
];
```

- [ ] **Step 3: 验证**

Run: `cd frontend && npm run build`
Expected: 编译通过。

浏览器访问 `/audit-rules?tab=static`：
1. 「规则类型」筛选下拉新增 `IaC规则`
2. 选中后可看到 3 个预置规则集（`IaC规则-容器镜像类` 等），每个规则集展开可见对应规则
3. 单条规则可启用/禁用

- [ ] **Step 4: 提交**

```bash
git add frontend/src/pages/AuditRules.tsx
git commit -m "feat(ui): add IaC rule type to static rules page"
```

---

## Task 10: TaskDetail 渲染 IaC Tag

**Files:**
- Modify: `frontend/src/pages/TaskDetail.tsx` (issue 列表渲染处)

- [ ] **Step 1: 定位 issue 行渲染处**

Run: `grep -n "issue_type\|issues.map\|severity" frontend/src/pages/TaskDetail.tsx | head -20`
找到渲染单条 issue 的 JSX 块（通常包含 severity badge 渲染）。

- [ ] **Step 2: 在 severity badge 旁加 IaC tag**

在渲染 issue 行的位置，找到 severity 显示附近，追加：

```tsx
{issue.issue_type === "iac" && (
  <Badge className="bg-violet-500/20 text-violet-300 border-violet-500/40 ml-2">IaC</Badge>
)}
```

> 若 `Badge` 未 import，从 `@/components/ui/badge` 引入。  
> 若现有代码使用 `cyber-badge` 等自定义 className，沿用之，仅把背景色改为紫色调（项目内可能用 `bg-violet-500/20`）。

- [ ] **Step 3: 验证**

Run: `cd frontend && npm run build`
Expected: 编译通过。

浏览器：
1. 完成一次 IaC 扫描任务
2. 打开任务详情 → issue 列表中每条都出现紫色 `IaC` Tag

- [ ] **Step 4: 提交**

```bash
git add frontend/src/pages/TaskDetail.tsx
git commit -m "feat(ui): render IaC tag on iac-typed issues in task detail"
```

---

## Task 11: 端到端冒烟与最终验收

- [ ] **Step 1: 后端单元测试全跑**

Run: `cd backend && pytest tests/iac/ -v`
Expected: 全部通过（Task 2 的 11 个 + Task 4 的 1 个 + Task 5 的 2 个 = 共 14 个）。

- [ ] **Step 2: 前端构建**

Run: `cd frontend && npm run build`
Expected: 0 error。

- [ ] **Step 3: 手工端到端**

1. 登录 → 顶部「审计任务 ▾」可见「IaC扫描」
2. 进入「IaC扫描」→ 新建 → 选已有项目（包含 Dockerfile 或 docker-compose 或 workflows） → 启动
3. 等任务完成（status=completed）
4. 打开任务详情，issue 列表每条都有紫色 `IaC` Tag，描述与建议来自规则
5. 顶部「审计规则 → 静态规则」→ 类型筛选 `IaC规则` → 见 3 个规则集，共 10 条规则

- [ ] **Step 4: 最终验收提交（如无遗留改动则跳过）**

```bash
git status
# 如果干净则直接进入下一阶段；否则补一个收尾 commit
```

---

## 完成检查清单

- [ ] `rules/semgrep/iac-rules.yml` 10 条规则全部通过 `semgrep --validate`
- [ ] `backend/tests/iac/` 全部测试通过
- [ ] 3 个 IaC 规则集已可见于「审计规则 → 静态规则」
- [ ] 顶部「审计任务 ▾」可见「IaC扫描」入口
- [ ] 可成功创建 IaC 任务、扫描完成、issue 列表展示紫色 IaC Tag
- [ ] 现有 `repository`/`agent_audit`/`zip_upload` 任务流程未受影响
