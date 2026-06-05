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
              <span className="text-xs text-muted-foreground w-5 text-right font-sans">
                {index + 1}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-foreground truncate group-hover:text-primary transition-colors">
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