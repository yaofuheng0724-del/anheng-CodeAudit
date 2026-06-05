/**
 * 状态徽章组件
 * 简约轻量样式，小圆点+文字
 */

import { memo } from "react";
import { Loader2 } from "lucide-react";

interface StatusBadgeProps {
  status: string;
  size?: "sm" | "default";
}

const STATUS_CONFIG: Record<string, {
  dotColor: string;
  textColor: string;
  label: string;
  animate?: boolean;
}> = {
  pending: {
    dotColor: "bg-slate-400",
    textColor: "text-slate-500",
    label: "待处理",
  },
  running: {
    dotColor: "bg-emerald-500",
    textColor: "text-emerald-600",
    label: "运行中",
    animate: true,
  },
  completed: {
    dotColor: "bg-indigo-500",
    textColor: "text-indigo-600",
    label: "已完成",
  },
  failed: {
    dotColor: "bg-rose-500",
    textColor: "text-rose-600",
    label: "失败",
  },
  cancelled: {
    dotColor: "bg-amber-500",
    textColor: "text-amber-600",
    label: "已取消",
  },
  error: {
    dotColor: "bg-red-500",
    textColor: "text-red-600",
    label: "异常",
  },
};

export const StatusBadge = memo(function StatusBadge({ status, size = "default" }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  const isSmall = size === "sm";

  return (
    <div className={`inline-flex items-center gap-1.5 ${config.textColor}`}>
      {status === 'running' ? (
        <Loader2 className={`${isSmall ? 'w-3 h-3' : 'w-3.5 h-3.5'} animate-spin`} />
      ) : (
        <span className={`${config.dotColor} ${isSmall ? 'w-1.5 h-1.5' : 'w-2 h-2'} rounded-full ${config.animate ? 'animate-pulse' : ''}`} />
      )}
      <span className={`${isSmall ? 'text-[10px]' : 'text-xs'} font-medium`}>
        {config.label}
      </span>
    </div>
  );
});

export default StatusBadge;
