# 代码结构分析「分批加载」根治实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将后端 `GET /tasks/{id}/code-analysis` 单个大 JSON 响应拆分为按小节懒加载，消除因单次传输数百 MB JSON 导致的 axios 30s 超时/浏览器 OOM 问题。

**Architecture:**
- 后端使用 PostgreSQL JSONB 路径提取 (`column->'key'`) 按需读取子文档，避免加载整列
- 新增 `summary` 端点仅返回各小节计数（轻量级），前端首次渲染只调用 summary
- 前端面板的 4 个小节（API资产/调用图/依赖关系/控制流）各自独立请求，点击标题时才加载对应数据
- `AgentTask` 侧也同步改造，共享工具函数

**Tech Stack:** FastAPI + PostgreSQL JSONB → SQLAlchemy raw SQL → Axios + React

---

### 文件清单

| 操作 | 文件 | 说明 |
|------|------|------|
| 修改 | `backend/app/api/v1/endpoints/tasks.py` | 拆分 `/tasks/{id}/code-analysis` |
| 修改 | `backend/app/api/v1/endpoints/agent_tasks.py` | 拆分 `/agent-tasks/{id}/code-analysis` |
| 修改 | `frontend/src/components/code-analysis/CodeAnalysisPanel.tsx` | 懒加载每节数据 |
| 修改 | `frontend/src/components/code-analysis/types.ts` | 添加 `SectionSummary` 类型 |
| 修改 | `frontend/src/pages/TaskDetail.tsx` | API assets 改用 section 端点 |
| 新增 | `backend/tests/test_code_analysis_endpoints.py` | 新端点测试 |

---

### Task 1: 后端 — 创建共享 JSONB 提取工具函数

**Files:**
- Modify: `backend/app/api/v1/endpoints/tasks.py` (新增函数)
- 不改他文件，新函数放在 tasks.py 顶部

背后原理：`audit_tasks` 和 `agent_tasks` 两个表的 `code_analysis_results` JSONB 列结构相同，两个路由需要同样的提取逻辑。

- [ ] **Step 1: 添加 get_section_counts 辅助函数**

在 `tasks.py` 的 import 区域后（`from app.services.ai_investigation import ...` 那行之后）添加：

