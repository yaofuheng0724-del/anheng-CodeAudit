# 源代码分析功能设计文档

## 概述

为快速审计和深度审计增加源代码扫描功能，检测并展示：
- 系统API接口资产信息
- 文件函数调用图
- 文件包含关系图
- 函数控制流图

## 需求总结

| 项目 | 决策 |
|------|------|
| 功能范围 | API接口资产、函数调用图、文件包含关系图、函数控制流图 |
| 开源工具 | tree-sitter（统一解析引擎） |
| 语言优先级 | Java、C、C++、JavaScript、TypeScript |
| 展示形式 | 文本结构化（树形列表） |
| 生成时机 | 任务执行时实时生成 |
| API资产范围 | Web端点 + 函数签名 + 外部调用 |
| 数据存储 | 任务表JSON字段 |
| 前端交互 | 基础展示 + 展开/折叠 |

---

## 1. 系统架构

```
┌─────────────────────────────────────────────────────────────────┐
│                         整体架构                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   前端层                                                         │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │  TaskDetail.tsx          AgentAudit/index.tsx           │   │
│   │  ├── CodeAnalysisPanel   ├── CodeAnalysisPanel          │   │
│   │  │   ├── APIAssetsList   │   ├── APIAssetsList          │   │
│   │  │   ├── CallGraphTree   │   ├── CallGraphTree          │   │
│   │  │   ├── FileDepsTree    │   ├── FileDepsTree           │   │
│   │  │   └── ControlFlowTree │   └── ControlFlowTree        │   │
│   └─────────────────────────────────────────────────────────┘   │
│                              ↓ API调用                          │
│   后端层                                                         │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │  /api/v1/tasks/{id}/code-analysis                       │   │
│   │  /api/v1/agent-tasks/{id}/code-analysis                 │   │
│   └─────────────────────────────────────────────────────────┘   │
│                              ↓                                  │
│   服务层                                                         │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │  CodeAnalysisService                                     │   │
│   │  ├── TreeSitterParser (统一解析器)                       │   │
│   │  ├── APIEndpointExtractor (API提取)                      │   │
│   │  ├── CallGraphBuilder (调用图构建)                        │   │
│   │  ├── FileDependencyAnalyzer (文件依赖)                    │   │
│   │  └── ControlFlowBuilder (控制流构建)                      │   │
│   └─────────────────────────────────────────────────────────┘   │
│                              ↓                                  │
│   存储层                                                         │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │  tasks.code_analysis_results (JSON)                     │   │
│   │  agent_tasks.code_analysis_results (JSON)               │   │
│   └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. 数据模型设计

### 2.1 数据库字段变更

**迁移文件**: `backend/alembic/versions/xxx_add_code_analysis_results.py`

```sql
-- 快速审计任务表
ALTER TABLE tasks ADD COLUMN code_analysis_results JSONB DEFAULT '{}';

-- 深度审计任务表
ALTER TABLE agent_tasks ADD COLUMN code_analysis_results JSONB DEFAULT '{}';

