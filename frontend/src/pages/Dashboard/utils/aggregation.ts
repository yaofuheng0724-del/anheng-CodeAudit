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
} from "../types";

// ============ 辅助函数 ============

/** 判断问题是否未解决 */
function isUnresolved(status: string): boolean {
  return status !== 'fixed' && status !== 'false_positive';
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
  projectId: string,
  projectName: string
): UnifiedIssue {
  return {
    id: issue.id,
    projectId: projectId,
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
  const resolved = unifiedIssues.filter(i => i.status === 'fixed').length;
  const percentage = total > 0 ? Math.round((resolved / total) * 100) : 0;

  // 近7天解决趋势
  const trend: Array<{ date: string; count: number }> = [];
  const resolvedIssues = unifiedIssues.filter(i => i.status === 'fixed');

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

  // 创建 taskId -> projectId 映射（关键！用于正确关联 AuditIssue 到项目）
  const taskIdToProjectIdMap = new Map<string, string>();
  for (const task of auditTasks) {
    taskIdToProjectIdMap.set(task.id, task.project_id);
  }
  for (const task of agentTasks) {
    taskIdToProjectIdMap.set(task.id, task.project_id);
  }

  // 转换 AuditIssue
  for (const issue of auditIssues) {
    // 通过 task_id 找到对应的 project_id
    const projectId = taskIdToProjectIdMap.get(issue.task_id) || issue.task_id;
    const projectName = projectNameMap.get(projectId) || '未知项目';
    unifiedIssues.push(auditIssueToUnified(issue, projectId, projectName));
  }

  // 转换 AgentFinding
  for (const finding of agentFindings) {
    // 找到对应的 task 获取 projectId
    const projectId = taskIdToProjectIdMap.get(finding.task_id) || finding.task_id;
    const projectName = projectNameMap.get(projectId) || '未知项目';
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