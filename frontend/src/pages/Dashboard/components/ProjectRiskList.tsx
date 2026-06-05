/**
 * ProjectRiskList - 项目风险列表
 * 展示所有项目按风险等级排序
 */

import { memo } from "react";
import { Link } from "react-router-dom";
import { FolderOpen, Clock } from "lucide-react";
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
              className={`block p-3 rounded-lg transition-all group border-l-4 ${colors.border}`}
              style={{
                background: 'var(--cyber-bg-elevated)',
                borderLeftWidth: '4px',
              }}
            >
              <div className="flex items-start justify-between mb-1">
                <h4 className="font-medium text-sm text-foreground group-hover:text-primary transition-colors truncate flex-1">
                  {project.projectName}
                </h4>
                <Badge className={`${riskConfig.className} text-xs`}>
                  {riskConfig.label}
                </Badge>
              </div>

              {project.projectDescription && (
                <p className="text-xs text-muted-foreground line-clamp-1 mb-1">
                  {project.projectDescription}
                </p>
              )}

              {/* 问题统计 */}
              <div className="flex items-center gap-1.5 mb-1 flex-wrap">
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