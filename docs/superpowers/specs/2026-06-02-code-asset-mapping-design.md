# 代码资产图谱功能设计

> 日期: 2026-06-02
> 状态: Draft
> 涉及模块: 后端 AgentTool、前端 AgentAudit 页面

## 1. 概述

在 AI 深度审计流程中新增 **CodeAssetMappingTool**，通过纯正则+规则扫描源代码，自动检测并构建四类代码资产信息：

1. **系统 API 接口资产** — 检测路由定义，提取 HTTP 方法、路径、参数
2. **文件函数调用图** — 检测函数定义和调用关系，构建跨文件调用链
3. **文件包含关系图** — 检测 import/require/include 语句，构建文件依赖拓扑
4. **函数控制流图** — 检测函数内分支结构，构建基本块和分支边

结果通过 SSE 实时推送到前端，在 AgentAudit 页面右侧新增 CodeAssetPanel 展示。

## 2. 架构决策

| 决策 | 选择 | 理由 |
|------|------|------|
| 扫描策略 | 纯正则+规则 | 速度快（秒级）、零 Token 消耗、确定性输出、与安全审计"快速看大局"的需求匹配 |
| 执行方式 | ReconAgent 自动调用 | 与现有流程无缝集成，复用 SSE 推送机制 |
| 数据存储 | AgentTask.code_asset_map (JSON) | 项目级资产信息而非单漏洞，独立于 AgentFinding |
| 可视化 | CSS + inline SVG 自绘 | 与 DataFlowPathDiagram 风格统一，无额外依赖 |
| 前端布局 | 右侧分栏 CodeAssetPanel (w-[420px]) | 不压缩 LogStream 空间，可折叠回原始布局 |
| 语言范围 | Python (Flask/Django/FastAPI)、JS/TS (Express/Koa/NestJS)、PHP (Laravel/Symfony) | 与项目已有框架知识库一致 |

## 3. 后端设计

### 3.1 CodeAssetMappingTool

**文件位置**: `/backend/app/services/agent/tools/code_asset_tool.py`

**类结构**:

```
CodeAssetMappingTool (继承 AgentTool)
  name: "code_asset_mapping"
  description: "扫描源代码，构建系统API接口资产、函数调用图、文件包含关系图、函数控制流图"
  args_schema: CodeAssetMappingInput
```

**输入 Schema**:

```python
class CodeAssetMappingInput(BaseModel):
    project_root: str = Field(description="项目根目录路径")
    target_files: Optional[List[str]] = Field(
        default=None,
        description="指定扫描的文件列表（空则扫描全部源代码文件）"
    )
    exclude_patterns: Optional[List[str]] = Field(
        default=None,
        description="排除的文件/目录模式"
    )
```

**执行流程** (`_execute()`):

1. 遍历项目源代码文件（过滤 `.py`, `.js`, `.ts`, `.jsx`, `.tsx`, `.php`，排除 `node_modules`, `__pycache__`, `vendor`, `.git` 等）
2. 逐文件读取内容，执行四类分析
3. 合并为全局图谱（跨文件调用关系、依赖拓扑）
4. 发射 `code_asset_mapped` SSE 事件
5. 返回 `ToolResult`，metadata 包含完整四类数据

### 3.2 四类分析器

#### 3.2.1 ApiEndpointScanner

检测路由定义模式：

**Python (Flask/Django/FastAPI)**:
- `@app.route('/path', methods=['GET'])` → Flask
- `@router.get('/path')`, `@router.post('/path')` → FastAPI
- `@api_view(['GET'])` → Django REST
- `def view_func(request):` + URL patterns → Django

**JavaScript/TypeScript (Express/Koa/NestJS)**:
- `app.get('/path', handler)` → Express
- `router.post('/path', handler)` → Express Router
- `@Controller`, `@Get('/path')` → NestJS (装饰器)
- `app.use('/path', router)` → Express middleware

**PHP (Laravel/Symfony)**:
- `Route::get('/path', 'Controller@method')` → Laravel
- `$app->get('/path', function() {...})` → Slim
- `#[Route('/path', methods: ['GET'])]` → Symfony 5+ 注解

