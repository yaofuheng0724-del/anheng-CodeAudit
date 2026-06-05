# IaC 基础设施即代码扫描 设计文档

- 日期: 2026-06-03
- 作者: jinxiaodong / Claude
- 状态: 待评审

## 1. 背景与目标

DeepAudit 当前以应用源码审计为主，缺少对基础设施即代码 (IaC) 资产的安全检测能力。本期以"最小可用"为原则，新增对 **Dockerfile、docker-compose、GitHub Actions 工作流** 三类 IaC 文件的静态规则扫描，让用户能够：

1. 在「审计任务」下独立发起 IaC 扫描，并查看结果。
2. 在「审计规则 → 静态规则」下查看和管理 IaC 规则集 / 规则。

不引入新扫描引擎、不新增数据表，复用现有 Semgrep + AuditTask + AuditIssue 链路。

## 2. 设计原则

- **复用优先**：扫描器、任务模型、Issue 模型、Sidebar 框架、规则页面全部复用。
- **简化交互**：用户发起 IaC 扫描时不需要选择规则集，系统自动加载所有 IaC 规则集。
- **范围克制**：首版只覆盖 3 类共 10 条规则，不做 Terraform / K8s / Helm / GitLab CI 等扩展。
- **可见性**：通过菜单入口 + 静态规则页面里的 `IaC规则` 类型双重曝光。

## 3. 用户故事

**US-1 发起 IaC 扫描（菜单入口）**
作为用户，我希望在「审计任务 ▾」下拉里点击「IaC 扫描」，能看到 IaC 扫描任务列表，并能为某个项目一键发起 IaC 扫描，无需手动选规则集。

**US-2 查看 IaC 扫描结果**
作为用户，我希望 IaC 扫描完成后，能在任务详情页查看每条 Issue（含文件路径、行号、规则 ID、修复建议），并能直观识别出该 Issue 属于 IaC 类（紫色 `IaC` Tag）。

**US-3 管理 IaC 规则**
作为规则维护者，我希望在「审计规则 → 静态规则」页面，能用「规则类型」筛选出所有 `IaC规则`，看到 3 个预置规则集（容器镜像类 / 编排部署类 / CI/CD 类），并能启用/禁用单条规则。


## 4. 总体架构

```
┌──────────────────────── 前端 ────────────────────────┐
│ Sidebar.auditSubItems                                │
│   快速审计 | 深度审计 | IaC扫描 ★新增                │
│                                                      │
│ /audit-tasks?tab=iac      /audit-rules?tab=static    │
│   ├ IaC 任务列表           ├ 规则类型筛选含 IaC规则  │
│   └ 创建 IaC 任务对话框    └ 3 个预置 IaC 规则集     │
└──────────────────┬───────────────────────────────────┘
                   │ POST /audit-tasks  task_type=iac
                   ▼
┌──────────────────────── 后端 ────────────────────────┐
│ scanner.start_iac_scan(task_id)                      │
│   ├ 收集 IaC 文件 (Dockerfile/compose/workflows)     │
│   ├ run_semgrep_scan(rules=iac-rules.yml)            │
│   └ 归一化 → AuditIssue(category="iac")              │
│                                                      │
│ init_templates 预置 3 个 rule_type="iac" 的规则集    │
└──────────────────────────────────────────────────────┘
```

## 5. 详细设计

### 5.1 后端改动

#### 5.1.1 规则类型枚举扩展

- `app/schemas/audit_rule.py`（或对应 schema）：`rule_type` 校验放行 `iac`。
- `app/models/audit_rule.py`：`AuditRuleSet.rule_type` 已是 `String(50)`，无需迁移。

#### 5.1.2 预置规则集

修改 `app/services/init_templates.py`，新增 3 个 `rule_type="iac"` 的规则集（详见 §6 规则清单）。系统启动 / 首次初始化时写入。

#### 5.1.3 Semgrep 规则文件

