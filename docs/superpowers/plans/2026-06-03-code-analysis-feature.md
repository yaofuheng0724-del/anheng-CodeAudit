# 源代码分析功能实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan.

**Goal:** 为快速审计和深度审计增加源代码分析功能（API接口资产、函数调用图、文件包含关系、控制流图）

**Architecture:** tree-sitter统一解析引擎，服务层提取分析结果，JSON存储，前端折叠面板展示

**Tech Stack:** tree-sitter (Python), React + Tailwind (前端)

---

## 文件结构总览

**后端新增文件：**
- `backend/app/services/code_analysis/__init__.py`
- `backend/app/services/code_analysis/service.py` - 主服务
- `backend/app/services/code_analysis/parser.py` - tree-sitter解析器
- `backend/app/services/code_analysis/extractors/__init__.py`
- `backend/app/services/code_analysis/extractors/base.py`
- `backend/app/services/code_analysis/extractors/api_endpoint.py`
- `backend/app/services/code_analysis/extractors/call_graph.py`
- `backend/app/services/code_analysis/extractors/file_dependency.py`
- `backend/app/services/code_analysis/extractors/control_flow.py`

**后端修改文件：**
- `backend/app/models/agent_task.py` - 添加JSON字段
- `backend/app/models/audit.py` - 添加JSON字段
- `backend/app/api/v1/endpoints/agent_tasks.py` - 添加API端点、集成分析服务
- `backend/app/api/v1/endpoints/tasks.py` - 添加API端点、集成分析服务

**前端新增文件：**
- `frontend/src/components/code-analysis/index.ts`
- `frontend/src/components/code-analysis/types.ts`
- `frontend/src/components/code-analysis/CodeAnalysisPanel.tsx`
- `frontend/src/components/code-analysis/APIAssetsList.tsx`
- `frontend/src/components/code-analysis/CallGraphTree.tsx`
- `frontend/src/components/code-analysis/FileDepsTree.tsx`
- `frontend/src/components/code-analysis/ControlFlowTree.tsx`

**前端修改文件：**
- `frontend/src/pages/TaskDetail.tsx` - 布局调整，添加分析面板
- `frontend/src/pages/AgentAudit/index.tsx` - 布局调整，添加分析面板

**数据库迁移：**
- `backend/alembic/versions/xxx_add_code_analysis_results.py`

---

## Task 1: 数据库迁移

**Files:**
- Create: `backend/alembic/versions/017_add_code_analysis_results.py`

- [ ] **Step 1: 创建迁移文件**

```python
"""add code_analysis_results

Revision ID: 017
"""

from alembic import op
import sqlalchemy as sa

revision = '017'
down_revision = '016'

def upgrade():
    op.add_column('tasks', sa.Column('code_analysis_results', sa.JSON(), nullable=True, server_default='{}'))
    op.add_column('agent_tasks', sa.Column('code_analysis_results', sa.JSON(), nullable=True, server_default='{}'))

def downgrade():
    op.drop_column('tasks', 'code_analysis_results')
    op.drop_column('agent_tasks', 'code_analysis_results')
```

- [ ] **Step 2: 运行迁移**

```bash
cd backend && alembic upgrade head
```

- [ ] **Step 3: 更新模型文件**

在 `agent_task.py` 和 `audit.py` 添加字段:
```python
code_analysis_results = Column(JSON, nullable=True, default={})
```

---

## Task 2: 后端服务 - 基础结构

**Files:**
- Create: `backend/app/services/code_analysis/__init__.py`
- Create: `backend/app/services/code_analysis/service.py`
- Create: `backend/app/services/code_analysis/parser.py`

- [ ] **Step 1: 创建目录和初始化文件**

```bash
mkdir -p backend/app/services/code_analysis/extractors
```

- [ ] **Step 2: 创建parser.py - tree-sitter解析器**

核心功能：
- 初始化5种语言解析器（Java, C, C++, JS, TS）
- `parse_file(file_path, language)` 方法
- `query(tree, query_string, language)` 方法

- [ ] **Step 3: 创建service.py - 主服务类**

核心功能：
- `analyze(project_root, language, exclude_patterns, target_files)` 方法
- 返回 `{api_endpoints, call_graph, file_dependencies, control_flow}`

- [ ] **Step 4: 安装依赖**

```bash
pip install tree-sitter tree-sitter-java tree-sitter-c tree-sitter-cpp tree-sitter-javascript tree-sitter-typescript
```

---

## Task 3: 后端服务 - 提取器实现

