# 项目扫描类型设计 (Scan Mode on Project)

**日期**: 2026-06-04  
**状态**: 已批准  
**历史**: 取代了此前在 CreateTaskDialog 中选择扫描类型的设计；扫描类型成为项目属性。

---

## 目标

将「快速审计任务」创建对话框中的扫描类型选择（源代码 / 编译后产物）上提到项目创建/编辑流程中，使其成为项目的一个不可变属性。创建快速审计任务时，不再询问扫描类型，直接从项目读取。

## 决策清单

| 决策 | 结论 |
|------|------|
| 创建项目时的选择顺序 | 扫描类型第一 → 再按类型限制位置选项 |
| scan_mode 存储形式 | 新增 `Project.scan_mode` 字段 (source/compiled) |
| compiled_options 归属 | 随项目一起存储 (enable_sca + max_binary_size_mb) |
| 深度审计 vs compiled 项目 | compiled 项目不允许走深度审计，按钮置灰 + tooltip |
| 项目列表展示 | 加一个独立列显示扫描类型徽标 |
| scan_mode 可修改性 | 创建后锁定，编辑页只读 |

---

## 后端变更

### 1. Project 数据模型

`backend/app/models/project.py` 新增字段：

```python
scan_mode = Column(String(20), default="source", nullable=False)  # "source" | "compiled"
compiled_options = Column(Text, nullable=True)                     # JSON: {"enable_sca":bool, "max_binary_size_mb":int}
```

**约束**：
- `scan_mode='compiled'` 必须搭配 `source_type='zip'`（后端 CRUD 校验）。
- 已有项目默认获得 `scan_mode='source'`（向后兼容）。
- `scan_mode` 一旦创建不可修改（update 时忽略该字段）。

### 2. API Schema 变更

`backend/app/api/v1/endpoints/projects.py`：

```python
class ProjectCreate(BaseModel):
    name: str
    scan_mode: Optional[str] = "source"           # ← 新增
    compiled_options: Optional[Dict[str, Any]] = None  # ← 新增
    source_type: Optional[str] = "repository"
    # ... 其余不变

class ProjectUpdate(BaseModel):
    # scan_mode / compiled_options 不在此处出现 —— 不可改
    # ... 其余不变

class ProjectResponse(BaseModel):
    scan_mode: Optional[str] = "source"            # ← 新增
    compiled_options: Optional[Dict[str, Any]] = None  # ← 新增
    # ... 其余不变
```

### 3. scan_project 端点

`backend/app/api/v1/endpoints/projects.py` 中的 `scan_project`：

- `scan_request.scan_mode` 不传时使用 `project.scan_mode`。
- 如果传了但与 `project.scan_mode` 不一致则返回 400（防御性校验，前端已控制不出现此情况）。
- `scan_mode='compiled'` 时，`compiled_options` 从项目读取，不再要求 `scan_request` 提供。
- `scan_mode='compiled'` + `source_type='repository'` 仍返回 400（冗余保护）。

### 4. 前端类型

`frontend/src/shared/types/index.ts` 的 `Project` 和 `CreateProjectForm` 同步：

```typescript
export interface Project {
  scan_mode?: 'source' | 'compiled';        // ← 新增
  compiled_options?: {                       // ← 新增
    enable_sca: boolean;
    max_binary_size_mb: number;
  };
  // ... 不变
}

export interface CreateProjectForm {
  scan_mode?: 'source' | 'compiled';        // ← 新增
  compiled_options?: {
    enable_sca: boolean;
    max_binary_size_mb: number;
  };
  // ... 不变
}
```

---

## 前端变更

### 1. 项目创建流程 (Projects.tsx)

**现有布局**：
```
基本信息 → 项目位置(仓库地址/本地上传) → 技术栈
```

**新布局**：
```
基本信息 → 扫描类型(源代码/编译后产物) → 项目位置(由扫描类型决定) → 技术栈
```

#### ① 扫描类型选择区块

新建一个两层切换区，替代现有的"项目位置"中的 `source_type` 二选一（`source_type` 逻辑被下移到第二层）。

- **第一层（扫描平台类型）**：
  - `scan_mode='source'` 按钮（`源代码扫描 — 支持 Git 仓库和本地上传`）
  - `scan_mode='compiled'` 按钮（`编译后产物扫描 — 仅支持本地上传`）

- **第二层（项目位置）**：当 `scan_mode='source'` 时，用户二选一：
  - 「Git 仓库」→ 展示 repository_url / repository_type / default_branch（与现有完全一致）
  - 「本地上传」→ 展示 zip 上传区域（与现有完全一致）

  当 `scan_mode='compiled'` 时：
  - 「本地上传」强制选中态，只展示 zip/apk 上传区域
  - 文件 input 的 `accept` 扩展名扩充为 `.zip .rar .7z .tar .gz .tgz .tar.gz .apk .aab .dex`

#### ② Compiled Options 区块

