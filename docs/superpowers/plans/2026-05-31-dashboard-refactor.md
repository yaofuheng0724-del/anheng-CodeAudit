# Dashboard 数据可视化重构实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 Dashboard 页面从项目概览导向重构为风险洞察导向，包含 5 个新统计模块

**Architecture:** 创建 Dashboard 目录结构，将组件、类型、工具函数分离；使用现有 cyber-* 样式类和 recharts 图表库；前端聚合 AuditIssue + AgentFinding 数据

**Tech Stack:** React, TypeScript, Tailwind CSS, recharts, lucide-react

---

## 文件结构

```
frontend/src/pages/Dashboard/
├── index.tsx                      # 主 Dashboard 页面组件
├── types.ts                       # 类型定义
├── utils/
│   └── aggregation.ts             # 数据聚合函数
├── components/
│   ├── index.ts                   # 组件导出索引
│   ├── RiskOverviewCards.tsx      # 模块1: 风险态势总览
│   ├── RiskMatrixTable.tsx        # 模块2: 风险分布矩阵
│   ├── FileHotspotsList.tsx       # 模块3左: 文件热点排行
│   ├── VulnerabilityTypesRanking.tsx # 模块3右: 漏洞类型排行
│   ├── ResolutionProgressSection.tsx  # 模块4: 解决进度
│   └── ProjectRiskList.tsx        # 模块5: 项目风险列表
```

---

## Task 1: 创建类型定义

**Files:**
- Create: `frontend/src/pages/Dashboard/types.ts`

- [ ] **Step 1: 创建类型定义文件**

```typescript
/**
 * Dashboard 类型定义
 * 风险洞察导向的数据可视化页面
 */

import type { AuditIssue, Project, AuditTask } from "@/shared/types";
import type { AgentTask, AgentFinding } from "@/shared/api/agentTasks";

// ============ 统计数据类型 ============

/** 风险态势总览数据 */
export interface RiskOverviewData {
  criticalIssues: number;      // 严重问题数
  highRiskProjects: number;    // 高危项目数
  pendingIssues: number;       // 待解决问题数
  todayNewIssues: number;      // 今日新增问题
}

/** 风险分布矩阵行数据 */
export interface RiskMatrixRow {
  projectId: string;
  projectName: string;
  critical: number;            // 严重问题数
  high: number;                 // 高危问题数
  medium: number;               // 中危问题数
  low: number;                  // 低危问题数
  total: number;                // 未解决问题总数
}

/** 文件热点数据 */
export interface FileHotspot {
  filePath: string;
  shortPath: string;           // 截断显示的路径
  issueCount: number;
  maxSeverity: 'critical' | 'high' | 'medium' | 'low';
}

/** 漏洞类型统计 */
export interface VulnTypeCount {
  type: string;                // issue_type 或 vulnerability_type
  typeName: string;            // 显示名称
  count: number;
  maxSeverity: 'critical' | 'high' | 'medium' | 'low';
}

/** 解决进度数据 */
export interface ResolutionProgress {
  total: number;               // 发现问题总数
  resolved: number;            // 已解决问题数
  percentage: number;          // 解决百分比
  trend: Array<{               // 近7天解决趋势
    date: string;
    count: number;
  }>;
}

/** 项目风险项 */
export interface ProjectRiskItem {
  projectId: string;
  projectName: string;
  projectDescription?: string;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  totalIssues: number;         // 未解决问题总数
  riskScore: number;           // 风险加权分: critical*4 + high*2 + medium*1
  maxSeverity: 'critical' | 'high' | 'medium' | 'low';
  lastAuditAt?: string;
}

// ============ 聚合数据来源类型 ============

/** 统一的 Issue 数据结构（用于聚合） */
export interface UnifiedIssue {
  id: string;
  projectId: string;
  projectName: string;
  taskId: string;
  taskKind: 'audit' | 'agent';
  filePath: string | null;
  severity: 'critical' | 'high' | 'medium' | 'low';
  issueType: string;           // bug, security, performance 等
  status: string;              // open, pending_review, resolved, false_positive
  createdAt: string;
  resolvedAt: string | null;
}

/** 聚合后的 Dashboard 全量数据 */
export interface DashboardAggregatedData {
  riskOverview: RiskOverviewData;
  riskMatrix: RiskMatrixRow[];
  fileHotspots: FileHotspot[];
  vulnerabilityTypes: VulnTypeCount[];
  resolutionProgress: ResolutionProgress;
  projectRiskList: ProjectRiskItem[];
}

// ============ 组件 Props 类型 ============

export interface RiskOverviewCardsProps {
  data: RiskOverviewData;
  loading?: boolean;
}

export interface RiskMatrixTableProps {
  data: RiskMatrixRow[];
  loading?: boolean;
}

export interface FileHotspotsListProps {
  data: FileHotspot[];
  loading?: boolean;
}

export interface VulnerabilityTypesRankingProps {
  data: VulnTypeCount[];
  loading?: boolean;
}

export interface ResolutionProgressSectionProps {
  data: ResolutionProgress;
  loading?: boolean;
}

export interface ProjectRiskListProps {
  data: ProjectRiskItem[];
  loading?: boolean;
}

// ============ 辅助类型 ============

/** 严重等级颜色映射 */
export type SeverityLevel = 'critical' | 'high' | 'medium' | 'low';

export const SEVERITY_COLORS: Record<SeverityLevel, { bg: string; text: string; border: string }> = {
  critical: { bg: 'bg-rose-50', text: 'text-rose-600', border: 'border-rose-200' },
  high: { bg: 'bg-orange-50', text: 'text-orange-600', border: 'border-orange-200' },
  medium: { bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-200' },
  low: { bg: 'bg-primary/5', text: 'text-primary', border: 'border-primary/20' },
};

/** 问题类型中文映射 */
export const ISSUE_TYPE_NAMES: Record<string, string> = {
  security: '安全问题',
  bug: '潜在Bug',
  performance: '性能问题',
  style: '代码风格',
  maintainability: '可维护性',
  sql_injection: 'SQL注入',
  xss: 'XSS跨站脚本',
  hardcoded_credentials: '硬编码密码',
  path_traversal: '路径遍历',
  crypto_weakness: '加密弱点',
  insecure_deserialization: '不安全反序列化',
  command_injection: '命令注入',
  open_redirect: '开放重定向',
  ssrf: 'SSRF服务端请求伪造',
  information_disclosure: '信息泄露',
  authentication_bypass: '认证绕过',
  access_control: '访问控制缺陷',
};
```

