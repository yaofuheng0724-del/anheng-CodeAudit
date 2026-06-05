/**
 * 统计面板组件
 * 简约行内展示，合并到顶栏下方
 */

import { memo } from "react";
import type { StatsPanelProps } from "../types";

export const StatsPanel = memo(function StatsPanel({ task }: StatsPanelProps) {
  if (!task) return null;

  const severityCounts = {
    critical: task.critical_count || 0,
    high: task.high_count || 0,
    medium: task.medium_count || 0,
    low: task.low_count || 0,
  };
  const totalFindings = task.findings_count || 0;
  const progressPercent = task.progress_percentage || 0;

  return (
    <div className="flex items-center gap-4 text-xs">
      {/* 进度条 */}
      <div className="flex items-center gap-2 min-w-[160px]">
        <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
          <div
            className="h-full rounded-full bg-indigo-400 transition-all duration-700 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <span className="text-slate-500 tabular-nums w-8 text-right">{progressPercent.toFixed(0)}%</span>
      </div>

      {/* 问题统计 */}
      {totalFindings > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-slate-400">问题</span>
          <div className="flex items-center gap-1.5">
            {severityCounts.critical > 0 && (
              <span className="text-rose-600 font-medium">{severityCounts.critical} 严重</span>
            )}
            {severityCounts.high > 0 && (
              <span className="text-orange-600 font-medium">{severityCounts.high} 高危</span>
            )}
            {severityCounts.medium > 0 && (
              <span className="text-amber-600 font-medium">{severityCounts.medium} 中危</span>
            )}
            {severityCounts.low > 0 && (
              <span className="text-sky-600 font-medium">{severityCounts.low} 低危</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
});

export default StatsPanel;