新建 `rules/semgrep/iac-rules.yml`，包含 10 条规则。每条规则 metadata 字段：

```yaml
metadata:
  category: iac
  iac_target: dockerfile | compose | github_actions
  rule_code: IAC-CTR-001  # 与数据库 rule_code 对齐
```

#### 5.1.4 IaC 扫描任务

在 `app/services/scanner.py` 新增 `start_iac_scan(task_id)`：

- 复用 `quick_scan` 的文件收集与 Semgrep 调用流程。
- 文件白名单：`Dockerfile`、`*.dockerfile`、`docker-compose*.y?ml`、`compose.y?ml`、`.github/workflows/*.y?ml`。
- Semgrep `--config` 指向 `rules/semgrep/iac-rules.yml`（**只跑 IaC 规则**，不跑应用代码规则）。
- 不调用 LLM 二次研判，直接落 Issue。
- Issue 的 `category` 字段写入 `"iac"`。

#### 5.1.5 API

`app/api/v1/endpoints/audit_tasks.py`：

- `POST /audit-tasks` 入参增加可选字段 `task_type: "regular" | "iac"`（默认 `regular`）。
- 任务模型 `AuditTask` 增加 `task_type` 字段（已有的可复用，否则加 `String(20)`）。
- 列表接口 `GET /audit-tasks` 支持 `task_type` 过滤。

### 5.2 前端改动

#### 5.2.1 Sidebar

`frontend/src/components/layout/Sidebar.tsx`：

```ts
const auditSubItems = [
  { path: "/audit-tasks?tab=regular", name: "快速审计", icon: <FileSearch /> },
  { path: "/audit-tasks?tab=agent",   name: "深度审计", icon: <Bot /> },
  { path: "/audit-tasks?tab=iac",     name: "IaC扫描",  icon: <Container /> }, // ★新增
];
```

#### 5.2.2 AuditTasks 页面

`frontend/src/pages/AuditTasks.tsx`：

- `TaskTab = "regular" | "agent" | "iac"`
- 新增 `iac` 分支：复用 `regular` 的表格结构（任务名 / 项目 / 状态 / 创建时间 / 操作）。
- 新增 `CreateIacTaskDialog`：仅需选择「项目」+「分支（可选）」，无规则集选择 UI，提交时调用 `POST /audit-tasks { task_type: "iac" }`。
- 任务行的"查看详情"跳转到现有 `/audit-tasks/:id` 详情页（复用）。

#### 5.2.3 AuditRules 页面

`frontend/src/pages/AuditRules.tsx`：

```ts
const RULE_TYPES = [
  { value: 'security',    label: '漏洞规则' },
  { value: 'quality',     label: '质量规则' },
  { value: 'performance', label: '性能规则' },
  { value: 'iac',         label: 'IaC规则' },  // ★新增
  { value: 'custom',      label: '自定义规则' },
];

const CATEGORY_ABBREV: Record<string, string> = {
  security: 'SEC', performance: 'PERF', quality: 'QLTY',
  iac: 'IAC',  // ★新增
};
```

#### 5.2.4 Issue 列表 IaC 标签

任务详情页（已有）的 issue 表格里，当 `issue.category === "iac"` 时额外渲染一个紫色 `IaC` Tag，使用现有 `cyber-badge` 样式。


## 6. 预置规则集与规则清单

### 6.1 IaC规则-容器镜像类 (`IaC-Container`)

| rule_code | 名称 | 严重级别 | 检测对象 |
|---|---|---|---|
| IAC-CTR-001 | 镜像以 root 用户运行 | medium | Dockerfile 无 `USER` 指令或 `USER root` |
| IAC-CTR-002 | 镜像使用 `:latest` 标签 | medium | `FROM xxx:latest` 或无 tag |
| IAC-CTR-003 | Dockerfile 使用 `ADD` 远程 URL | medium | `ADD http(s)://...` |
| IAC-CTR-004 | Dockerfile 使用 `curl \| sh` 模式 | high | `RUN curl ... \| sh` / `wget ... \| bash` |