-- 添加索引（可选，用于JSON字段查询）
CREATE INDEX idx_tasks_code_analysis ON tasks USING GIN (code_analysis_results);
CREATE INDEX idx_agent_tasks_code_analysis ON agent_tasks USING GIN (code_analysis_results);
```

### 2.2 JSON数据结构

```json
{
  "api_endpoints": [
    {
      "type": "web_api",
      "name": "GET /api/users",
      "file": "src/controllers/UserController.java",
      "line": 25,
      "params": [{"name": "id", "type": "String"}],
      "return_type": "User"
    },
    {
      "type": "function",
      "name": "processData",
      "file": "src/utils/DataProcessor.ts",
      "line": 10,
      "params": [{"name": "data", "type": "any"}],
      "return_type": "void"
    },
    {
      "type": "external_call",
      "name": "mysql_query",
      "file": "src/db/Database.c",
      "line": 50,
      "target": "MySQL",
      "category": "database"
    }
  ],

  "call_graph": [
    {
      "caller": "main",
      "caller_file": "src/main.cpp",
      "callee": "processData",
      "callee_file": "src/utils.cpp",
      "line": 15
    }
  ],

  "file_dependencies": [
    {
      "file": "src/main.cpp",
      "includes": [
        {"target": "utils.h", "type": "include", "line": 1},
        {"target": "config.h", "type": "include", "line": 2}
      ]
    }
  ],

  "control_flow": [
    {
      "function": "validateInput",
      "file": "src/validation.js",
      "line": 5,
      "nodes": [
        {"id": "entry", "type": "entry", "line": 5},
        {"id": "branch1", "type": "branch", "condition": "input != null", "line": 7},
        {"id": "exit", "type": "exit", "line": 15}
      ],
      "edges": [
        {"from": "entry", "to": "branch1"},
        {"from": "branch1", "to": "exit", "label": "true"},
        {"from": "branch1", "to": "exit", "label": "false"}
      ]
    }
  ]
}
```

### 2.3 字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| `api_endpoints` | Array | API接口资产列表 |
| `call_graph` | Array | 函数调用关系列表 |
| `file_dependencies` | Array | 文件包含关系列表 |
| `control_flow` | Array | 函数控制流列表 |

**API Endpoint 类型**：
- `web_api`: Web HTTP路由端点
- `function`: 函数/方法签名
- `external_call`: 外部系统调用（数据库、文件IO、第三方API等）

---

## 3. 后端服务设计

### 3.1 文件结构

```
backend/app/services/code_analysis/
├── __init__.py
├── service.py              # CodeAnalysisService 主服务
├── parser.py               # TreeSitterParser 统一解析器
├── extractors/
│   ├── __init__.py
│   ├── base.py             # 基础提取器抽象类
│   ├── api_endpoint.py     # API接口提取器
│   ├── call_graph.py       # 调用图提取器
│   ├── file_dependency.py  # 文件依赖提取器
│   └── control_flow.py     # 控制流提取器
└── language_handlers/
    ├── __init__.py
    ├── java.py             # Java语言特定处理
    ├── c_cpp.py            # C/C++语言特定处理
    └── js_ts.py            # JavaScript/TypeScript语言特定处理
```

### 3.2 核心服务类

```python
# backend/app/services/code_analysis/service.py

class CodeAnalysisService:
    """代码分析服务 - 统一入口"""

    def __init__(self, project_root: str):
        self.project_root = project_root
        self.parser = TreeSitterParser()

    async def analyze(
        self,
        language: str,
        exclude_patterns: List[str] = None,
        target_files: List[str] = None,
    ) -> Dict[str, Any]:
        """
        执行完整代码分析

        Args:
            language: 主要编程语言 (java, c, cpp, javascript, typescript)
            exclude_patterns: 排除模式列表
            target_files: 目标文件列表（可选，用于限定分析范围）

        Returns:
            {
                "api_endpoints": [...],
                "call_graph": [...],
                "file_dependencies": [...],
                "control_flow": [...]
            }
        """
        # 1. 扫描项目文件
        files = self._scan_files(exclude_patterns, target_files)

        # 2. 并行执行4种分析
        results = {
            "api_endpoints": await self._extract_api_endpoints(files, language),
            "call_graph": await self._build_call_graph(files, language),
            "file_dependencies": await self._analyze_file_deps(files, language),
            "control_flow": await self._build_control_flow(files, language),
        }

        return results
```

### 3.3 TreeSitter解析器

```python
# backend/app/services/code_analysis/parser.py

class TreeSitterParser:
    """基于tree-sitter的统一AST解析器"""

    LANGUAGE_MAP = {
        "java": "java",
        "c": "c",
        "cpp": "cpp",
        "javascript": "javascript",
        "typescript": "typescript",
    }

    def __init__(self):
        self._parsers = {}
        self._init_parsers()

    def parse_file(self, file_path: str, language: str) -> tree_sitter.Tree:
        """解析单个文件，返回AST"""
        parser = self._get_parser(language)
        with open(file_path, "rb") as f:
            source = f.read()
        return parser.parse(source)

    def query(self, tree: tree_sitter.Tree, query_str: str, language: str):
        """执行tree-sitter查询，提取特定节点"""
        language_lib = self._get_language(language)
        query = language_lib.query(query_str)
        return query.captures(tree.root_node)
```

### 3.4 API端点

```python
# backend/app/api/v1/endpoints/tasks.py (新增)

