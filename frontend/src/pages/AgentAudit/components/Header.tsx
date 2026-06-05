/**
 * 顶部栏组件
 * 简约白色背景，信息平铺展示
 */

import { Square, Loader2 } from "lucide-react";
import { StatusBadge } from "./StatusBadge";
import type { HeaderProps } from "../types";

export function Header({
  task,
  isRunning,
  isCancelling,
  onCancel,
}: HeaderProps) {
  return (
    <div className="bg-white border-b border-slate-200 px-6 py-3">
      <div className="flex items-center justify-between">
        {/* 左侧：任务信息 */}
        <div className="flex items-center gap-3">
          {task && (
            <>
              <span className="max-w-[360px] truncate text-slate-800 font-medium text-sm">
                {task.name || task.id.slice(0, 8)}
              </span>
              <StatusBadge status={task.status} size="sm" />
              {/* 统计指标 */}
              <div className="hidden sm:flex items-center gap-3 ml-3 text-xs text-slate-400">
                {task.analyzed_files != null && (
                  <span>已分析 <span className="text-slate-600 font-medium">{task.analyzed_files}</span>/{task.total_files} 文件</span>
                )}
                {(task.findings_count ?? 0) > 0 && (
                  <span>发现 <span className="text-rose-500 font-medium">{task.findings_count}</span> 个问题</span>
                )}
                {task.progress_percentage != null && isRunning && (
                  <span>{task.progress_percentage.toFixed(0)}%</span>
                )}
              </div>
            </>
          )}
        </div>

        {/* 右侧：操作 */}
        <div className="flex items-center gap-2">
          {/* 运行指示 */}
          {isRunning && (
            <span className="flex items-center gap-1.5 text-xs text-emerald-600">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              实时
            </span>
          )}

          {/* 终止按钮 */}
          {isRunning && (
            <button
              onClick={onCancel}
              disabled={isCancelling}
              className="
                flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium
                text-slate-600 border border-slate-200
                hover:text-rose-600 hover:border-rose-300 hover:bg-rose-50
                transition-colors duration-150
                disabled:opacity-50 disabled:cursor-not-allowed
              "
            >
              {isCancelling ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  终止中
                </>
              ) : (
                <>
                  <Square className="h-3.5 w-3.5" />
                  终止
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default Header;