---

## Task 2: 创建数据聚合函数

**Files:**
- Create: `frontend/src/pages/Dashboard/utils/aggregation.ts`

- [ ] **Step 1: 创建数据聚合函数文件**

```typescript
/**
 * Dashboard 数据聚合函数
 * 将 AuditIssue 和 AgentFinding 转换为统计展示数据
 */

import type { AuditIssue, Project, AuditTask } from "@/shared/types";
import type { AgentTask, AgentFinding } from "@/shared/api/agentTasks";
import type {
  UnifiedIssue,
  RiskOverviewData,
  RiskMatrixRow,
  FileHotspot,
  VulnTypeCount,
  ResolutionProgress,
  ProjectRiskItem,
  DashboardAggregatedData,
  SeverityLevel,
  ISSUE_TYPE_NAMES,
} from "../types";

// ============ 辅助函数 ============

/** 判断问题是否未解决 */
function isUnresolved(status: string): boolean {
  return status !== 'resolved' && status !== 'false_positive';
}

/** 获取今日日期字符串 (YYYY-MM-DD) */
function getTodayDateString(): string {
  return new Date().toISOString().split('T')[0];
}

/** 截断文件路径显示 */
function truncateFilePath(filePath: string, maxLength = 40): string {
  if (filePath.length <= maxLength) return filePath;
  const parts = filePath.split('/');
  if (parts.length <= 2) return filePath.slice(0, maxLength) + '...';
  // 显示最后两个路径部分
  return '.../' + parts.slice(-2).join('/');
}

/** 计算风险加权分 */
function calculateRiskScore(critical: number, high: number, medium: number): number {
  return critical * 4 + high * 2 + medium * 1;
}

/** 获取最高严重等级 */
function getMaxSeverity(
  critical: number,
  high: number,
  medium: number,
  low: number
): SeverityLevel {
  if (critical > 0) return 'critical';
  if (high > 0) return 'high';
  if (medium > 0) return 'medium';
  return 'low';
}

// ============ 数据转换函数 ============

/** 将 AuditIssue 转换为 UnifiedIssue */
function auditIssueToUnified(
  issue: AuditIssue,
  projectName: string
): UnifiedIssue {
  return {
    id: issue.id,
    projectId: issue.task_id, // 注意: AuditIssue 的 task_id 实际是 project_id 关联
    projectName: projectName,
    taskId: issue.task_id,
    taskKind: 'audit',
    filePath: issue.file_path,
    severity: issue.severity as SeverityLevel,
    issueType: issue.issue_type,
    status: issue.status,
    createdAt: issue.created_at,
    resolvedAt: issue.resolved_at,
  };
}

/** 将 AgentFinding 转换为 UnifiedIssue */
function agentFindingToUnified(
  finding: AgentFinding,
  projectId: string,
  projectName: string,
  taskId: string
): UnifiedIssue {
  return {
    id: finding.id,
    projectId: projectId,
    projectName: projectName,
    taskId: taskId,
    taskKind: 'agent',
    filePath: finding.file_path,
    severity: finding.severity as SeverityLevel,
    issueType: finding.vulnerability_type,
    status: finding.status,
    createdAt: finding.created_at,
    resolvedAt: null, // AgentFinding 没有 resolved_at 字段，根据 status 判断
  };
}

// ============ 聚合计算函数 ============

/** 计算风险态势总览 */
export function calculateRiskOverview(unifiedIssues: UnifiedIssue[]): RiskOverviewData {
  const criticalIssues = unifiedIssues.filter(
    i => i.severity === 'critical' && isUnresolved(i.status)
  ).length;

  // 高危项目: 存在 critical/high 未解决问题的项目数
  const highRiskProjectIds = new Set(
    unifiedIssues
      .filter(i => (i.severity === 'critical' || i.severity === 'high') && isUnresolved(i.status))
      .map(i => i.projectId)
  );

  const pendingIssues = unifiedIssues.filter(i => isUnresolved(i.status)).length;

  const today = getTodayDateString();
  const todayNewIssues = unifiedIssues.filter(i => i.createdAt.startsWith(today)).length;

  return {
    criticalIssues,
    highRiskProjects: highRiskProjectIds.size,
    pendingIssues,
    todayNewIssues,
  };
}

/** 计算风险分布矩阵 */
export function calculateRiskMatrix(
  unifiedIssues: UnifiedIssue[],
  projects: Project[]
): RiskMatrixRow[] {
  // 按项目分组统计
  const projectMap = new Map<string, RiskMatrixRow>();

  // 初始化项目数据
  for (const project of projects) {
    projectMap.set(project.id, {
      projectId: project.id,
      projectName: project.name,
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      total: 0,
    });
  }

  // 统计问题
  for (const issue of unifiedIssues) {
    if (!isUnresolved(issue.status)) continue;
    
    let row = projectMap.get(issue.projectId);
    if (!row) {
      // 如果项目不在列表中，创建临时行
      row = {
        projectId: issue.projectId,
        projectName: issue.projectName || '未知项目',
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
        total: 0,
      };
      projectMap.set(issue.projectId, row);
    }

    row[issue.severity]++;
    row.total++;
  }

  // 按总数降序排列，取 TOP 10
  const rows = Array.from(projectMap.values())
    .filter(r => r.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

  return rows;
}

/** 计算文件热点排行 */
export function calculateFileHotspots(unifiedIssues: UnifiedIssue[]): FileHotspot[] {
  const fileMap = new Map<string, { count: number; severities: SeverityLevel[] }>();

  for (const issue of unifiedIssues) {
    if (!isUnresolved(issue.status) || !issue.filePath) continue;

    const existing = fileMap.get(issue.filePath) || { count: 0, severities: [] };
    existing.count++;
    existing.severities.push(issue.severity);
    fileMap.set(issue.filePath, existing);
  }

  // 转换并排序
  const hotspots: FileHotspot[] = Array.from(fileMap.entries())
    .map(([filePath, data]) => ({
      filePath,
      shortPath: truncateFilePath(filePath),
      issueCount: data.count,
      maxSeverity: getMaxSeverity(
        data.severities.filter(s => s === 'critical').length,
        data.severities.filter(s => s === 'high').length,
        data.severities.filter(s => s === 'medium').length,
        data.severities.filter(s => s === 'low').length
      ),
    }))
    .sort((a, b) => b.issueCount - a.issueCount)
    .slice(0, 10);

  return hotspots;
}

/** 计算漏洞类型排行 */
export function calculateVulnerabilityTypes(
  unifiedIssues: UnifiedIssue[],
  typeNames: Record<string, string>
): VulnTypeCount[] {
  const typeMap = new Map<string, { count: number; severities: SeverityLevel[] }>();

  for (const issue of unifiedIssues) {
    if (!isUnresolved(issue.status)) continue;

    const existing = typeMap.get(issue.issueType) || { count: 0, severities: [] };
    existing.count++;
    existing.severities.push(issue.severity);
    typeMap.set(issue.issueType, existing);
  }

  // 转换并排序
  const types: VulnTypeCount[] = Array.from(typeMap.entries())
    .map(([type, data]) => ({
      type,
      typeName: typeNames[type] || type,
      count: data.count,
      maxSeverity: getMaxSeverity(
        data.severities.filter(s => s === 'critical').length,
        data.severities.filter(s => s === 'high').length,
        data.severities.filter(s => s === 'medium').length,
        data.severities.filter(s => s === 'low').length
      ),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return types;
}

/** 计算解决进度 */
export function calculateResolutionProgress(unifiedIssues: UnifiedIssue[]): ResolutionProgress {
  const total = unifiedIssues.length;
  const resolved = unifiedIssues.filter(i => i.status === 'resolved').length;
  const percentage = total > 0 ? Math.round((resolved / total) * 100) : 0;

  // 近7天解决趋势
  const trend: Array<{ date: string; count: number }> = [];
  const resolvedIssues = unifiedIssues.filter(i => i.status === 'resolved');
  
  // 生成近7天的日期
  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    
    const count = resolvedIssues.filter(issue => {
      // AgentFinding 没有 resolved_at，用 created_at 近似
      const resolveDate = issue.resolvedAt || issue.createdAt;
      return resolveDate && resolveDate.startsWith(dateStr);
    }).length;

    trend.push({
      date: date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' }),
      count,
    });
  }

  return { total, resolved, percentage, trend };
}

/** 计算项目风险列表 */
export function calculateProjectRiskList(
  unifiedIssues: UnifiedIssue[],
  projects: Project[],
  auditTasks: AuditTask[],
  agentTasks: AgentTask[]
): ProjectRiskItem[] {
  const projectMap = new Map<string, ProjectRiskItem>();

  // 初始化项目数据
  for (const project of projects) {
    projectMap.set(project.id, {
      projectId: project.id,
      projectName: project.name,
      projectDescription: project.description,
      criticalCount: 0,
      highCount: 0,
      mediumCount: 0,
      lowCount: 0,
      totalIssues: 0,
      riskScore: 0,
      maxSeverity: 'low',
      lastAuditAt: undefined,
    });
  }

  // 统计问题
  for (const issue of unifiedIssues) {
    if (!isUnresolved(issue.status)) continue;

    let item = projectMap.get(issue.projectId);
    if (!item) {
      item = {
        projectId: issue.projectId,
        projectName: issue.projectName || '未知项目',
        criticalCount: 0,
        highCount: 0,
        mediumCount: 0,
        lowCount: 0,
        totalIssues: 0,
        riskScore: 0,
        maxSeverity: 'low',
        lastAuditAt: undefined,
      };
      projectMap.set(issue.projectId, item);
    }

    switch (issue.severity) {
      case 'critical': item.criticalCount++; break;
      case 'high': item.highCount++; break;
      case 'medium': item.mediumCount++; break;
      case 'low': item.lowCount++; break;
    }
    item.totalIssues++;
  }

  // 计算风险分和最高等级，并获取最近审计时间
  for (const [projectId, item] of projectMap) {
    item.riskScore = calculateRiskScore(item.criticalCount, item.highCount, item.mediumCount);
    item.maxSeverity = getMaxSeverity(
      item.criticalCount,
      item.highCount,
      item.mediumCount,
      item.lowCount
    );

    // 查找最近审计时间
    const projectTasks = auditTasks.filter(t => t.project_id === projectId && t.completed_at);
    const projectAgentTasks = agentTasks.filter(t => t.project_id === projectId && t.completed_at);
    
    const allDates = [
      ...projectTasks.map(t => t.completed_at!),
      ...projectAgentTasks.map(t => t.completed_at!),
    ].sort().reverse();

    if (allDates.length > 0) {
      item.lastAuditAt = allDates[0];
    }
  }

  // 按风险分降序排列
  const items = Array.from(projectMap.values())
    .filter(item => item.totalIssues > 0)
    .sort((a, b) => b.riskScore - a.riskScore);

  return items;
}

// ============ 主聚合函数 ============

/** 聚合所有 Dashboard 数据 */
export function aggregateDashboardData(
  projects: Project[],
  auditTasks: AuditTask[],
  agentTasks: AgentTask[],
  auditIssues: AuditIssue[],
  agentFindings: AgentFinding[],
  typeNames: Record<string, string>
): DashboardAggregatedData {
  // 转换为统一格式
  const unifiedIssues: UnifiedIssue[] = [];

  // 创建 projectId -> projectName 映射
  const projectNameMap = new Map<string, string>();
  for (const project of projects) {
    projectNameMap.set(project.id, project.name);
  }
  // 也从 auditTasks 获取项目名
  for (const task of auditTasks) {
    if (task.project?.name) {
      projectNameMap.set(task.project_id, task.project.name);
    }
  }

  // 转换 AuditIssue
  for (const issue of auditIssues) {
    const projectName = projectNameMap.get(issue.task_id) || '未知项目';
    unifiedIssues.push(auditIssueToUnified(issue, projectName));
  }

  // 转换 AgentFinding
  for (const finding of agentFindings) {
    // 找到对应的 task 获取 projectId
    const task = agentTasks.find(t => t.id === finding.task_id);
    const projectId = task?.project_id || finding.task_id;
    const projectName = projectNameMap.get(projectId) || task?.name || '未知项目';
    unifiedIssues.push(agentFindingToUnified(finding, projectId, projectName, finding.task_id));
  }

  // 计算各统计数据
  const riskOverview = calculateRiskOverview(unifiedIssues);
  const riskMatrix = calculateRiskMatrix(unifiedIssues, projects);
  const fileHotspots = calculateFileHotspots(unifiedIssues);
  const vulnerabilityTypes = calculateVulnerabilityTypes(unifiedIssues, typeNames);
  const resolutionProgress = calculateResolutionProgress(unifiedIssues);
  const projectRiskList = calculateProjectRiskList(unifiedIssues, projects, auditTasks, agentTasks);

  return {
    riskOverview,
    riskMatrix,
    fileHotspots,
    vulnerabilityTypes,
    resolutionProgress,
    projectRiskList,
  };
}
```

