# Dashboard 数据可视化页面重构设计文档

**日期**: 2026-05-31
**主题**: 将 Dashboard 从项目概览导向重构为风险洞察导向

---

## 一、设计目标

将系统主页仪表盘从「项目概览导向」转变为「风险洞察导向」，帮助安全人员快速定位高风险项目和问题，整体视觉风格与现有系统保持一致。

---

## 二、统计模块设计

### 模块 1：风险态势总览（顶部）

四个大数字卡片横排，展示核心风险指标：

| 指标卡片 | 数据来源 | 样式规格 |
|---------|---------|---------|
| **严重问题数** | severity=critical 的未解决问题总数 | 红色边框（border-rose-200），红色数字（text-rose-600），轻微脉冲动画 |
| **高危项目数** | 存在未解决 critical/high 问题且未解决数>0 的项目数 | 橙色边框（border-orange-200），橙色数字（text-orange-600） |
| **待解决问题数** | status ≠ resolved 的问题总数 | 黄色边框（border-amber-200），黄色数字（text-amber-600） |
| **今日新增问题** | created_at 为今天的 issue 数量 | Indigo 边框（border-primary/30），主色数字（text-primary） |

**组件规格**：
- 使用现有 `cyber-card` 基础样式
- 高度：h-24
- 内边距：p-4
- 响应式：grid-cols-2 sm:grid-cols-4
- 每个卡片左侧显示标签和数值，右侧显示图标

---

### 模块 2：风险分布矩阵（全宽）

项目 × 严重等级的二维分布表格：

| 规格项 | 说明 |
|-------|------|
| **行数据** | 按未解决问题总数降序排列的 TOP 10 项目 |
| **列数据** | 严重等级：严重（critical） / 高危（high） / 中危（medium） / 低危（low） |
| **单元格** | 显示该项目该等级的未解决问题数量，数量>0 时带对应 severity 背景色块 |
| **交互** | 点击单元格跳转到 `/projects/{project_id}?severity={level}` 问题过滤页 |
| **空状态** | 若无问题数据，显示 "暂无风险分布数据" empty-state |

**组件规格**：
- 使用现有 `cyber-table` 样式
- 表头背景：#F5F3FF
- 单元格内数字居中，使用 `severity-*` 类添加背景色块
- 响应式：overflow-x-auto 支持横向滚动

---

### 模块 3：问题热点地图 + 高频漏洞类型（左右分栏）

#### 左侧：问题热点地图

展示问题数量 TOP 10 的文件路径或目录：

| 规格项 | 说明 |
|-------|------|
| **数据来源** | 按 file_path 统计未解决问题数量，取 TOP 10 |
| **展示形式** | 横向列表，每项包含：文件路径（截断显示）+ 进度条 + 问题数标签 |
| **进度条** | 长度按比例计算（max=TOP1的数量），使用渐变背景 bg-gradient-to-r from-primary/40 to-primary/60 |
| **交互** | 点击跳转到问题列表页，按文件路径过滤 |

**组件规格**：
- 使用 `cyber-card` 包裹
- 内部列表项使用 hover:bg-muted/50 背景
- 进度条高度：h-2，圆角 rounded-full
- 响应式：左侧占 lg:col-span-1

#### 右侧：高频漏洞类型排行

展示问题类型 TOP 10：

| 规格项 | 说明 |
|-------|------|
| **数据来源** | 按 issue_type 统计未解决问题数量，取 TOP 10 |
| **展示形式** | 横向条形排行，每项包含：类型名称 + 横向条 + 数量标签 |
| **颜色编码** | 根据该类型中最高严重等级的颜色编码条形颜色 |
| **交互** | 点击跳转到问题列表页，按类型过滤 |

**组件规格**：
- 使用 `cyber-card` 包裹
- 条形使用 flex 布局 + w-[比例%] + bg-gradient-to-r
- 响应式：右侧占 lg:col-span-1

---

### 模块 4：解决进度追踪（全宽）

#### 左侧部分：双环形进度图

| 规格项 | 说明 |
|-------|------|
| **数据** | 发现问题总数 vs 已解决问题数 |
| **展示** | SVG 绘制两个同心环形，外环为发现总数，内环为已解决数 |
| **颜色** | 外环：bg-muted（灰色），内环：bg-primary（Indigo）或 bg-success（绿色） |
| **中心文字** | 显示解决百分比 "45%" |

