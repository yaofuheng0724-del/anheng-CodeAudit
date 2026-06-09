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

      // 并发获取所有任务的 issues/findings（包括失败的任务）
      const allAuditTasks = auditTasks as AuditTask[];
      const allAgentTasks = agentTasks as AgentTask[];

      const auditIssuesPromises = allAuditTasks.map(task =>
        api.getAuditIssues(task.id)
          .then(result => Array.isArray(result) ? result : result.items)
          .catch(() => [] as AuditIssue[])
      );
      const agentFindingsPromises = allAgentTasks.map(task =>
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
    <div className="space-y-4 px-6 pt-1 pb-6 bg-background min-h-screen font-sans relative">
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