---

## Task 3: 创建风险态势总览卡片组件

**Files:**
- Create: `frontend/src/pages/Dashboard/components/RiskOverviewCards.tsx`

- [ ] **Step 1: 创建 RiskOverviewCards 组件**

```typescript
/**
 * RiskOverviewCards - 风险态势总览
 * 顶部四个大数字卡片，展示核心风险指标
 */

import { memo } from "react";
import { AlertTriangle, Building2, Clock, PlusCircle } from "lucide-react";
import type { RiskOverviewCardsProps, SeverityLevel } from "../types";

// 卡片配置
const CARD_CONFIG = [
  {
    key: 'criticalIssues',
    label: '严重问题',
    icon: AlertTriangle,
    severity: 'critical' as SeverityLevel,
    borderColor: 'border-rose-200',
    textColor: 'text-rose-600',
    bgColor: 'bg-rose-50',
    iconBg: 'bg-rose-100',
    animate: true, // 严重问题卡片添加脉冲动画
  },
  {
    key: 'highRiskProjects',
    label: '高危项目',
    icon: Building2,
    severity: 'high' as SeverityLevel,
    borderColor: 'border-orange-200',
    textColor: 'text-orange-600',
    bgColor: 'bg-orange-50',
    iconBg: 'bg-orange-100',
    animate: false,
  },
  {
    key: 'pendingIssues',
    label: '待解决问题',
    icon: Clock,
    severity: 'medium' as SeverityLevel,
    borderColor: 'border-amber-200',
    textColor: 'text-amber-600',
    bgColor: 'bg-amber-50',
    iconBg: 'bg-amber-100',
    animate: false,
  },
  {
    key: 'todayNewIssues',
    label: '今日新增',
    icon: PlusCircle,
    severity: 'low' as SeverityLevel,
    borderColor: 'border-primary/30',
    textColor: 'text-primary',
    bgColor: 'bg-primary/5',
    iconBg: 'bg-primary/10',
    animate: false,
  },
];

export const RiskOverviewCards = memo(function RiskOverviewCards({
  data,
  loading = false,
}: RiskOverviewCardsProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {CARD_CONFIG.map((config) => (
          <div
            key={config.key}
            className="cyber-card p-4 h-24 flex items-center justify-center"
          >
            <div className="loading-spinner" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {CARD_CONFIG.map((config) => {
        const value = data[config.key as keyof typeof data];
        const Icon = config.icon;

        return (
          <div
            key={config.key}
            className={`cyber-card p-4 h-24 border ${config.borderColor} ${config.animate && value > 0 ? 'animate-pulse' : ''}`}
            style={{ borderWidth: '2px' }}
          >
            <div className="flex items-center justify-between h-full">
              <div className="flex flex-col">
                <p className="stat-label text-xs">{config.label}</p>
                <p className={`stat-value text-2xl font-bold ${config.textColor}`}>
                  {value}
                </p>
              </div>
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${config.iconBg}`}>
                <Icon className={`w-5 h-5 ${config.textColor}`} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
});