**组件规格**：
- 使用 `cyber-card` 包裹
- SVG 尺寸：120x120
- 响应式：左侧占 md:col-span-1

#### 右侧部分：解决趋势面积图

| 规格项 | 说明 |
|-------|------|
| **数据** | 近7天每天已解决问题数量 |
| **展示** | recharts AreaChart 面积图 |
| **颜色** | fill: primary/30, stroke: primary |
| **X轴** | 日期（MM-DD 格式） |
| **Y轴** | 解决数量 |

**组件规格**：
- 使用 `cyber-card` 包裹
- 图表高度：h-[180px]
- 响应式：右侧占 md:col-span-3

---

### 模块 5：项目风险列表（底部）

展示所有项目按风险等级排序：

| 规格项 | 说明 |
|-------|------|
| **排序规则** | 按（严重问题数 × 4 + 高危问题数 × 2）加权得分降序 |
| **展示内容** | 项目名称 + 风险等级标签 + 问题摘要（严重/高危/中危/低危 数量） + 最近审计时间 |
| **卡片样式** | 使用现有 `project-card` 样式，左侧边框颜色按最高风险等级编码 |
| **交互** | 点击跳转到 `/projects/{project_id}` 详情页 |

**组件规格**：
- 使用 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 布局
- 每个卡片高度自适应
- 最多显示 12 个项目，超出显示 "查看更多" 链接

---

## 三、删除的模块

以下模块从 Dashboard 移除：

| 模块 | 原位置 | 删除原因 |
|------|--------|---------|
| 代码质量趋势折线图 | 中部左侧 | 不符合风险洞察导向 |
| 平均质量分卡片 | 顶部第四个 | 用户明确排除 |
| 项目概览卡片网格 | 中部全宽 | 改为底部风险列表形式 |
| 最近任务列表 | 中部右侧 | 与风险洞察无关 |
| 最新活动时间线 | 右侧边栏 | 与风险洞察无关 |
| 快速操作按钮组 | 右侧边栏 | 与风险洞察无关 |
| 系统状态栏 | 右侧边栏 | 与风险洞察无关 |
| 规则/模板数量统计 | 右侧边栏 | 与风险洞察无关 |

---

## 四、数据需求与 API 依赖

### 需要聚合计算的数据

| 数据项 | 计算方式 | 数据来源 |
|--------|---------|---------|
| 严重问题数 | filter issues by severity=critical, status≠resolved | `api.getAuditIssues()` + `agentFindings` |
| 高危项目数 | group issues by project_id, count critical/high with status≠resolved | 同上 + projects |
| 待解决问题数 | filter issues by status≠resolved | 同上 |
| 今日新增问题 | filter issues by created_at = today | 同上 |
| 项目风险分布矩阵 | group by project_id + severity | 同上 |
| 文件热点排行 | group by file_path, count issues | 同上 |
| 漏洞类型排行 | group by issue_type, count issues | 同上 |
| 解决进度 | count resolved / total | 同上 |
| 解决趋势 | group resolved issues by resolved_at date (近7天) | 同上 |

### API 调用策略

在 `loadDashboardData()` 函数中并发调用：
1. `api.getProjectStats()` - 基础统计
2. `api.getProjects()` - 项目列表
3. `api.getAuditTasks()` - 审计任务列表
4. `getAgentTasks()` - Agent 任务列表
5. 对每个已完成任务并发获取 issues/findings

---

## 五、页面结构代码骨架