```python
# ── 代码分析结果分批加载 ──────────────────────────────────────────
# 这两个函数通过 PostgreSQL JSON->jsonb cast + 路径提取按需读取子文档，
# 避免将数百 MB 的 code_analysis_results 整列加载到内存。

import json
from sqlalchemy import text   # ← 如果 tasks.py 顶部已 import 则此行不需要
from app.models.agent_task import AgentTask   # ← 同上

# 表名映射：用于构建 raw SQL
_CODE_ANALYSIS_TABLES = {
    "audit_task": ("audit_tasks", "id"),
    "agent_task": ("agent_tasks", "id"),
}


async def _get_code_analysis_summary(
    db: AsyncSession, task_id: str, *, task_table: str = "audit_tasks"
) -> dict:
    """仅返回各小节计数（轻量级请求，DB 端只扫描 JSON 顶层键的数组长度）。
    
    返回: { api_endpoints: int, call_graph: int, file_dependencies: int, control_flow_files: int }
    
    注意：表的列类型是 JSON 不是 JSONB（见 app/models/audit.py），所以要 cast 成 jsonb
    才能用 jsonb_array_length / jsonb_object_keys。这步 cast 比加载整列快几个数量级。
    """
    sql = text(f"""
        SELECT
            jsonb_array_length(COALESCE((code_analysis_results::jsonb)->'api_endpoints','[]'::jsonb))       AS api_endpoints,
            jsonb_array_length(COALESCE((code_analysis_results::jsonb)->'call_graph','[]'::jsonb))            AS call_graph,
            jsonb_array_length(COALESCE((code_analysis_results::jsonb)->'file_dependencies','[]'::jsonb))     AS file_dependencies,
            COALESCE(
                (SELECT count(*) FROM jsonb_object_keys(COALESCE((code_analysis_results::jsonb)->'control_flow','{{}}'::jsonb))),
                0
            )::int                                                                                            AS control_flow_files
        FROM {task_table}
        WHERE id = :task_id
    """)
    row = await db.execute(sql, {"task_id": task_id})
    row = row.one_or_none()
    if not row:
        return {}
    return {
        "api_endpoints": row.api_endpoints if row.api_endpoints is not None else 0,
        "call_graph": row.call_graph if row.call_graph is not None else 0,
        "file_dependencies": row.file_dependencies if row.file_dependencies is not None else 0,
        "control_flow_files": row.control_flow_files if row.control_flow_files is not None else 0,
    }


async def _get_code_analysis_section(
    db: AsyncSession,
    task_id: str,
    section: str,
    *,
    task_table: str = "audit_tasks",
) -> Optional[Any]:
    """使用 JSONB 路径提取(code_analysis_results -> :section)返回该子文档。
    
    支持的 section 值: api_endpoints | call_graph | file_dependencies | control_flow
    
    返回反序列化后的 Python 对象，或 None（任务不存在/无数据）。
    """
    # 使用 -> 而非 ->> ：-> 返回 jsonb（驱动会自动反序列化为 Python 对象），
    # ->> 会返回 text 字符串需要手动 json.loads。
    # 注意：section 名直接拼到 SQL 而非参数绑定，因为 -> 不支持参数化的字段名；
    # 调用方必须保证 section 在白名单内（端点已有校验）。
    if section not in ("api_endpoints", "call_graph", "file_dependencies", "control_flow"):
        return None
    sql = text(f"""
        SELECT (code_analysis_results::jsonb)->'{section}' AS value
        FROM {task_table}
        WHERE id = :task_id
    """)
    row = await db.execute(sql, {"task_id": task_id})
    row = row.one_or_none()
    if not row or row.value is None:
        return None
    # psycopg/asyncpg 的 jsonb 列已自动反序列化为 Python 对象
    return row.value


async def _verify_task_access(
    db: AsyncSession, task_id: str, current_user_id: str, *, task_table: str = "audit_tasks"
) -> bool:
    """检查任务是否存在且当前用户有权限访问。
    
    Returns True 表示通过；抛出 HTTPException 表示拒绝。
    """
    # 判断是哪张表
    model_cls = AuditTask if task_table == "audit_tasks" else AgentTask
    
    task = await db.get(model_cls, task_id, options=[selectinload(model_cls.project)])
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    if task.project and task.project.owner_id != current_user_id:
        raise HTTPException(status_code=403, detail="无权访问此任务")
    return True
```

注意：这里 `AgentTask` 需要 import，确认 tasks.py 中已有或添加：
```python
from app.models.agent_task import AgentTask
```

- [ ] **Step 2: 运行已有测试确保没有 regression**

```bash
cd /home/test/DeepAudit/backend
python -m pytest tests/test_api_tasks.py -v --no-header -q 2>&1 | tail -20
```

Expected: 全部 PASS

- [ ] **Step 3: Commit**