export default RiskOverviewCards;
```

---

## Task 4: 创建风险分布矩阵表格组件

**Files:**
- Create: `frontend/src/pages/Dashboard/components/RiskMatrixTable.tsx`

- [ ] **Step 1: 创建 RiskMatrixTable 组件**

```typescript
/**
 * RiskMatrixTable - 风险分布矩阵
 * 项目 × 严重等级的二维分布表格
 */

import { memo } from "react";
import { Link } from "react-router-dom";
import { Grid3X3, AlertTriangle } from "lucide-react";
import type { RiskMatrixTableProps, SeverityLevel } from "../types";
import { SEVERITY_COLORS } from "../types";

// 严重等级列配置
const SEVERITY_COLUMNS: Array<{ key: SeverityLevel; label: string }> = [
  { key: 'critical', label: '严重' },
  { key: 'high', label: '高危' },
  { key: 'medium', label: '中危' },
  { key: 'low', label: '低危' },
];

// 渲染带背景色的单元格数字
function SeverityCell({
  count,
  severity,
  projectId,
}: {
  count: number;
  severity: SeverityLevel;
  projectId: string;
}) {
  if (count === 0) {
    return <span className="text-muted-foreground text-center">0</span>;
  }

  const colors = SEVERITY_COLORS[severity];

  return (
    <Link
      to={`/projects/${projectId}?severity=${severity}`}
      className={`inline-flex items-center justify-center px-2 py-1 rounded-md ${colors.bg} ${colors.text} ${colors.border} font-semibold text-sm hover:opacity-80 transition-opacity`}
    >
      {count}
    </Link>
  );
}