```tsx
// Dashboard.tsx 结构骨架

export default function Dashboard() {
  // State 定义
  const [riskOverview, setRiskOverview] = useState<RiskOverviewData>({
    criticalIssues: 0,
    highRiskProjects: 0,
    pendingIssues: 0,
    todayNewIssues: 0,
  });
  const [riskMatrix, setRiskMatrix] = useState<RiskMatrixRow[]>([]);
  const [fileHotspots, setFileHotspots] = useState<FileHotspot[]>([]);
  const [vulnerabilityTypes, setVulnerabilityTypes] = useState<VulnTypeCount[]>([]);
  const [resolutionProgress, setResolutionProgress] = useState<ResolutionProgress>({
    total: 0,
    resolved: 0,
    trend: [],
  });
  const [projectRiskList, setProjectRiskList] = useState<ProjectRiskItem[]>([]);
  const [loading, setLoading] = useState(true);

  // 数据加载函数
  useEffect(() => { loadDashboardData(); }, []);

  return (
    <div className="space-y-4 px-6 pt-1 pb-6 bg-background min-h-screen font-mono relative">
      {/* 模块 1: 风险态势总览 */}
      <RiskOverviewCards data={riskOverview} />

      {/* 模块 2: 风险分布矩阵 */}
      <RiskMatrixTable data={riskMatrix} />

      {/* 模块 3: 左右分栏 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <FileHotspotsList data={fileHotspots} />
        <VulnerabilityTypesRanking data={vulnerabilityTypes} />
      </div>

      {/* 模块 4: 解决进度追踪 */}
      <ResolutionProgressSection data={resolutionProgress} />

      {/* 模块 5: 项目风险列表 */}
      <ProjectRiskList data={projectRiskList} />
    </div>
  );
}
```

---

## 六、技术实现要点

| 要点 | 具体说明 |
|------|---------|
| **图表库** | 继续使用 recharts（解决趋势面积图），其他图表用 CSS/SVG 实现 |
| **样式复用** | 复用现有 `cyber-card`、`cyber-table`、`cyber-badge`、`severity-*` 类名 |
| **颜色变量** | 使用 CSS 变量 `--primary`、`--warning`、`--destructive` 或 Tailwind 类 |
| **响应式** | Grid 布局：grid-cols-1 → sm:grid-cols-2 → lg:grid-cols-4 |
| **空状态** | 使用现有 `empty-state` 样式和图标 |
| **动画** | 仅严重问题卡片添加轻微 pulse 动画（可选） |

---

## 七、实现步骤规划

### 步骤 1：数据聚合逻辑
- 创建 `utils/dashboardAggregation.ts` 文件
- 实现各统计指标的聚合函数
- 处理 AuditIssue 和 AgentFinding 的统一聚合

### 步骤 2：子组件开发
- `RiskOverviewCards.tsx` - 风险态势总览卡片
- `RiskMatrixTable.tsx` - 风险分布矩阵表格
- `FileHotspotsList.tsx` - 文件热点排行
- `VulnerabilityTypesRanking.tsx` - 漏洞类型排行
- `ResolutionProgressSection.tsx` - 解决进度（环形图 + 趋势图）
- `ProjectRiskList.tsx` - 项目风险卡片列表

### 步骤 3：主页面重构
- 重写 `Dashboard.tsx` 主组件
- 调用新的数据聚合逻辑
- 组合所有子组件

### 步骤 4：样式调整
- 添加必要的新 CSS 类（如进度条、环形图）
- 确保响应式布局正确

### 步骤 5：测试验证
- 验证各统计指标计算正确
- 验证空状态显示正常
- 验证交互跳转正确

---

## 八、类型定义

```typescript
// 新增类型定义

interface RiskOverviewData {
  criticalIssues: number;
  highRiskProjects: number;
  pendingIssues: number;
  todayNewIssues: number;
}

interface RiskMatrixRow {
  projectId: string;
  projectName: string;
  critical: number;
  high: number;
  medium: number;
  low: number;
  total: number;
}

interface FileHotspot {
  filePath: string;
  issueCount: number;
  maxSeverity: 'critical' | 'high' | 'medium' | 'low';
}

interface VulnTypeCount {
  type: string;
  typeName: string;
  count: number;
  maxSeverity: 'critical' | 'high' | 'medium' | 'low';
}

interface ResolutionProgress {
  total: number;
  resolved: number;
  percentage: number;
  trend: Array<{ date: string; count: number }>;
}

interface ProjectRiskItem {
  projectId: string;
  projectName: string;
  projectDescription?: string;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  totalIssues: number;
  riskScore: number; // critical*4 + high*2 + medium*1
  maxSeverity: 'critical' | 'high' | 'medium' | 'low';
  lastAuditAt?: string;
}
```