### 6.2 IaC规则-编排部署类 (`IaC-Orchestration`)

| rule_code | 名称 | 严重级别 | 检测对象 |
|---|---|---|---|
| IAC-ORC-001 | 容器以 privileged 模式运行 | high | compose `privileged: true` |
| IAC-ORC-002 | 服务使用主机网络 | medium | compose `network_mode: host` |
| IAC-ORC-003 | 容器挂载 Docker socket | high | compose volumes 含 `/var/run/docker.sock` |

### 6.3 IaC规则-CI/CD类 (`IaC-CICD`)

| rule_code | 名称 | 严重级别 | 检测对象 |
|---|---|---|---|
| IAC-CI-001 | pull_request_target 触发器 checkout PR 代码 | high | workflow 同时含 `on.pull_request_target` 和 checkout PR head |
| IAC-CI-002 | 引用的 Action 未固定 commit SHA | medium | `uses: org/action@v1` 或 `@main`（非 40 位 SHA） |
| IAC-CI-003 | secrets 直接出现在 run 脚本中 | high | `run:` 块内含 `${{ secrets.* }}` |

每条规则在数据库中包含：`rule_code`、`name`、`description`、`category=security`、`severity`、`fix_suggestion`、`reference_url`、`enabled=true`，与现有规则结构一致。

## 7. 数据模型变更

| 表 / 字段 | 变更 | 说明 |
|---|---|---|
| `audit_rule_sets.rule_type` | 不变（已是 `String(50)`） | 新增枚举值 `iac` 由 schema 层放行 |
| `audit_tasks.task_type` | 新增 `String(20) default='regular'` | 若已存在则复用 |
| `audit_issues.category` | 不变 | 新增取值 `iac` |

不需要 Alembic 大改，至多一条小迁移加 `task_type` 字段（若尚未存在）。

## 8. 文件命中规则（IaC 文件识别）

扫描时仅对以下文件投递到 IaC Semgrep 规则集：

- `**/Dockerfile`、`**/Dockerfile.*`、`**/*.dockerfile`
- `**/docker-compose.yml`、`**/docker-compose.*.yml`、`**/compose.yml`、`**/compose.yaml`
- `**/.github/workflows/*.yml`、`**/.github/workflows/*.yaml`

其他文件不参与本任务的 Semgrep 调用，避免误报与开销。

## 9. 不在本期范围 (Out of Scope)

- ❌ Terraform / Kubernetes manifests / Helm Chart / CloudFormation / Pulumi
- ❌ GitLab CI / Jenkinsfile / CircleCI / Drone
- ❌ 合规框架映射（CIS Benchmark、PCI-DSS、SOC2）
- ❌ LLM 二次研判 / 自动修复 PR
- ❌ IaC 专属仪表盘卡片 / 独立报告模板

## 10. 测试要点

- `tests/iac/fixtures/`：每条规则放 1 个 positive sample + 1 个 negative sample。
- 后端集成测试：跑一遍 fixtures 目录，断言命中数 = 10、`category` 均为 `iac`。
- 前端：手工验收 §3 三条用户故事。

## 11. 工作量预估

| 模块 | 预估 |
|---|---|
| Semgrep 规则文件 (10 条 + fixtures) | ~4h |
| 后端：rule_type 放行 + 预置规则集 + scan 分支 + API | ~3h |
| 前端：Sidebar + AuditTasks 新 tab + 创建对话框 + RULE_TYPES | ~3h |
| 联调与测试 | ~2h |
| **合计** | **~1.5 个工作日** |

## 12. 后续可扩展方向（非本期）

- 增加 Terraform / K8s / Helm 规则类（沿用同一架构，再加规则集即可）
- 在仪表盘添加「IaC 风险卡片」
- 与 RAG / Agent 联动，让 IaC 问题进入深度审计上下文