输出: `List[ApiEndpoint]`，每条包含 `{path, method, file, line, function, params, framework}`

#### 3.2.2 FunctionCallGraphBuilder

**函数定义检测**:
- Python: `def func_name(params):`, `async def func_name(params):`, `class ClassName: def method(self)`
- JS/TS: `function funcName(params)`, `const funcName = (params) =>`, `class ClassName { method(params) }`
- PHP: `function funcName(params)`, `class ClassName { public function method(params) }`

**函数调用检测**:
- Python: `func_name(args)`, `obj.method(args)`, `ClassName.static_method(args)`
- JS/TS: `funcName(args)`, `obj.method(args)`, `ClassName.method(args)`, `require('module').func(args)`
- PHP: `funcName(args)`, `$obj->method(args)`, `ClassName::staticMethod(args)`

**跨文件映射**: 通过 import/require 语句将外部函数名映射到源文件，构建跨文件调用边。

输出: `CallGraph`，包含 `{nodes: List[GraphNode], edges: List[GraphEdge]}`

#### 3.2.3 FileDependencyBuilder

**检测 import/include 语句**:
- Python: `import module`, `from module import name`, `from .module import name` (相对导入)
- JS/TS: `require('module')`, `import name from 'module'`, `import { names } from 'module'`
- PHP: `include 'file'`, `require 'file'`, `use Namespace\ClassName`, `include_once`, `require_once`

**路径解析**: 将模块名映射到实际文件路径（简化规则：`models` → `models.py`，`./utils` → `utils.js` 等）

输出: `DependencyGraph`，包含 `{nodes: List[GraphNode], edges: List[DependencyEdge]}`，edge 包含 `{source, target, type: 'import'|'require'|'include', imports: List[str]}`

#### 3.2.4 ControlFlowBuilder

**函数体提取**: 通过缩进/大括号匹配提取函数体范围。

**分支结构检测**:
- `if/elif/else` → 二叉/多路分支
- `for/while` → 循环（entry → body → merge）
- `switch/case` → 多路分支
- `try/catch/finally` → 异常处理分支
- `return/throw` → 出口节点

**基本块构建**: 将函数体切分为基本块（连续无分支的代码行），构建块间边（分支条件作为边标签）。

输出: `List[ControlFlowGraph]`，每个包含 `{function, file, blocks: List[Block], edges: List[FlowEdge]}`

### 3.3 数据结构定义

```python
# API 接口
ApiEndpoint = {
    "path": str,           # 路由路径，如 "/api/users/:id"
    "method": str,         # HTTP 方法，如 "GET", "POST"
    "file": str,           # 定义所在文件
    "line": int,           # 行号
    "function": str | None, # 处理函数名
    "params": list[str],    # 参数列表
    "framework": str,       # 框架标识，如 "flask", "express"
}

# 图节点
GraphNode = {
    "id": str,             # 唯一标识，如 "routes.py:get_users"
    "name": str,           # 显示名称
    "file": str,           # 所属文件
    "type": str,           # 类型："function" | "class" | "file"
    "line": int | None,    # 定义行号
}

# 图边
GraphEdge = {
    "source": str,         # 源节点 id
    "target": str,         # 目标节点 id
    "type": str,           # 类型："call" | "import" | "include" | "branch"
    "label": str | None,   # 边标签（如 "True"/"False"，函数调用名）
}

# 控制流基本块
Block = {
    "id": str,             # 唯一标识，如 "entry", "branch_1", "exit"
    "label": str,          # 显示标签
    "code": str,           # 代码片段（首行或摘要）
    "line_start": int,     # 起始行号
    "line_end": int,       # 结束行号
}

# 控制流边
FlowEdge = {
    "source": str,         # 源块 id
    "target": str,         # 目标块 id
    "label": str | None,   # 条件标签（如 "True", "False", "case X"）
}
```

### 3.4 数据库变更

**AgentTask 模型新增字段**:

```python
# 在 AgentTask 模型类中新增:
code_asset_map = Column(JSON, nullable=True)  # 代码资产图谱数据
```

