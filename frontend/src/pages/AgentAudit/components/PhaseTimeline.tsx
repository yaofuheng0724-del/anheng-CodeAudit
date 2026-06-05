/**
 * 阶段时间线组件
 * 水平步骤条，简约白色背景
 */

import { memo } from "react";
import { Check } from "lucide-react";
import { AUDIT_PHASE_CONFIG, AUDIT_PHASES } from "../types";
import type { AuditPhase } from "../types";

interface PhaseTimelineProps {
  currentPhase: AuditPhase;
  completedPhases: AuditPhase[];
  isRunning: boolean;
  isComplete: boolean;
  phaseLogMap: Record<string, unknown[]>;
}

export const PhaseTimeline = memo(function PhaseTimeline({
  currentPhase,
  completedPhases,
  isRunning,
  isComplete,
  phaseLogMap,
}: PhaseTimelineProps) {
  return (
    <div className="flex items-center gap-0">
      {AUDIT_PHASES.map((phase, index) => {
        const isCompleted = completedPhases.includes(phase) || (isComplete && phase === currentPhase);
        const isActive = phase === currentPhase && !isCompleted;
        const config = AUDIT_PHASE_CONFIG[phase];
        const logCount = (phaseLogMap[phase] || []).length;

        return (
          <div key={phase} className="flex items-center">
            {/* 步骤节点 */}
            <div className="flex items-center gap-2">
              <div className={`
                flex items-center justify-center w-6 h-6 rounded-full flex-shrink-0
                transition-all duration-200
                ${isCompleted
                  ? 'bg-emerald-500 text-white'
                  : isActive
                    ? 'bg-indigo-500 text-white'
                    : 'bg-slate-200 text-slate-400'
                }
              `}>
                {isCompleted ? (
                  <Check className="w-3.5 h-3.5" />
                ) : (
                  <span className="text-[10px] font-medium">{index + 1}</span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <span className={`text-xs font-medium whitespace-nowrap ${
                  isCompleted ? 'text-emerald-600' :
                  isActive ? 'text-indigo-600' :
                  'text-slate-400'
                }`}>
                  {config.label}
                </span>
                {logCount > 0 && (
                  <span className={`text-[10px] tabular-nums ${
                    isActive ? 'text-indigo-400' : 'text-slate-300'
                  }`}>
                    {logCount}
                  </span>
                )}
              </div>
            </div>

            {/* 连接线 */}
            {index < AUDIT_PHASES.length - 1 && (
              <div className={`w-8 h-px mx-1 ${
                isCompleted ? 'bg-emerald-300' : 'bg-slate-200'
              }`} />
            )}
          </div>
        );
      })}
    </div>
  );
});

export default PhaseTimeline;