export const RiskMatrixTable = memo(function RiskMatrixTable({
  data,
  loading = false,
}: RiskMatrixTableProps) {
  if (loading) {
    return (
      <div className="cyber-card p-3">
        <div className="section-header">
          <Grid3X3 className="w-5 h-5 text-primary" />
          <h3 className="section-title">风险分布矩阵</h3>
        </div>
        <div className="flex items-center justify-center h-[200px]">
          <div className="loading-spinner" />
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="cyber-card p-3">
        <div className="section-header">
          <Grid3X3 className="w-5 h-5 text-primary" />
          <h3 className="section-title">风险分布矩阵</h3>
        </div>
        <div className="empty-state h-[200px]">
          <AlertTriangle className="empty-state-icon" />
          <p className="empty-state-description">暂无风险分布数据</p>
        </div>
      </div>
    );
  }

  return (
    <div className="cyber-card p-3">
      <div className="section-header">
        <Grid3X3 className="w-5 h-5 text-primary" />
        <h3 className="section-title">风险分布矩阵</h3>
        <span className="text-xs text-muted-foreground ml-auto">
          按 TOP 10 项目未解决问题数排序
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="cyber-table">
          <thead>
            <tr>
              <th className="text-left">项目</th>
              {SEVERITY_COLUMNS.map((col) => (
                <th key={col.key} className="text-center">{col.label}</th>
              ))}
              <th className="text-center">总计</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr key={row.projectId}>
                <td>
                  <Link
                    to={`/projects/${row.projectId}`}
                    className="font-medium text-foreground hover:text-primary transition-colors"
                  >
                    {row.projectName}
                  </Link>
                </td>
                {SEVERITY_COLUMNS.map((col) => (
                  <td key={col.key} className="text-center">
                    <SeverityCell
                      count={row[col.key]}
                      severity={col.key}
                      projectId={row.projectId}
                    />
                  </td>
                ))}
                <td className="text-center font-bold text-foreground">
                  {row.total}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
});

export default RiskMatrixTable;
```

---

## Task 5: 创建文件热点排行组件

**Files:**
- Create: `frontend/src/pages/Dashboard/components/FileHotspotsList.tsx`

- [ ] **Step 1: 创建 FileHotspotsList 组件**

```typescript
/**
 * FileHotspotsList - 文件热点排行
 * 展示问题数量 TOP 10 的文件路径
 */

import { memo } from "react";
import { Link } from "react-router-dom";
import { FileCode, AlertTriangle } from "lucide-react";
import type { FileHotspotsListProps, SeverityLevel } from "../types";
import { SEVERITY_COLORS } from "../types";

// 进度条颜色映射（渐变）
const PROGRESS_COLORS: Record<SeverityLevel, { from: string; to: string }> = {
  critical: { from: 'from-rose-400', to: 'to-rose-500' },
  high: { from: 'from-orange-400', to: 'to-orange-500' },
  medium: { from: 'from-amber-400', to: 'to-amber-500' },
  low: { from: 'from-primary/40', to: 'to-primary/60' },
};

export const FileHotspotsList = memo(function FileHotspotsList({
  data,
  loading = false,
}: FileHotspotsListProps) {
  if (loading) {
    return (
      <div className="cyber-card p-3">
        <div className="section-header">
          <FileCode className="w-5 h-5 text-primary" />
          <h3 className="section-title">问题热点地图</h3>
        </div>
        <div className="flex items-center justify-center h-[180px]">
          <div className="loading-spinner" />
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="cyber-card p-3">
        <div className="section-header">
          <FileCode className="w-5 h-5 text-primary" />
          <h3 className="section-title">问题热点地图</h3>
        </div>
        <div className="empty-state h-[180px]">
          <FileCode className="empty-state-icon" />
          <p className="empty-state-description">暂无文件热点数据</p>
        </div>
      </div>
    );
  }

  const maxCount = data[0]?.issueCount || 1;

  return (
    <div className="cyber-card p-3">
      <div className="section-header">
        <FileCode className="w-5 h-5 text-primary" />
        <h3 className="section-title">问题热点地图</h3>
        <span className="text-xs text-muted-foreground ml-auto">
          TOP 10 文件
        </span>
      </div>

      <div className="space-y-2">
        {data.map((item, index) => {
          const percentage = (item.issueCount / maxCount) * 100;
          const colors = PROGRESS_COLORS[item.maxSeverity];

          return (
            <Link
              key={`${item.filePath}-${index}`}
              to={`/issues?file_path=${encodeURIComponent(item.filePath)}`}
              className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors group"
            >
              <span className="text-xs text-muted-foreground w-5 text-right font-mono">
                {index + 1}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-foreground truncate group-hover:text-primary transition-colors">
                    {item.shortPath}
                  </span>
                  <span className={`text-sm font-semibold ${SEVERITY_COLORS[item.maxSeverity].text}`}>
                    {item.issueCount}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full bg-gradient-to-r ${colors.from} ${colors.to} transition-all duration-300`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
});

export default FileHotspotsList;
```

---

## Task 6: 创建漏洞类型排行组件

**Files:**
- Create: `frontend/src/pages/Dashboard/components/VulnerabilityTypesRanking.tsx`

- [ ] **Step 1: 创建 VulnerabilityTypesRanking 组件**

```typescript
/**
 * VulnerabilityTypesRanking - 漏洞类型排行
 * 展示问题类型 TOP 10
 */

import { memo } from "react";
import { Link } from "react-router-dom";
import { Bug, ShieldCheck } from "lucide-react";
import type { VulnerabilityTypesRankingProps, SeverityLevel } from "../types";
import { SEVERITY_COLORS } from "../types";

// 条形颜色映射（渐变）
const BAR_COLORS: Record<SeverityLevel, { from: string; to: string }> = {
  critical: { from: 'from-rose-500', to: 'to-rose-600' },
  high: { from: 'from-orange-500', to: 'to-orange-600' },
  medium: { from: 'from-amber-500', to: 'to-amber-600' },
  low: { from: 'from-primary', to: 'to-primary/80' },
};

export const VulnerabilityTypesRanking = memo(function VulnerabilityTypesRanking({
  data,
  loading = false,
}: VulnerabilityTypesRankingProps) {
  if (loading) {
    return (
      <div className="cyber-card p-3">
        <div className="section-header">
          <Bug className="w-5 h-5 text-secondary" />
          <h3 className="section-title">高频漏洞类型</h3>
        </div>
        <div className="flex items-center justify-center h-[180px]">
          <div className="loading-spinner" />
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="cyber-card p-3">
        <div className="section-header">
          <Bug className="w-5 h-5 text-secondary" />
          <h3 className="section-title">高频漏洞类型</h3>
        </div>
        <div className="empty-state h-[180px]">
          <ShieldCheck className="empty-state-icon" />
          <p className="empty-state-description">暂无漏洞类型数据</p>
        </div>
      </div>
    );
  }

  const maxCount = data[0]?.count || 1;

  return (
    <div className="cyber-card p-3">
      <div className="section-header">
        <Bug className="w-5 h-5 text-secondary" />
        <h3 className="section-title">高频漏洞类型</h3>
        <span className="text-xs text-muted-foreground ml-auto">
          TOP 10 类型
        </span>
      </div>

      <div className="space-y-2">
        {data.map((item, index) => {
          const percentage = (item.count / maxCount) * 100;
          const colors = BAR_COLORS[item.maxSeverity];

          return (
            <Link
              key={`${item.type}-${index}`}
              to={`/issues?type=${encodeURIComponent(item.type)}`}
              className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors group"
            >
              <span className="text-xs text-muted-foreground w-5 text-right font-mono">
                {index + 1}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-foreground truncate group-hover:text-secondary transition-colors">
                    {item.typeName}
                  </span>
                  <span className={`text-sm font-semibold ${SEVERITY_COLORS[item.maxSeverity].text}`}>
                    {item.count}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full bg-gradient-to-r ${colors.from} ${colors.to} transition-all duration-300`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
});

export default VulnerabilityTypesRanking;
```

---

## Task 7: 创建解决进度组件

**Files:**
- Create: `frontend/src/pages/Dashboard/components/ResolutionProgressSection.tsx`

- [ ] **Step 1: 创建 ResolutionProgressSection 组件**

```typescript
/**
 * ResolutionProgressSection - 解决进度追踪
 * 环形进度图 + 近7天解决趋势面积图
 */

import { memo } from "react";
import { CheckCircle2, TrendingUp } from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { ResolutionProgressSectionProps } from "../types";

// SVG 环形进度图组件
function CircularProgress({
  percentage,
  size = 120,
  strokeWidth = 12,
}: {
  percentage: number;
  size?: number;
  strokeWidth?: number;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        {/* 外环（背景） */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--muted)"
          strokeWidth={strokeWidth}
          className="opacity-30"
        />
        {/* 内环（进度） */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-700 ease-out"
        />
      </svg>
      {/* 中心文字 */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold text-foreground">{percentage}%</span>
        <span className="text-xs text-muted-foreground">已解决</span>
      </div>
    </div>
  );
}

export const ResolutionProgressSection = memo(function ResolutionProgressSection({
  data,
  loading = false,
}: ResolutionProgressSectionProps) {
  if (loading) {
    return (
      <div className="cyber-card p-3">
        <div className="section-header">
          <CheckCircle2 className="w-5 h-5 text-primary" />
          <h3 className="section-title">解决进度追踪</h3>
        </div>
        <div className="flex items-center justify-center h-[200px]">
          <div className="loading-spinner" />
        </div>
      </div>
    );
  }

  const hasData = data.total > 0;

  return (
    <div className="cyber-card p-3">
      <div className="section-header">
        <CheckCircle2 className="w-5 h-5 text-primary" />
        <h3 className="section-title">解决进度追踪</h3>
        <div className="ml-auto flex items-center gap-3 text-sm">
          <span className="text-muted-foreground">
            发现 <span className="font-semibold text-foreground">{data.total}</span>
          </span>
          <span className="text-muted-foreground">
            已解决 <span className="font-semibold text-primary">{data.resolved}</span>
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* 左侧：环形进度图 */}
        <div className="flex flex-col items-center justify-center py-4">
          {hasData ? (
            <CircularProgress percentage={data.percentage} />
          ) : (
            <div className="empty-state h-[120px] flex-col">
              <CheckCircle2 className="w-10 h-10 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">暂无问题数据</p>
            </div>
          )}
        </div>

        {/* 右侧：解决趋势面积图 */}
        <div className="md:col-span-3">
          {hasData && data.trend.length > 0 ? (
            <div className="h-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.trend}>
                  <defs>
                    <linearGradient id="resolutionGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--cyber-border)" />
                  <XAxis
                    dataKey="date"
                    stroke="var(--cyber-text-muted)"
                    fontSize={11}
                    tick={{ fontFamily: 'var(--font-ui)' }}
                  />
                  <YAxis
                    stroke="var(--cyber-text-muted)"
                    fontSize={11}
                    tick={{ fontFamily: 'var(--font-ui)' }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--cyber-bg-elevated)',
                      border: '1px solid var(--cyber-border)',
                      borderRadius: '4px',
                      fontFamily: 'var(--font-ui)',
                      fontSize: '12px',
                      color: 'var(--cyber-text)',
                    }}
                    formatter={(value: number) => [`${value} 个`, '已解决']}
                  />
                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    fill="url(#resolutionGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="empty-state h-[180px]">
              <TrendingUp className="empty-state-icon" />
              <p className="empty-state-description">暂无解决趋势数据</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

export default ResolutionProgressSection;
```

---

## Task 8: 创建项目风险列表组件

**Files:**
- Create: `frontend/src/pages/Dashboard/components/ProjectRiskList.tsx`

- [ ] **Step 1: 创建 ProjectRiskList 组件**

```typescript
/**
 * ProjectRiskList - 项目风险列表
 * 展示所有项目按风险等级排序
 */

import { memo } from "react";
import { Link } from "react-router-dom";
import { FolderOpen, AlertTriangle, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { ProjectRiskListProps, SeverityLevel } from "../types";
import { SEVERITY_COLORS } from "../types";

// 风险等级标签配置
const RISK_LABELS: Record<SeverityLevel, { label: string; className: string }> = {
  critical: { label: '严重风险', className: 'severity-critical' },
  high: { label: '高危风险', className: 'severity-high' },
  medium: { label: '中危风险', className: 'severity-medium' },
  low: { label: '低风险', className: 'severity-low' },
};

// 格式化日期
function formatDate(dateStr?: string): string {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
}

export const ProjectRiskList = memo(function ProjectRiskList({
  data,
  loading = false,
}: ProjectRiskListProps) {
  if (loading) {
    return (
      <div className="cyber-card p-3">
        <div className="section-header">
          <FolderOpen className="w-5 h-5 text-primary" />
          <h3 className="section-title">项目风险列表</h3>
        </div>
        <div className="flex items-center justify-center h-[200px]">
          <div className="loading-spinner" />
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="cyber-card p-3">
        <div className="section-header">
          <FolderOpen className="w-5 h-5 text-primary" />
          <h3 className="section-title">项目风险列表</h3>
        </div>
        <div className="empty-state h-[200px]">
          <FolderOpen className="empty-state-icon" />
          <p className="empty-state-description">暂无项目风险数据</p>
        </div>
      </div>
    );
  }

  // 最多显示 12 个项目
  const displayData = data.slice(0, 12);
  const hasMore = data.length > 12;

  return (
    <div className="cyber-card p-3">
      <div className="section-header">
        <FolderOpen className="w-5 h-5 text-primary" />
        <h3 className="section-title">项目风险列表</h3>
        <span className="text-xs text-muted-foreground ml-auto">
          按风险加权分排序
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {displayData.map((project) => {
          const riskConfig = RISK_LABELS[project.maxSeverity];
          const colors = SEVERITY_COLORS[project.maxSeverity];

          return (
            <Link
              key={project.projectId}
              to={`/projects/${project.projectId}`}
              className={`block p-4 rounded-lg transition-all group border-l-4 ${colors.border}`}
              style={{
                background: 'var(--cyber-bg-elevated)',
                borderLeftWidth: '4px',
              }}
            >
              <div className="flex items-start justify-between mb-2">
                <h4 className="font-semibold text-foreground group-hover:text-primary transition-colors truncate flex-1">
                  {project.projectName}
                </h4>
                <Badge className={riskConfig.className}>
                  {riskConfig.label}
                </Badge>
              </div>

              {project.projectDescription && (
                <p className="text-sm text-muted-foreground line-clamp-1 mb-2">
                  {project.projectDescription}
                </p>
              )}

              {/* 问题统计 */}
              <div className="flex items-center gap-2 mb-2">
                {project.criticalCount > 0 && (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-rose-50 text-rose-600 border border-rose-200">
                    严重 {project.criticalCount}
                  </span>
                )}
                {project.highCount > 0 && (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-orange-50 text-orange-600 border border-orange-200">
                    高危 {project.highCount}
                  </span>
                )}
                {project.mediumCount > 0 && (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-amber-50 text-amber-600 border border-amber-200">
                    中危 {project.mediumCount}
                  </span>
                )}
                {project.lowCount > 0 && (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-primary/5 text-primary border border-primary/20">
                    低危 {project.lowCount}
                  </span>
                )}
                {project.totalIssues === 0 && (
                  <span className="text-xs text-muted-foreground">无未解决问题</span>
                )}
              </div>

              {/* 最近审计时间 */}
              <div className="flex items-center text-xs text-muted-foreground">
                <Clock className="w-3 h-3 mr-1" />
                最近审计: {formatDate(project.lastAuditAt)}
              </div>
            </Link>
          );
        })}
      </div>

      {/* 查看更多 */}
      {hasMore && (
        <div className="mt-4 text-center">
          <Link
            to="/projects"
            className="text-sm text-primary hover:text-primary/80 transition-colors font-medium"
          >
            查看全部 {data.length} 个项目 →
          </Link>
        </div>
      )}
    </div>
  );
});

export default ProjectRiskList;
```

---

## Task 9: 创建组件导出索引

**Files:**
- Create: `frontend/src/pages/Dashboard/components/index.ts`

- [ ] **Step 1: 创建组件导出索引文件**

```typescript
/**
 * Dashboard 组件导出索引
 */

export { RiskOverviewCards } from "./RiskOverviewCards";
export { RiskMatrixTable } from "./RiskMatrixTable";
export { FileHotspotsList } from "./FileHotspotsList";
export { VulnerabilityTypesRanking } from "./VulnerabilityTypesRanking";
export { ResolutionProgressSection } from "./ResolutionProgressSection";
export { ProjectRiskList } from "./ProjectRiskList";
```

---

## Task 10: 重构主 Dashboard 页面

**Files:**
- Create: `frontend/src/pages/Dashboard/index.tsx`
- Modify: `frontend/src/app/routes.tsx` (更新路由导入)

- [ ] **Step 1: 创建新的 Dashboard 主页面**

```typescript
/**
 * Dashboard 页面 - 风险洞察导向
 * 重构后的数据可视化主页
 */

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { api } from "@/shared/config/database";
import { getAgentTasks, getAgentFindings } from "@/shared/api/agentTasks";
import type { Project, AuditTask, AuditIssue } from "@/shared/types";
import type { AgentTask, AgentFinding } from "@/shared/api/agentTasks";
import type { DashboardAggregatedData } from "./types";
import { ISSUE_TYPE_NAMES } from "./types";
import { aggregateDashboardData } from "./utils/aggregation";
import {
  RiskOverviewCards,
  RiskMatrixTable,
  FileHotspotsList,
  VulnerabilityTypesRanking,
  ResolutionProgressSection,
  ProjectRiskList,
} from "./components";

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [aggregatedData, setAggregatedData] = useState<DashboardAggregatedData | null>(null);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);

      // 并发获取基础数据
      const [projects, auditTasks, agentTasks] = await Promise.all([
        api.getProjects(),
        api.getAuditTasks(),
        getAgentTasks({ limit: 100 }),
      ]);

      // 并发获取已完成任务的 issues/findings
      const completedAuditTasks = (auditTasks as AuditTask[]).filter(
        t => t.status === 'completed'
      );
      const completedAgentTasks = (agentTasks as AgentTask[]).filter(
        t => t.status === 'completed'
      );

      const auditIssuesPromises = completedAuditTasks.map(task =>
        api.getAuditIssues(task.id).catch(() => [] as AuditIssue[])
      );
      const agentFindingsPromises = completedAgentTasks.map(task =>
        getAgentFindings(task.id).catch(() => [] as AgentFinding[])
      );

      const [auditIssuesResults, agentFindingsResults] = await Promise.all([
        Promise.all(auditIssuesPromises),
        Promise.all(agentFindingsPromises),
      ]);

      // 合并所有 issues/findings
      const allAuditIssues = auditIssuesResults.flat();
      const allAgentFindings = agentFindingsResults.flat();

      // 聚合数据
      const data = aggregateDashboardData(
        projects as Project[],
        auditTasks as AuditTask[],
        agentTasks as AgentTask[],
        allAuditIssues,
        allAgentFindings,
        ISSUE_TYPE_NAMES
      );

      setAggregatedData(data);
    } catch (error) {
      console.error('Dashboard 数据加载失败:', error);
      toast.error("数据加载失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 px-6 pt-1 pb-6 bg-background min-h-screen font-mono relative">
      {/* 模块 1: 风险态势总览 */}
      <RiskOverviewCards
        data={aggregatedData?.riskOverview || { criticalIssues: 0, highRiskProjects: 0, pendingIssues: 0, todayNewIssues: 0 }}
        loading={loading}
      />

      {/* 模块 2: 风险分布矩阵 */}
      <RiskMatrixTable
        data={aggregatedData?.riskMatrix || []}
        loading={loading}
      />

      {/* 模块 3: 左右分栏 - 热点 + 类型 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <FileHotspotsList
          data={aggregatedData?.fileHotspots || []}
          loading={loading}
        />
        <VulnerabilityTypesRanking
          data={aggregatedData?.vulnerabilityTypes || []}
          loading={loading}
        />
      </div>

      {/* 模块 4: 解决进度追踪 */}
      <ResolutionProgressSection
        data={aggregatedData?.resolutionProgress || { total: 0, resolved: 0, percentage: 0, trend: [] }}
        loading={loading}
      />

      {/* 模块 5: 项目风险列表 */}
      <ProjectRiskList
        data={aggregatedData?.projectRiskList || []}
        loading={loading}
      />
    </div>
  );
}
```

- [ ] **Step 2: 更新路由导入**

修改 `frontend/src/app/routes.tsx`，将 Dashboard 导入从文件改为目录：

```typescript
// 原导入
// import Dashboard from "@/pages/Dashboard";

// 新导入
import Dashboard from "@/pages/Dashboard/index";
```

---

## Task 11: 删除旧的 Dashboard.tsx 文件

**Files:**
- Delete: `frontend/src/pages/Dashboard.tsx`

- [ ] **Step 1: 删除旧文件**

```bash
rm frontend/src/pages/Dashboard.tsx
```

- [ ] **Step 2: 提交删除**

```bash
git add -A
git commit -m "refactor: remove old Dashboard.tsx, replaced by new Dashboard directory structure"
```

---

## Task 12: 验证和测试

- [ ] **Step 1: 启动开发服务器验证**

```bash
cd frontend && npm run dev
```

Expected: 页面正常加载，无 TypeScript 错误

- [ ] **Step 2: 检查各模块渲染**

- 风险态势总览卡片正常显示
- 风险分布矩阵表格正常显示
- 文件热点和漏洞类型排行正常显示
- 解决进度环形图和面积图正常显示
- 项目风险列表正常显示

- [ ] **Step 3: 检查空状态显示**

当没有数据时，各模块显示正确的 empty-state

- [ ] **Step 4: 检查交互跳转**

- 点击矩阵单元格跳转到项目详情页
- 点击热点文件跳转到问题列表
- 点击项目卡片跳转到项目详情

---

## Task 13: 提交最终代码

- [ ] **Step 1: 提交所有新文件**

```bash
git add frontend/src/pages/Dashboard/
git add frontend/src/app/routes.tsx
git commit -m "feat: refactor Dashboard to risk-insight oriented design

- Add 5 new statistical modules: risk overview, risk matrix, file hotspots, vulnerability types, resolution progress
- Remove project overview, task list, quality score modules
- Use existing cyber-* styles and recharts library
- Frontend aggregation of AuditIssue + AgentFinding data

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```
```