**Files:**
- Create: `backend/app/services/code_analysis/extractors/__init__.py`
- Create: `backend/app/services/code_analysis/extractors/base.py`
- Create: `backend/app/services/code_analysis/extractors/api_endpoint.py`
- Create: `backend/app/services/code_analysis/extractors/call_graph.py`
- Create: `backend/app/services/code_analysis/extractors/file_dependency.py`
- Create: `backend/app/services/code_analysis/extractors/control_flow.py`

- [ ] **Step 1: 创建base.py - 基础提取器抽象类**

- [ ] **Step 2: 创建file_dependency.py - 文件依赖提取（最简单）**

tree-sitter查询：
- Java: import语句
- C/C++: #include语句
- JS/TS: import/require语句

- [ ] **Step 3: 创建api_endpoint.py - API端点提取**

tree-sitter查询：
- Java: @RequestMapping, @GetMapping等注解
- JS/TS: app.get, router.get, @Get等

- [ ] **Step 4: 创建call_graph.py - 调用图提取**

tree-sitter查询：函数调用表达式

- [ ] **Step 5: 创建control_flow.py - 控制流提取**

tree-sitter查询：if/else/switch/for/while语句

---

## Task 4: 后端API端点

**Files:**
- Modify: `backend/app/api/v1/endpoints/tasks.py`
- Modify: `backend/app/api/v1/endpoints/agent_tasks.py`

- [ ] **Step 1: 在tasks.py添加API端点**

```python
@router.get("/{task_id}/code-analysis")
async def get_code_analysis(task_id: str, db: AsyncSession = Depends(get_db)):
    task = await db.get(AuditTask, task_id)
    if not task:
        raise HTTPException(404, "任务不存在")
    return task.code_analysis_results or {}
```

- [ ] **Step 2: 在agent_tasks.py添加API端点**

同上，使用AgentTask模型

---

## Task 5: 后端集成 - 快速审计

**Files:**
- Modify: `backend/app/services/scanner.py`

- [ ] **Step 1: 在扫描流程中集成代码分析**

在任务开始时调用CodeAnalysisService.analyze()
将结果存入task.code_analysis_results

---

## Task 6: 后端集成 - 深度审计

**Files:**
- Modify: `backend/app/api/v1/endpoints/agent_tasks.py`

- [ ] **Step 1: 在agent_tasks.py的_execute_agent_task中集成**

在preparation阶段调用CodeAnalysisService.analyze()
将结果存入agent_task.code_analysis_results
发送事件通知前端

---

## Task 7: 前端类型定义

**Files:**
- Create: `frontend/src/components/code-analysis/types.ts`

- [ ] **Step 1: 创建类型定义**

定义APIEndpoint, CallGraphNode, FileDependency, ControlFlowNode, CodeAnalysisResult类型

---

## Task 8: 前端组件 - 主面板

**Files:**
- Create: `frontend/src/components/code-analysis/CodeAnalysisPanel.tsx`
- Create: `frontend/src/components/code-analysis/index.ts`

- [ ] **Step 1: 创建CodeAnalysisPanel组件**

4个折叠面板，每个展示一种分析结果

- [ ] **Step 2: 创建index.ts导出**

---

## Task 9: 前端组件 - 子组件

**Files:**
- Create: `frontend/src/components/code-analysis/APIAssetsList.tsx`
- Create: `frontend/src/components/code-analysis/CallGraphTree.tsx`
- Create: `frontend/src/components/code-analysis/FileDepsTree.tsx`
- Create: `frontend/src/components/code-analysis/ControlFlowTree.tsx`

- [ ] **Step 1: 创建APIAssetsList组件**

列表展示API端点，支持展开折叠分组

- [ ] **Step 2: 创建CallGraphTree组件**

树形展示调用关系

- [ ] **Step 3: 创建FileDepsTree组件**

树形展示文件包含关系

- [ ] **Step 4: 创建ControlFlowTree组件**

树形展示控制流节点

---

## Task 10: 前端布局 - TaskDetail页面

**Files:**
- Modify: `frontend/src/pages/TaskDetail.tsx`

- [ ] **Step 1: 修改布局**

项目信息卡片右侧添加CodeAnalysisPanel（各占50%宽度）

---

## Task 11: 前端布局 - AgentAudit页面

**Files:**
- Modify: `frontend/src/pages/AgentAudit/index.tsx`

- [ ] **Step 1: 修改布局**

日志流右侧添加CodeAnalysisPanel（各占50%宽度）

---

## Task 12: 测试验证

- [ ] **Step 1: 测试后端API**

创建任务后访问 `/api/v1/tasks/{id}/code-analysis`

- [ ] **Step 2: 测试前端展示**

打开任务详情页面，查看代码分析面板

- [ ] **Step 3: 提交代码**

```bash
git add . && git commit -m "feat: add code analysis feature"
```