```bash
cd /home/test/DeepAudit
git add backend/app/api/v1/endpoints/tasks.py
git commit -m "refactor(code-analysis): add shared JSONB lazy-load helpers for code_analysis_results

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: 后端 — 重构 tasks.py 的代码分析端点

**Files:**
- Modify: `backend/app/api/v1/endpoints/tasks.py`

把 `get_code_analysis` 替换为 3 个新端点 + 保留旧端点(带废弃标记和安全兜底)。

- [ ] **Step 1: 新增 /tasks/{id}/code-analysis/summary 端点**

```python
@router.get("/{task_id}/code-analysis/summary")
async def get_code_analysis_summary(
    task_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """获取代码分析结果各小节计数（轻量级，用于前端分批加载）"""
    await _verify_task_access(db, task_id, current_user.id)
    summary = await _get_code_analysis_summary(db, task_id)
    return summary
```

- [ ] **Step 2: 新增 /tasks/{id}/code-analysis/{section} 端点**

```python
@router.get("/{task_id}/code-analysis/{section}")
async def get_code_analysis_section(
    task_id: str,
    section: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """获取代码分析结果的某一小节（api_endpoints / call_graph / file_dependencies / control_flow）"""
    if section not in ("api_endpoints", "call_graph", "file_dependencies", "control_flow"):
        raise HTTPException(status_code=400, detail=f"不支持的 section: {section}")

    await _verify_task_access(db, task_id, current_user.id)
    data = await _get_code_analysis_section(db, task_id, section)
    if data is None:
        # 空默认值
        defaults = {
            "api_endpoints": [],
            "call_graph": [],
            "file_dependencies": [],
            "control_flow": {},
        }
        return defaults.get(section, [])
    return data
```

- [ ] **Step 3: 改造旧的 `get_code_analysis` 端点（兼容兜底 + 废弃标记）**

把 325-346 行的旧端点替换为：

```python
@router.get("/{task_id}/code-analysis")
async def get_code_analysis(
    task_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """【已废弃】获取快速审计任务的完整代码分析结果。
    
    为避免超大响应导致超时/浏览器 OOM，请改用：
      - GET /tasks/{id}/code-analysis/summary  — 获取各小节计数
      - GET /tasks/{id}/code-analysis/{section} — 按需获取各小节数据
    """
    await _verify_task_access(db, task_id, current_user.id)

    # 使用 SQL 路径提取方式仍比 ORM 加载整列安全，但仍会返回完整结构
    data = await _get_code_analysis_section(db, task_id, "api_endpoints") or []
    call_data = await _get_code_analysis_section(db, task_id, "call_graph") or []
    deps_data = await _get_code_analysis_section(db, task_id, "file_dependencies") or []
    cfg_data = await _get_code_analysis_section(db, task_id, "control_flow") or {}

    return {
        "api_endpoints": data,
        "call_graph": call_data,
        "file_dependencies": deps_data,
        "control_flow": cfg_data,
    }
```

- [ ] **Step 4: 添加 `AgentTask` import（如果还没有）**

检查文件顶部 imports 中是否有 `from app.models.agent_task import AgentTask`，如果没有则添加在 `from app.models.audit import AuditTask, AuditIssue` 旁边：

```python
from app.models.audit import AuditTask, AuditIssue
from app.models.agent_task import AgentTask
```

- [ ] **Step 5: Run tests**

```bash
cd /home/test/DeepAudit/backend
python -m pytest tests/test_api_tasks.py -v --no-header -q 2>&1 | tail -20
```

Expected: 全部 PASS

- [ ] **Step 6: Commit**

```bash
cd /home/test/DeepAudit
git add backend/app/api/v1/endpoints/tasks.py
git commit -m "feat(code-analysis): add per-section JSONB endpoints for tasks

- GET /tasks/{id}/code-analysis/summary — lightweight counts
- GET /tasks/{id}/code-analysis/{section} — one section at a time
- old full endpoint kept for backward compat

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: 后端 — 同步改造 agent_tasks.py

**Files:**
- Modify: `backend/app/api/v1/endpoints/agent_tasks.py`

对路由 `/agent-tasks/{id}/code-analysis` 做同样的拆分。

- [ ] **Step 1: 添加 import + 利用共享函数**

在 agent_tasks.py 顶部 import 区域添加：
```python
from app.api.v1.endpoints.tasks import (
    _get_code_analysis_summary,
    _get_code_analysis_section,
    _verify_task_access as _verify_agent_task_access,
)
```

- [ ] **Step 2: 替换旧的 `get_code_analysis` 端点（约 2283-2303 行）**

```python
@router.get("/{task_id}/code-analysis/summary")
async def get_agent_code_analysis_summary(
    task_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """获取深度审计任务代码分析各小节计数"""
    await _verify_agent_task_access(db, task_id, current_user.id, task_table="agent_tasks")
    return await _get_code_analysis_summary(db, task_id, task_table="agent_tasks")


@router.get("/{task_id}/code-analysis/{section}")
async def get_agent_code_analysis_section(
    task_id: str,
    section: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """获取深度审计任务代码分析某一小节"""
    if section not in ("api_endpoints", "call_graph", "file_dependencies", "control_flow"):
        raise HTTPException(status_code=400, detail=f"不支持的 section: {section}")

    await _verify_agent_task_access(db, task_id, current_user.id, task_table="agent_tasks")
    data = await _get_code_analysis_section(db, task_id, section, task_table="agent_tasks")
    if data is None:
        defaults = {
            "api_endpoints": [],
            "call_graph": [],
            "file_dependencies": [],
            "control_flow": {},
        }
        return defaults.get(section, [])
    return data


@router.get("/{task_id}/code-analysis")
async def get_agent_code_analysis(
    task_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """【已废弃】获取深度审计任务完整代码分析结果。改用 summary + section 端点。"""
    await _verify_agent_task_access(db, task_id, current_user.id, task_table="agent_tasks")

    api = await _get_code_analysis_section(db, task_id, "api_endpoints", task_table="agent_tasks") or []
    calls = await _get_code_analysis_section(db, task_id, "call_graph", task_table="agent_tasks") or []
    deps = await _get_code_analysis_section(db, task_id, "file_dependencies", task_table="agent_tasks") or []
    cfg = await _get_code_analysis_section(db, task_id, "control_flow", task_table="agent_tasks") or {}

    return {
        "api_endpoints": api,
        "call_graph": calls,
        "file_dependencies": deps,
        "control_flow": cfg,
    }
```

- [ ] **Step 3: 确认 `_verify_task_access` 导入的 `AgentTask` 不会在 tasks.py 里引起循环依赖**

检查 tasks.py 中是否已经 import `agent_tasks` 相关。如果有 `from app.api.v1.endpoints import agent_tasks` 那就可能循环了。实际检查一下：

```bash
grep -n "agent_task\|AgentTask" /home/test/DeepAudit/backend/app/api/v1/endpoints/tasks.py | head -5
```

Expected: 只 import `from app.models.agent_task import AgentTask`，没有导入 agent_tasks 路由模块。安全。

- [ ] **Step 4: Commit**

```bash
cd /home/test/DeepAudit
git add backend/app/api/v1/endpoints/agent_tasks.py
git commit -m "feat(code-analysis): add per-section JSONB endpoints for agent_tasks

- same pattern as tasks endpoints for consistency

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: 前端 — 重构 CodeAnalysisPanel 实现懒加载

**Files:**
- Modify: `frontend/src/components/code-analysis/CodeAnalysisPanel.tsx`
- Modify: `frontend/src/components/code-analysis/types.ts`

组件初始化只加载 summary（请求轻量级计数），点击标题时才加载对应小节数据。

- [ ] **Step 1: 在 types.ts 中添加 SectionSummary 类型**

在 `CodeAnalysisResult` 接口后添加：

```typescript
/** 后端 /summary 端点返回的各小节计数 */
export interface SectionSummary {
  api_endpoints: number;
  call_graph: number;
  file_dependencies: number;
  control_flow_files: number;
}
```

- [ ] **Step 2: 彻底重构 CodeAnalysisPanel.tsx**

用以下完整实现替换原文件：

```tsx
// frontend/src/components/code-analysis/CodeAnalysisPanel.tsx

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, FileCode, GitBranch, Globe, Network } from 'lucide-react';

import { apiClient } from '@/shared/api/serverClient';

import { APIAssetsList } from './APIAssetsList';
import { CallGraphTree } from './CallGraphTree';
import { ControlFlowTree } from './ControlFlowTree';
import { FileDepsTree } from './FileDepsTree';
import {
  toApiView,
  toCallGraphView,
  toControlFlowView,
  toFileDepsView,
} from './adapters';
import type { CodeAnalysisResult, SectionSummary } from './types';

interface Props {
  taskId: string;
  taskType: 'quick' | 'agent';
  /** 隐藏 API 接口资产那一栏（在外部 Tab 里单独展示时使用） */
  hideApi?: boolean;
}

interface SectionState {
  key: string;
  title: string;
  icon: typeof Globe;
  /** summary 端点的字段名，用于提取计数 */
  countField: keyof SectionSummary;
  /** section 端点的路径片段 */
  sectionPath: string;
}

const SECTIONS: SectionState[] = [
  { key: 'api', title: 'API 接口资产', icon: Globe, countField: 'api_endpoints', sectionPath: 'api_endpoints' },
  { key: 'call', title: '函数调用图', icon: Network, countField: 'call_graph', sectionPath: 'call_graph' },
  { key: 'deps', title: '文件包含关系', icon: FileCode, countField: 'file_dependencies', sectionPath: 'file_dependencies' },
  { key: 'cfg', title: '函数控制流图', icon: GitBranch, countField: 'control_flow_files', sectionPath: 'control_flow' },
];

export function CodeAnalysisPanel({ taskId, taskType, hideApi = false }: Props) {
  const [summary, setSummary] = useState<SectionSummary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  // 各小节已加载的数据：key -> { data: unknown, loading: boolean, error: string | null }
  type SectionData = Record<string, {
    data: unknown;
    loading: boolean;
    error: string | null;
  }>;
  const [sectionData, setSectionData] = useState<SectionData>({});

  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const basePath = taskType === 'quick' ? '/tasks' : '/agent-tasks';

  // ── 加载 summary（仅启动时一次） ──
  useEffect(() => {
    setLoadingSummary(true);
    apiClient
      .get(`${basePath}/${taskId}/code-analysis/summary`)
      .then((res) => {
        setSummary(res.data as SectionSummary);
        setLoadingSummary(false);
      })
      .catch((err) => {
        console.error('Failed to load code analysis summary:', err);
        setSummaryError('加载失败');
        setLoadingSummary(false);
      });
  }, [basePath, taskId]);

  // ── 切换折叠：展开时若该小节未加载则触发按需加载 ──
  const toggleSection = useCallback((sectionKey: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(sectionKey)) {
        next.delete(sectionKey);
      } else {
        next.add(sectionKey);
        // 异步：如果该小节还没加载过，触发加载
        setSectionData((prevData) => {
          if (prevData[sectionKey]) return prevData; // 已加载过或用 loading 中
          const sec = SECTIONS.find((s) => s.key === sectionKey);
          if (!sec) return prevData;

          // 触发加载
          apiClient
            .get(`${basePath}/${taskId}/code-analysis/${sec.sectionPath}`)
            .then((res) => {
              setSectionData((d) => ({
                ...d,
                [sectionKey]: { data: res.data, loading: false, error: null },
              }));
            })
            .catch((err) => {
              console.error(`Failed to load section ${sec.sectionPath}:`, err);
              setSectionData((d) => ({
                ...d,
                [sectionKey]: { data: null, loading: false, error: '加载失败' },
              }));
            });

          return { ...prevData, [sectionKey]: { data: null, loading: true, error: null } };
        });
      }
      return next;
    });
  }, [basePath, taskId]);

  // ── 渲染状态 ──
  if (loadingSummary) return <div className="p-4 text-muted-foreground">加载中...</div>;
  if (summaryError) return <div className="p-4 text-destructive">{summaryError}</div>;
  if (!summary) return <div className="p-4 text-muted-foreground">暂无数据</div>;

  const visibleSections = SECTIONS.filter((s) => !(hideApi && s.key === 'api'));

  return (
    <div className="cyber-card p-4 h-full overflow-auto">
      <h3 className="text-sm font-bold uppercase mb-3 text-foreground">代码结构分析</h3>

      <div className="space-y-2">
        {visibleSections.map((section) => {
          const open = expanded.has(section.key);
          const data = sectionData[section.key];
          const count = summary[section.countField];

          return (
            <div key={section.key} className="border border-border rounded">
              <button
                className="w-full flex items-center justify-between p-2 text-sm hover:bg-muted/50"
                onClick={() => toggleSection(section.key)}
              >
                <div className="flex items-center gap-2">
                  {open ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                  <section.icon className="w-4 h-4 text-primary" />
                  <span className="font-medium">{section.title}</span>
                </div>
                <span className="text-muted-foreground text-xs bg-muted px-2 py-0.5 rounded">
                  {count}
                </span>
              </button>

              {open && (
                <div className="p-2 border-t border-border">
                  {!data || data.loading ? (
                    <div className="text-muted-foreground text-xs py-2">加载中...</div>
                  ) : data.error ? (
                    <div className="text-destructive text-xs py-2">{data.error}</div>
                  ) : (
                    <>
                      {section.key === 'api' && (
                        <APIAssetsList data={Array.isArray(data.data) ? data.data : []} />
                      )}
                      {section.key === 'call' && (
                        <CallGraphTree data={Array.isArray(data.data) ? data.data : []} />
                      )}
                      {section.key === 'deps' && (
                        <FileDepsTree data={Array.isArray(data.data) ? data.data : []} />
                      )}
                      {section.key === 'cfg' && (
                        <ControlFlowTree data={data.data ?? {}} />
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

注意：这里不再导出 `counts` 给外部使用。如果外部组件需要 API 资产的计数，需要单独处理。

- [ ] **Step 3: Commit**

```bash
cd /home/test/DeepAudit
git add frontend/src/components/code-analysis/CodeAnalysisPanel.tsx frontend/src/components/code-analysis/types.ts
git commit -m "feat(frontend): lazy-load code analysis sections on expand

- only load summary (counts) on mount
- fetch section data on first expand click
- each of the 4 sections loads independently

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: 前端 — 更新 TaskDetail.tsx 中的 API 资产请求

**Files:**
- Modify: `frontend/src/pages/TaskDetail.tsx`

`TaskDetail.tsx:268` 在加载 API 资产 Tab 时使用了旧的全量端点 `/tasks/${id}/code-analysis`，改为只请求 `api_endpoints` 小节。

- [ ] **Step 1: 修改 TaskDetail.tsx 第 252-274 行的 useEffect**

```tsx
  // 加载 API 资产（独立加载，不阻塞主流程）
  // IaC 任务无代码资产概念，跳过此请求；
  // 编译产物扫描（scan_mode === "compiled"）也没有 API 资产可剖析，跳过。
  useEffect(() => {
    if (!id || task?.task_type === 'iac_scan') return;
    // 与下方 isCompiledScan 同一信号源：优先看 project.scan_mode，回退看 task.scan_config.scan_mode
    let scanModeFromConfig: string | undefined;
    try {
      scanModeFromConfig = task?.scan_config
        ? (JSON.parse(task.scan_config) as { scan_mode?: string }).scan_mode
        : undefined;
    } catch {
      scanModeFromConfig = undefined;
    }
    const compiled = task?.project?.scan_mode
      ? task.project.scan_mode === 'compiled'
      : scanModeFromConfig === 'compiled';
    if (compiled) return;
    apiClient
      .get(`/tasks/${id}/code-analysis/api_endpoints`)
      .then((res) => {
        setApiEndpoints(Array.isArray(res.data) ? res.data : []);
      })
      .catch(() => setApiEndpoints([]));
  }, [id, task?.task_type, task?.scan_config, task?.project?.scan_mode]);
```

- [ ] **Step 2: Commit**

```bash
cd /home/test/DeepAudit
git add frontend/src/pages/TaskDetail.tsx
git commit -m "fix(frontend): use section endpoint for API assets in TaskDetail

- change from full /code-analysis to /code-analysis/api_endpoints

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: 后端测试

**Files:**
- Create: `backend/tests/test_code_analysis_endpoints.py`

测试新端点的正确性：summary 返回计数、section 返回子文档、无数据时返回空默认值、权限检查。

- [ ] **Step 1: 创建测试文件**

```python
"""
Tests for code analysis per-section endpoints (tasks & agent_tasks).

Covers:
- GET /tasks/{id}/code-analysis/summary — counts
- GET /tasks/{id}/code-analysis/{section} — section data
- 404/403 when task doesn't exist or wrong user
- Empty/missing code_analysis_results
"""

import pytest
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

from fastapi import HTTPException

from app.api.v1.endpoints.tasks import (
    _get_code_analysis_summary,
    _get_code_analysis_section,
    get_code_analysis_summary,
    get_code_analysis_section,
)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

USER_ID = "user-001"
OTHER_USER_ID = "user-002"
PROJECT_ID = "proj-001"
TASK_ID = "task-001"


def _make_user(user_id=USER_ID, is_active=True, is_superuser=False):
    user = MagicMock()
    user.id = user_id
    user.is_active = is_active
    user.is_superuser = is_superuser
    return user


def _make_project(owner_id=USER_ID):
    proj = MagicMock()
    proj.id = PROJECT_ID
    proj.owner_id = owner_id
    return proj


# ---------------------------------------------------------------------------
# Tests for _get_code_analysis_summary (low-level helper)
# ---------------------------------------------------------------------------

class TestGetSummaryHelper:
    """测试 _get_code_analysis_summary 原始 SQL 查询"""

    @pytest.mark.asyncio
    async def test_returns_counts(self):
        """正常数据返回各小节计数"""
        mock_row = MagicMock()
        mock_row.api_endpoints = 5
        mock_row.call_graph = 12
        mock_row.file_dependencies = 8
        mock_row.control_flow_files = 3

        mock_result = MagicMock()
        mock_result.one_or_none.return_value = mock_row

        db = MagicMock()
        db.execute = AsyncMock(return_value=mock_result)

        result = await _get_code_analysis_summary(db, TASK_ID)
        assert result == {"api_endpoints": 5, "call_graph": 12, "file_dependencies": 8, "control_flow_files": 3}

    @pytest.mark.asyncio
    async def test_returns_empty_on_missing_task(self):
        """任务不存在时返回空 dict"""
        mock_result = MagicMock()
        mock_result.one_or_none.return_value = None

        db = MagicMock()
        db.execute = AsyncMock(return_value=mock_result)

        result = await _get_code_analysis_summary(db, "nonexistent")
        assert result == {}

    @pytest.mark.asyncio
    async def test_handles_null_counts(self):
        """当 JSONB 值为 null 时计数返回 0"""
        mock_row = MagicMock()
        mock_row.api_endpoints = None
        mock_row.call_graph = None
        mock_row.file_dependencies = None
        mock_row.control_flow_files = None

        mock_result = MagicMock()
        mock_result.one_or_none.return_value = mock_row

        db = MagicMock()
        db.execute = AsyncMock(return_value=mock_result)

        result = await _get_code_analysis_summary(db, TASK_ID)
        assert result == {"api_endpoints": 0, "call_graph": 0, "file_dependencies": 0, "control_flow_files": 0}


class TestGetSectionHelper:
    """测试 _get_code_analysis_section"""

    @pytest.mark.asyncio
    async def test_returns_section_data(self):
        """返回 JSONB 子文档"""
        section_data = [{"file": "a.py", "method": "GET"}]

        mock_row = MagicMock()
        mock_row.value = section_data

        mock_result = MagicMock()
        mock_result.one_or_none.return_value = mock_row

        db = MagicMock()
        db.execute = AsyncMock(return_value=mock_result)

        result = await _get_code_analysis_section(db, TASK_ID, "api_endpoints")
        assert result == section_data

    @pytest.mark.asyncio
    async def test_returns_none_on_missing(self):
        """任务不存在时返回 None"""
        mock_result = MagicMock()
        mock_result.one_or_none.return_value = None

        db = MagicMock()
        db.execute = AsyncMock(return_value=mock_result)

        result = await _get_code_analysis_section(db, "nonexistent", "api_endpoints")
        assert result is None

    @pytest.mark.asyncio
    async def test_returns_none_on_null_column(self):
        """列值为 null 时返回 None"""
        mock_row = MagicMock()
        mock_row.value = None

        mock_result = MagicMock()
        mock_result.one_or_none.return_value = mock_row

        db = MagicMock()
        db.execute = AsyncMock(return_value=mock_result)

        result = await _get_code_analysis_section(db, TASK_ID, "api_endpoints")
        assert result is None


# ---------------------------------------------------------------------------
# Tests for HTTP endpoints (get_code_analysis_summary / get_code_analysis_section)
# ---------------------------------------------------------------------------

class TestSummaryEndpoint:
    """测试 GET /tasks/{id}/code-analysis/summary 端点"""

    @pytest.mark.asyncio
    async def test_returns_summary(self):
        """正常请求返回 summary"""
        db = MagicMock()
        user = _make_user()

        with patch("app.api.v1.endpoints.tasks._verify_task_access", new=AsyncMock(return_value=True)), \
             patch("app.api.v1.endpoints.tasks._get_code_analysis_summary", new=AsyncMock(return_value={
                 "api_endpoints": 5, "call_graph": 12, "file_dependencies": 8, "control_flow_files": 3,
             })):
            result = await get_code_analysis_summary(TASK_ID, db, user)
            assert result == {"api_endpoints": 5, "call_graph": 12, "file_dependencies": 8, "control_flow_files": 3}


class TestSectionEndpoint:
    """测试 GET /tasks/{id}/code-analysis/{section} 端点"""

    @pytest.mark.asyncio
    async def test_returns_section_data(self):
        """正常请求返回对应 section 数据"""
        db = MagicMock()
        user = _make_user()
        section_data = [{"file": "a.py", "method": "GET"}]

        with patch("app.api.v1.endpoints.tasks._verify_task_access", new=AsyncMock(return_value=True)), \
             patch("app.api.v1.endpoints.tasks._get_code_analysis_section", new=AsyncMock(return_value=section_data)):
            result = await get_code_analysis_section(TASK_ID, "api_endpoints", db, user)
            assert result == section_data

    @pytest.mark.asyncio
    async def test_rejects_invalid_section(self):
        """不支持的 section 抛出 400"""
        db = MagicMock()
        user = _make_user()

        with patch("app.api.v1.endpoints.tasks._verify_task_access", new=AsyncMock(return_value=True)):
            with pytest.raises(HTTPException) as exc:
                await get_code_analysis_section(TASK_ID, "invalid_section", db, user)
            assert exc.value.status_code == 400

    @pytest.mark.asyncio
    async def test_returns_empty_array_on_missing_data_for_list_section(self):
        """list 类型 section 数据为 None 时返回 []"""
        db = MagicMock()
        user = _make_user()

        with patch("app.api.v1.endpoints.tasks._verify_task_access", new=AsyncMock(return_value=True)), \
             patch("app.api.v1.endpoints.tasks._get_code_analysis_section", new=AsyncMock(return_value=None)):
            result = await get_code_analysis_section(TASK_ID, "api_endpoints", db, user)
            assert result == []

    @pytest.mark.asyncio
    async def test_returns_empty_dict_on_missing_data_for_dict_section(self):
        """dict 类型 section(control_flow) 数据为 None 时返回 {}"""
        db = MagicMock()
        user = _make_user()

        with patch("app.api.v1.endpoints.tasks._verify_task_access", new=AsyncMock(return_value=True)), \
             patch("app.api.v1.endpoints.tasks._get_code_analysis_section", new=AsyncMock(return_value=None)):
            result = await get_code_analysis_section(TASK_ID, "control_flow", db, user)
            assert result == {}
```

- [ ] **Step 2: 运行测试**

```bash
cd /home/test/DeepAudit/backend
python -m pytest tests/test_code_analysis_endpoints.py -v --no-header -q 2>&1 | tail -30
```

Expected: 全部 PASS（约 10-12 个测试）

- [ ] **Step 3: 同时跑所有原有测试确保没回归**

```bash
cd /home/test/DeepAudit/backend
python -m pytest tests/test_api_tasks.py tests/test_code_analysis_endpoints.py -v --no-header -q 2>&1 | tail -30
```

Expected: 全部 PASS

- [ ] **Step 4: Commit**

```bash
cd /home/test/DeepAudit
git add backend/tests/test_code_analysis_endpoints.py
git commit -m "test(code-analysis): add tests for per-section JSONB endpoints

- _get_code_analysis_summary helper (returns counts / empty / null-safe)
- _get_code_analysis_section helper (returns data / None)
- summary endpoint
- section endpoint (valid data / invalid section / missing data)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 7: 前端构建验证

确保 TypeScript 编译通过。

- [ ] **Step 1: TypeScript 类型检查**

```bash
cd /home/test/DeepAudit/frontend
npx tsc --noEmit 2>&1 | tail -30
```

Expected: 没有类型错误

- [ ] **Step 2: 如果有 lint 脚本也跑一下**

```bash
cd /home/test/DeepAudit/frontend
npm run lint 2>&1 | tail -20 || true
```

Expected: 没有 lint 错误

- [ ] **Step 3: Commit（如果有 lint/tsc 修复）**

---

### 最终自检

1. **需求覆盖**：用户要求"分批加载，点击哪个加载哪个"
   - [x] summary 端点 ＜ 1KB 响应，不触发超时
   - [x] 4 个小节各自独立请求
   - [x] 点击科室才加载该科室数据

2. **占位符检查**：所有代码段都包含完整实现，无 "TBD"、"TODO"

3. **类型一致性**：后端返回 schema 与前端 `types.ts` 的 `SectionSummary` 字段名相同

4. **兼容性**：旧端点在代码中保留但标记废弃；旧调用的 `TaskDetail.tsx:268` 改为新的 section 端点，不再有未迁移的调用