**存储内容**: 完整的四类数据 JSON:
```json
{
    "api_endpoints": [...],
    "call_graph": {"nodes": [...], "edges": [...]},
    "dependency_graph": {"nodes": [...], "edges": [...]},
    "control_flows": [...],
    "scan_metadata": {
        "total_files_scanned": int,
        "scan_duration_ms": int,
        "languages_detected": [...]
    }
}
```

### 3.5 SSE 事件

**新增事件类型**: `AgentEventType.CODE_ASSET_MAPPED = "code_asset_mapped"` (在 `backend/app/models/agent_task.py` 第174行的 `AgentEventType` 类中)

**事件发射位置**: `CodeAssetMappingTool._execute()` 完成后通过 `event_emitter.emit_event()` 发射

**事件流转**: `EventManager.add_event()` → persist to DB + push to asyncio.Queue → SSE endpoint `/agent-tasks/{id}/stream` 从 `_running_event_managers[task_id]` 获取 EventManager → `stream_events()` 推送到前端

**事件内容**:
```json
{
    "event_type": "code_asset_mapped",
    "phase": "reconnaissance",
    "message": "代码资产扫描完成: 发现 15 个API接口, 42 个函数调用关系, 28 个文件依赖",
    "tool_name": "code_asset_mapping",
    "metadata": {
        "api_endpoints_count": 15,
        "call_graph_nodes_count": 42,
        "dependency_graph_nodes_count": 28,
        "control_flows_count": 12
    }
}
```

### 3.6 ReconAgent 集成

在 ReconAgent 的系统提示词 `RECON_SYSTEM_PROMPT` 中新增工具说明：

```
### 代码资产图谱分析
- 使用 code_asset_mapping 工具扫描项目源代码
- 自动构建 API 接口资产表、函数调用图、文件包含图、控制流图
- 这些图谱可以帮助 AnalysisAgent 更精准地定位漏洞
```

在 `backend/app/api/v1/endpoints/agent_tasks.py` 的 `_initialize_tools()` 函数（lines 958-974）中，将 CodeAssetMappingTool 加入 `recon_tools` 字典：

```python
recon_tools = {
    **base_tools,
    ...existing tools...,
    "code_asset_mapping": CodeAssetMappingTool(project_root, exclude_patterns, target_files),
}
```

ReconAgent 会在侦察阶段通过 LLM 决策自动调用此工具。

### 3.7 API 端点变更

**`GET /agent-tasks/{id}`**: 响应中新增 `code_asset_map` 字段。

**Pydantic Schema 变更**: `AgentTaskResponse` 新增 `code_asset_map` 字段（类型 `Optional[dict]`）。

## 4. 前端设计

### 4.1 页面布局改造

**改造 AgentAudit 页面 (`/frontend/src/pages/AgentAudit/index.tsx`)**:

将右侧主区域从单列改为双栏：

```tsx
// 原始: 单列
<div className="flex-1 flex flex-col overflow-hidden p-4 gap-3">

// 改造: 双栏 (LogStream + CodeAssetPanel)
<div className="flex-1 flex overflow-hidden p-4 gap-3">
  {/* LogStream 区域 */}
  <div className="flex-1 min-h-0 flex flex-col gap-3">
    <LogStream ... />
    <AgentPanel ... />
  </div>

  {/* CodeAssetPanel */}
  <CodeAssetPanel codeAssetMap={codeAssetMap} isLoading={isLoading} />
</div>
```

CodeAssetPanel 宽度 `w-[420px]`，带可折叠按钮（收起时 `w-0 overflow-hidden`，隐藏面板）。

### 4.2 新增组件

**文件位置**: `/frontend/src/pages/AgentAudit/components/CodeAssetPanel/`

```
CodeAssetPanel/
├─ index.tsx                    # 主面板容器（标签页切换、折叠控制）
├─ ApiEndpointTable.tsx         # API 接口资产表格
├─ FunctionCallGraph.tsx        # 函数调用图 (CSS+SVG)
├─ FileDependencyGraph.tsx      # 文件包含图 (CSS+SVG)
├─ ControlFlowGraph.tsx         # 控制流图 (CSS+SVG)
└─ types.ts                     # 图谱相关类型定义
```