仅 `scan_mode='compiled'` 时展开：
- `enable_sca` 勾选框（默认 true）
- `max_binary_size_mb` 数字输入（默认 200，范围 1-2048）
- 辅助文本："压缩包内支持的扩展名: .apk .aab .dex .so .dll .exe .elf — 其他文件将被忽略。"

#### ③ 表单提交

`handleCreateProject` / `handleUploadAndCreate` 中同步提交 `scan_mode` 和 `compiled_options` 字段。

### 2. 编辑项目对话框

在"基本信息"后增加一个只读信息块「扫描配置」：

- 扫描类型: `[源代码扫描]`（灰色选中态，不可操作）
- 代码来源: `[Git仓库]` / `[本地上传]`（与现有保持一致，可编辑）
- Compiled Options 不显示（因为 scan_mode 不可改）

`source_type` 保持可编辑（用户需更换仓库 URL 或重传 zip）。但：
- `scan_mode='compiled'` 时，`source_type` 自动锁定为 `zip` 且无法切换到 `repository`。
- `scan_mode='source'` 时，`source_type` 可自由切换（与现有一致）。

### 3. 项目列表

在 `Projects.tsx` 的项目表格中，「项目描述」和「开发语言」列之间插入新列「扫描类型」：

```tsx
// 列头
<th className="text-left py-2 px-3 font-medium">扫描类型</th>

// 单元格
<td className="py-2.5 px-3">
  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold
    {project.scan_mode === 'compiled'
      ? 'bg-purple-500/15 text-purple-600 border border-purple-500/30'
      : 'bg-blue-500/15 text-blue-600 border border-blue-500/30'}">
    {project.scan_mode === 'compiled' ? '编译后产物' : '源代码'}
  </span>
</td>
```

### 4. CreateTaskDialog

#### 删除的 UI

- 移除 `scanType` 单选框区（第 574-640 行）
- 移除 `scanType === "compiled"` 时的 `enableSca` / `maxBinarySizeMb` 配置区
- 移除 `scanType`、`enableSca`、`maxBinarySizeMb` 的 state 声明
- 移除 `compiledExtras` 拼装逻辑

#### 变更的任务启动逻辑

`handleStartScan` 中 fast 模式：
- 从 `selectedProject.scan_mode` 读取扫描类型（不再从本地 state）
- 从 `selectedProject.compiled_options` 读取 compiled 参数
- 拼装 `scan_config` 时使用项目上的值

#### 深度审计（Agent）按钮

当 `selectedProject.scan_mode === 'compiled'`：
- 「启动深度审计」按钮置灰，`disabled={true}`
- 鼠标悬停 tooltip 提示："编译后产物项目暂不支持深度审计"

### 5. TaskDetail.tsx 的 TaskDetail 页

- 右上角的"扫描类型"徽标不再依赖 `scan_config` 中的 `scan_mode`，改为从 `task.project.scan_mode` 读取（更可靠）。
- 若无 `task.project`，fallback 到 `scan_config.scan_mode`（兼容历史任务）。

---

## 变更文件清单

### 后端 (4 文件)

| 文件 | 变更 |
|------|------|
| `backend/app/models/project.py` | 新增 `scan_mode` + `compiled_options` 两列 |
| `backend/app/api/v1/endpoints/projects.py` | Schema 加字段、create 校验、update 忽略 scan_mode |
| *Alembic migration* | `add_column` 迁移脚本 |
| `backend/app/api/v1/endpoints/scan.py` | 两个端点（scan-zip / scan-stored-zip）加 fallback：`scan_request.scan_mode` 不传时从 `project.scan_mode` 读取 |

### 前端 (5 文件)

| 文件 | 变更 |
|------|------|
| `frontend/src/shared/types/index.ts` | `Project` + `CreateProjectForm` 加 scan_mode/compiled_options |
| `frontend/src/pages/Projects.tsx` | 创建 Sheet 重组；编辑 Sheet 加只读块；表格加列 |
| `frontend/src/components/audit/CreateTaskDialog.tsx` | 移除 scanType UI；任务启动从项目读 scan_mode；深度审计按钮条件置灰 |
| `frontend/src/features/projects/services/repoZipScan.ts` | 函数签名中 `scanMode` 参数改为可选，调用处从 `project` 对象读取 |
| `frontend/src/pages/TaskDetail.tsx` | 徽标从 `project.scan_mode` 读取 |

---

## 边界情况

| 场景 | 行为 |
|------|------|
| 已有项目（scan_mode 为空） | 迁移赋默认值 `source` |
| compiled 项目点击「深度审计」 | 按钮置灰 + tooltip |
| compiled 项目编辑时试图切 source_type=repository | 前端强制锁定为 zip，无可操作空间 |
| 创建 compiled 项目 → 传了 repository_url | 后端 400："编译后产物项目只能使用本地上传" |
| 在 CreateTaskDialog 中选一个 compiled 项目 + 不传 zip（无 storedZip、无 zipFile） | `canStart` 计算覆盖该情况，按钮可 disabled |
| scan_mode 不一致的项目 + 旧 schedule | 定时任务下次触发时按现有方式读取项目上的 scan_mode（项目已更新 → 后续走新值） |