@router.get("/{task_id}/code-analysis")
async def get_code_analysis(
    task_id: str,
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """获取快速审计任务的代码分析结果"""
    task = await db.get(Task, task_id)
    if not task:
        raise HTTPException(404, "任务不存在")

    return task.code_analysis_results or {}


# backend/app/api/v1/endpoints/agent_tasks.py (新增)

@router.get("/{task_id}/code-analysis")
async def get_code_analysis(
    task_id: str,
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """获取深度审计任务的代码分析结果"""
    task = await db.get(AgentTask, task_id)
    if not task:
        raise HTTPException(404, "任务不存在")

    return task.code_analysis_results or {}
```

---

## 4. 前端组件设计

### 4.1 文件结构

```
frontend/src/components/code-analysis/
├── index.ts                    # 导出入口
├── CodeAnalysisPanel.tsx       # 主面板容器（4个折叠面板）
├── APIAssetsList.tsx           # API接口资产列表
├── CallGraphTree.tsx           # 函数调用图树形组件
├── FileDepsTree.tsx            # 文件包含关系树形组件
├── ControlFlowTree.tsx         # 函数控制流树形组件
└── types.ts                    # 类型定义
```

### 4.2 类型定义

```typescript
// frontend/src/components/code-analysis/types.ts

export interface APIEndpoint {
  type: 'web_api' | 'function' | 'external_call';
  name: string;
  file: string;
  line: number;
  params?: { name: string; type: string }[];
  return_type?: string;
  target?: string;
  category?: string;
}

export interface CallGraphNode {
  caller: string;
  caller_file: string;
  callee: string;
  callee_file: string;
  line: number;
}

export interface FileDependency {
  file: string;
  includes: { target: string; type: string; line: number }[];
}

export interface ControlFlowNode {
  function: string;
  file: string;
  line: number;
  nodes: { id: string; type: string; condition?: string; line: number }[];
  edges: { from: string; to: string; label?: string }[];
}

export interface CodeAnalysisResult {
  api_endpoints: APIEndpoint[];
  call_graph: CallGraphNode[];
  file_dependencies: FileDependency[];
  control_flow: ControlFlowNode[];
}
```

### 4.3 主面板组件

```typescript
// frontend/src/components/code-analysis/CodeAnalysisPanel.tsx

interface Props {
  taskId: string;
  taskType: 'quick' | 'agent';
}

export function CodeAnalysisPanel({ taskId, taskType }: Props) {
  const [data, setData] = useState<CodeAnalysisResult | null>(null);
  const [expandedSections, setExpandedSections] = useState<string[]>([]);

  // 获取分析数据
  useEffect(() => {
    const endpoint = taskType === 'quick'
      ? `/api/v1/tasks/${taskId}/code-analysis`
      : `/api/v1/agent-tasks/${taskId}/code-analysis`;

    api.get(endpoint).then(setData);
  }, [taskId, taskType]);

  if (!data) return <div>加载中...</div>;

  return (
    <div className="cyber-card p-4">
      <CollapsibleSection
        title="API接口资产"
        count={data.api_endpoints.length}
        expanded={expandedSections.includes('api')}
        onToggle={() => toggleSection('api')}
      >
        <APIAssetsList data={data.api_endpoints} />
      </CollapsibleSection>

      <CollapsibleSection
        title="函数调用图"
        count={data.call_graph.length}
        expanded={expandedSections.includes('call')}
        onToggle={() => toggleSection('call')}
      >
        <CallGraphTree data={data.call_graph} />
      </CollapsibleSection>

      <CollapsibleSection
        title="文件包含关系"
        count={data.file_dependencies.length}
        expanded={expandedSections.includes('deps')}
        onToggle={() => toggleSection('deps')}
      >
        <FileDepsTree data={data.file_dependencies} />
      </CollapsibleSection>

      <CollapsibleSection
        title="函数控制流图"
        count={data.control_flow.length}
        expanded={expandedSections.includes('cfg')}
        onToggle={() => toggleSection('cfg')}
      >
        <ControlFlowTree data={data.control_flow} />
      </CollapsibleSection>
    </div>
  );
}
```

---

## 5. 核心流程设计

### 5.1 快速审计集成流程

```
用户创建快速审计任务
       ↓
scanner.py 初始化扫描
       ↓
【新增】检测项目语言类型
       ↓
【新增】调用 CodeAnalysisService.analyze()
       ↓
【新增】结果存入 task.code_analysis_results
       ↓
继续执行现有扫描逻辑
       ↓
任务完成
```

### 5.2 深度审计集成流程

```
用户创建深度审计任务
       ↓
agent_tasks.py 初始化 Agent
       ↓
【新增】在 preparation 阶段检测语言
       ↓
【新增】调用 CodeAnalysisService.analyze()
       ↓
【新增】结果存入 agent_task.code_analysis_results
       ↓
【新增】发送事件通知前端分析完成
       ↓
Agent 继续执行现有审计流程
       ↓
任务完成
```

### 5.3 前端布局调整

**快速审计 TaskDetail.tsx**：
```
┌───────────────────────────────────────────────────────────┐
│ 现有布局                                                    │
│ ┌─────────────────┬─────────────────────────────────────┐ │
│ │ 项目信息卡片     │ 【新增】代码分析面板                 │ │
│ │ (50%)           │ (50%) - 4个折叠面板                  │ │
│ │                 │   - API接口资产                      │ │
│ │                 │   - 函数调用图                       │ │
│ │                 │   - 文件包含关系                     │ │
│ │                 │   - 函数控制流图                     │ │
│ └─────────────────┴─────────────────────────────────────┘ │
│ 统计卡片 + 问题列表（保持不变）                              │ │
└───────────────────────────────────────────────────────────┘
```

**深度审计 AgentAudit/index.tsx**：
```
┌───────────────────────────────────────────────────────────┐
│ 现有布局                                                    │
│ ┌─────────────────┬─────────────────────────────────────┐ │
│ │ 日志流          │ 【新增】代码分析面板                 │ │
│ │ (50%)           │ (50%) - 4个折叠面板                  │ │
│ │                 │   同上                               │ │
│ └─────────────────┴─────────────────────────────────────┘ │
│ 统计卡片 + Agent树 + 问题列表（保持不变）                    │ │
└───────────────────────────────────────────────────────────┘
```

---

## 6. 语言特定处理

### 6.1 Java

- **API端点检测**: `@RequestMapping`, `@GetMapping`, `@PostMapping`, `@RestController`
- **调用图**: 方法调用表达式
- **文件依赖**: `import` 语句
- **控制流**: `if/else/switch/for/while/try`

### 6.2 C/C++

- **API端点检测**: 函数声明（main、导出函数）
- **调用图**: 函数调用表达式
- **文件依赖**: `#include` 语句
- **控制流**: `if/else/switch/for/while`

### 6.3 JavaScript/TypeScript

- **API端点检测**:
  - Express: `app.get/post/put/delete`, `router.xxx`
  - Koa: `router.get/post`
  - NestJS: `@Get/@Post/@Controller`
- **调用图**: 函数调用表达式、方法调用
- **文件依赖**: `import`, `require`
- **控制流**: `if/else/switch/for/while/try`

---

## 7. 技术依赖

### 7.1 Python依赖

```
tree-sitter>=0.21
tree-sitter-java>=0.21
tree-sitter-c>=0.21
tree-sitter-cpp>=0.21
tree-sitter-javascript>=0.21
tree-sitter-typescript>=0.21
```

### 7.2 前端依赖

无需新增依赖，使用现有的 React + Tailwind 组件。

---

## 8. 实现优先级

| 优先级 | 功能 | 复杂度 |
|--------|------|--------|
| P0 | 文件包含关系图 | 低 |
| P0 | API接口资产检测（Web API） | 中 |
| P1 | 函数调用图 | 中 |
| P1 | API接口资产检测（函数签名） | 中 |
| P2 | 控制流图 | 高 |
| P2 | API接口资产检测（外部调用） | 中 |

---

## 9. 测试计划

### 9.1 单元测试

- `TreeSitterParser.parse_file()` - 各语言解析正确性
- `APIEndpointExtractor` - 各框架路由检测
- `CallGraphBuilder` - 调用关系提取
- `FileDependencyAnalyzer` - import/include检测
- `ControlFlowBuilder` - 分支节点提取

### 9.2 集成测试

- 快速审计任务完整流程
- 深度审计任务完整流程
- API端点数据正确性
- 前端展示正确性

### 9.3 测试项目

使用包含 Java、C、C++、JavaScript、TypeScript 的多语言项目进行测试。

---

## 10. 错误处理

### 10.1 解析错误处理

- **文件编码错误**: 跳过无法解码的文件，记录警告日志
- **语法错误**: 跳过有语法错误的文件，记录错误位置
- **不支持的语言**: 跳过非目标语言的文件，不中断分析

### 10.2 服务降级策略

| 场景 | 处理方式 |
|------|----------|
| tree-sitter解析失败 | 返回空结果，记录错误日志 |
| 内存不足 | 限制并发解析文件数，分批处理 |
| 超时 | 设置单文件解析超时（5秒），超时跳过 |

### 10.3 前端错误展示

- 分析数据为空时显示"暂无数据"
- API请求失败时显示错误提示
- 部分数据缺失时正常展示可用数据

---

## 11. 预期工作量

| 模块 | 预估工时 |
|------|----------|
| 后端服务开发 | 4-6小时 |
| 数据库迁移 | 0.5小时 |
| 后端API端点 | 1小时 |
| 前端组件开发 | 3-4小时 |
| 前端布局调整 | 1-2小时 |
| 测试 | 2-3小时 |
| **总计** | **11-16小时** |