### 4.3 类型定义

**`types.ts`**:

```typescript
export interface ApiEndpoint {
  path: string;
  method: string;
  file: string;
  line: number;
  function?: string;
  params?: string[];
  framework: string;
}

export interface GraphNode {
  id: string;
  name: string;
  file: string;
  type: 'function' | 'class' | 'file';
  line?: number;
}

export interface GraphEdge {
  source: string;
  target: string;
  type: 'call' | 'import' | 'include' | 'branch';
  label?: string;
}

export interface CallGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface DependencyGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface Block {
  id: string;
  label: string;
  code: string;
  line_start: number;
  line_end: number;
}

export interface FlowEdge {
  source: string;
  target: string;
  label?: string;
}

export interface ControlFlowGraph {
  function: string;
  file: string;
  blocks: Block[];
  edges: FlowEdge[];
}

export interface CodeAssetMap {
  api_endpoints: ApiEndpoint[];
  call_graph: CallGraph;
  dependency_graph: DependencyGraph;
  control_flows: ControlFlowGraph[];
  scan_metadata?: {
    total_files_scanned: number;
    scan_duration_ms: number;
    languages_detected: string[];
  };
}
```

### 4.4 主面板容器 (CodeAssetPanel/index.tsx)

```tsx
interface CodeAssetPanelProps {
  codeAssetMap: CodeAssetMap | null;
  isLoading: boolean;
}

// 标签页: API接口 | 调用图 | 包含图 | 控制流图
// 每个标签页带数量 Badge
// 面板顶部有折叠/展开按钮
```

面板头部: "📊 代码资产分析" + 折叠按钮 + 每标签页计数 Badge

### 4.5 API 接口资产表格 (ApiEndpointTable)

- 列: 方法(带颜色 Badge)、路径、文件、行号、函数名、框架
- 统计行: "共 N 个接口 | GET: X, POST: Y, ..."
- 方法 Badge 颜色: GET=绿色, POST=蓝色, PUT=橙色, DELETE=红色, PATCH=紫色
- 表格行可点击，高亮对应的 LogStream 条目

### 4.6 函数调用图 (FunctionCallGraph)

- 节点: 圆角矩形，显示 `文件名:函数名`，按文件分组显示
- 连线: SVG 线段 + 箭头，标签显示调用关系类型
- 颜色编码: 入口函数(indigo)、内部函数(slate)、外部函数(gray)
- 交互: 点击节点高亮关联连线，悬浮显示代码预览
- 布局: 垂直层级布局（入口→中间→底层），与 DataFlowPathDiagram 风格统一
- 简化: 大型图 (>50 节点) 仅显示高频调用路径，低频节点折叠

### 4.7 文件包含图 (FileDependencyGraph)

- 节点: 文件名矩形框，带文件类型图标
- 连线: SVG 线段 + 箭头，标签显示 import 内容
- 颜色编码: 核心文件(indigo)、配置文件(amber)、工具文件(slate)
- 布局: 依赖层级（被依赖多的在上层）
- 交互: 同调用图

### 4.8 控制流图 (ControlFlowGraph)

- 顶部函数选择下拉框: `[函数名 ▼]`，列出所有已分析函数
- 基本块: 圆角矩形，显示代码首行摘要
- 分支边: SVG 线段，标签显示条件 (True/False/case X)
- 颜色编码: entry(绿色)、分支(amber)、循环(violet)、exit(red)、异常(slate)
- 布局: 纵向 DAG（entry 在上，exit 在下）
- 交互: 点击块展开完整代码

### 4.9 数据流和状态管理

**新增状态** (在 `useAgentAuditState` hook):

```typescript
codeAssetMap: CodeAssetMap | null;    // 代码资产数据
codeAssetLoading: boolean;            // 加载中
codeAssetPanelCollapsed: boolean;     // 面板折叠状态
```

**新增 reducer actions**:

