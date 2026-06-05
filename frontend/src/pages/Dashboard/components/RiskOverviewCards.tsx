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
            className="cyber-card p-3 h-20 flex items-center justify-center"
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
            className={`cyber-card p-3 h-20 border ${config.borderColor} ${config.animate && value > 0 ? 'animate-pulse' : ''}`}
            style={{ borderWidth: '2px' }}
          >
            <div className="flex items-center justify-between h-full">
              <div className="flex flex-col">
                <p className="text-xs text-muted-foreground font-medium">{config.label}</p>
                <p className={`text-lg font-semibold ${config.textColor}`}>
                  {value}
                </p>
              </div>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${config.iconBg}`}>
                <Icon className={`w-4 h-4 ${config.textColor}`} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
});

export default RiskOverviewCards;