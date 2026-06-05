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
  size = 100,
  strokeWidth = 10,
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
        <span className="text-lg font-semibold text-foreground">{percentage}%</span>
        <span className="text-xs text-muted-foreground">已修复</span>
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
        <div className="ml-auto flex items-center gap-3 text-xs">
          <span className="text-muted-foreground">
            发现 <span className="font-semibold text-foreground">{data.total}</span>
          </span>
          <span className="text-muted-foreground">
            已修复 <span className="font-semibold text-primary">{data.resolved}</span>
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
            <div className="h-[150px]">
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
                    formatter={(value: number) => [`${value} 个`, '已修复']}
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