```typescript
| { type: 'SET_CODE_ASSET_MAP'; payload: CodeAssetMap }
| { type: 'SET_CODE_ASSET_LOADING'; payload: boolean }
| { type: 'TOGGLE_CODE_ASSET_PANEL' }
```

**SSE 事件监听** (在 `useResilientStream` hook):

当收到 `code_asset_mapped` 事件时，dispatch `SET_CODE_ASSET_MAP` action。

**任务完成后数据加载**:

`getAgentTask(taskId)` 返回的 `AgentTask` 对象中包含 `code_asset_map` 字段，在任务完成时 dispatch 到状态。

### 4.10 空状态和加载状态

- **加载中**: 旋转动画 + "正在扫描代码资产..." 文字
- **无数据**: 空图标 + "未检测到代码资产信息"
- **部分数据**: 显示已有数据，缺失标签页灰化

## 5. 文件变更清单

### 后端新增文件

| 文件 | 内容 |
|------|------|
| `backend/app/services/agent/tools/code_asset_tool.py` | CodeAssetMappingTool + 四类分析器 |

### 后端修改文件

| 文件 | 变更 |
|------|------|
| `backend/app/models/agent_task.py` | AgentTask 新增 `code_asset_map` JSON 列 |
| `backend/app/services/agent/agents/recon.py` | 系统提示词新增 code_asset_mapping 工具说明 |
| `backend/app/api/v1/endpoints/agent_tasks.py` (lines 958-974) | 在 `_initialize_tools()` 中将 CodeAssetMappingTool 加入 recon_tools 字典 |
| `backend/app/schemas/agent_task.py` | AgentTaskResponse 新增 `code_asset_map` 字段 |
| `backend/app/api/v1/endpoints/agent_tasks.py` | 返回 code_asset_map 数据 |

### 前端新增文件

| 文件 | 内容 |
|------|------|
| `frontend/src/pages/AgentAudit/components/CodeAssetPanel/index.tsx` | 主面板容器 |
| `frontend/src/pages/AgentAudit/components/CodeAssetPanel/types.ts` | 图谱类型定义 |
| `frontend/src/pages/AgentAudit/components/CodeAssetPanel/ApiEndpointTable.tsx` | API 接口表格 |
| `frontend/src/pages/AgentAudit/components/CodeAssetPanel/FunctionCallGraph.tsx` | 函数调用图 |
| `frontend/src/pages/AgentAudit/components/CodeAssetPanel/FileDependencyGraph.tsx` | 文件包含图 |
| `frontend/src/pages/AgentAudit/components/CodeAssetPanel/ControlFlowGraph.tsx` | 控制流图 |

### 前端修改文件

| 文件 | 变更 |
|------|------|
| `frontend/src/pages/AgentAudit/index.tsx` | 右侧布局双栏化 + CodeAssetPanel 集成 |
| `frontend/src/pages/AgentAudit/types.ts` | 新增 CodeAssetMap 相关类型 |
| `frontend/src/pages/AgentAudit/hooks/useAgentAuditState.ts` | 新增 codeAssetMap/codeAssetLoading 状态和 actions |
| `frontend/src/pages/AgentAudit/hooks/useResilientStream.ts` | 监听 code_asset_mapped SSE 事件 |
| `frontend/src/shared/api/agentTasks.ts` | AgentTask 新增 code_asset_map 字段 |
| `frontend/src/pages/AgentAudit/components/index.ts` | 导出 CodeAssetPanel |
| `frontend/src/pages/AgentAudit/hooks/index.ts` | 导出新增类型 |

## 6. 局限性说明

- 正则扫描对动态路由（如 Flask 的 `url_for`）、路径别名（如 JS 的 `@/` prefix）无法完整解析
- 函数调用图无法处理动态调用 (`func = getattr(obj, name); func()`)、多态、回调
- 控制流图不包含异常处理流（except 块的隐式跳转）、async/await 控行
- 大型项目（>1000 文件）可能需要分批扫描或限制扫描范围

这些局限性在 UI 上通过提示文字说明（如 "此图谱为静态分析近似结果，动态调用未包含"），不影响安全审计的核心价值。