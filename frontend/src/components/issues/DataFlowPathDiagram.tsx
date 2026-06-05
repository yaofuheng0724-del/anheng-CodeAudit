import React, { useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Shield,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  FileCode,
} from 'lucide-react';
import type { DataFlowStep } from '@/shared/api/agentTasks';

// ── Node type visual config ──────────────────────────────────────────

const NODE_STYLES: Record<
  DataFlowStep['type'],
  {
    borderColor: string;
    bgColor: string;
    iconBgColor: string;
    icon: React.ComponentType<{ className?: string }>;
    label: string;
  }
> = {
  source: {
    borderColor: 'border-l-orange-500',
    bgColor: 'bg-orange-500/5',
    iconBgColor: 'bg-orange-500/20',
    icon: AlertCircle,
    label: 'Source',
  },
  propagation: {
    borderColor: 'border-l-gray-400',
    bgColor: 'bg-gray-500/5',
    iconBgColor: 'bg-gray-400/20',
    icon: ArrowRight,
    label: 'Propagation',
  },
  sanitization: {
    borderColor: 'border-l-green-500',
    bgColor: 'bg-green-500/5',
    iconBgColor: 'bg-green-500/20',
    icon: Shield,
    label: 'Sanitization',
  },
  sink: {
    borderColor: 'border-l-red-600',
    bgColor: 'bg-red-500/5',
    iconBgColor: 'bg-red-500/20',
    icon: AlertTriangle,
    label: 'Sink',
  },
};

const OPERATION_LABELS: Record<string, string> = {
  input: '输入',
  assignment: '赋值',
  parameter: '传参',
  return: '返回',
  call: '调用',
  sanitize: '过滤',
};

// ── FlowNode sub-component ───────────────────────────────────────────

function FlowNode({
  step,
  expanded,
  onToggle,
}: {
  step: DataFlowStep;
  expanded: boolean;
  onToggle: () => void;
}) {
  const style = NODE_STYLES[step.type];
  const Icon = style.icon;
  const truncatedCode =
    step.code.length > 80 ? step.code.slice(0, 80) + '…' : step.code;

  return (
    <div
      className={`rounded-md border border-l-4 ${style.borderColor} ${style.bgColor} overflow-hidden`}
    >
      {/* Node header — always visible */}
      <button
        type="button"
        className="w-full text-left px-3 py-2.5 flex items-start gap-2.5 hover:bg-white/5 transition-colors"
        onClick={onToggle}
      >
        {/* Type icon */}
        <span
          className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded-full ${style.iconBgColor} flex items-center justify-center`}
        >
          <Icon className="w-3 h-3" />
        </span>

        {/* Node info */}
        <div className="flex-1 min-w-0">
          {/* Type badge + label */}
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {style.label}
            </span>
            {step.label && (
              <span className="text-xs text-muted-foreground">
                — {step.label}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-xs">
            <FileCode className="w-3 h-3 text-muted-foreground flex-shrink-0" />
            <span className="font-mono text-muted-foreground truncate">
              {step.file}
              {step.line != null ? `:${step.line}` : ''}
            </span>
            {step.function && (
              <span className="text-muted-foreground/70 truncate">
                {' '}
                {step.function}()
              </span>
            )}
          </div>
          {/* Code preview */}
          <div className="mt-1 font-mono text-xs leading-relaxed">
            {expanded ? (
              <pre className="whitespace-pre-wrap break-all text-green-400/90 bg-zinc-900/50 rounded px-2 py-1.5 mt-1">
                {step.code}
              </pre>
            ) : (
              <code className="text-muted-foreground">{truncatedCode}</code>
            )}
          </div>
        </div>

        {/* Expand toggle */}
        {step.code.length > 80 && (
          <span className="flex-shrink-0 mt-0.5 text-muted-foreground">
            {expanded ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </span>
        )}
      </button>
    </div>
  );
}

// ── FlowConnection sub-component ─────────────────────────────────────

function FlowConnection({ step }: { step: DataFlowStep }) {
  const operationText = step.operation
    ? OPERATION_LABELS[step.operation] || step.operation
    : null;

  return (
    <div className="flex items-center gap-0 py-0 pl-4">
      {/* Vertical line with arrow */}
      <div className="flex flex-col items-center w-5">
        <svg
          width="16"
          height="32"
          viewBox="0 0 16 32"
          className="text-muted-foreground/50"
        >
          <line
            x1="8"
            y1="0"
            x2="8"
            y2="24"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeDasharray={step.type === 'sanitization' ? '4 2' : 'none'}
          />
          <polygon
            points="4,22 12,22 8,30"
            fill="currentColor"
          />
        </svg>
      </div>

      {/* Connection label */}
      <div className="text-[10px] leading-none pb-1">
        {step.variable && (
          <span className="font-mono font-semibold text-muted-foreground">
            {step.variable}
          </span>
        )}
        {step.variable && operationText && (
          <span className="text-muted-foreground/50 mx-1">·</span>
        )}
        {operationText && (
          <span className="text-muted-foreground/70">{operationText}</span>
        )}
      </div>
    </div>
  );
}

// ── Fallback diagram (no structured dataflow_path) ───────────────────

function FallbackDiagram({ source, sink }: { source?: string; sink?: string }) {
  return (
    <div className="space-y-0">
      {source && (
        <div className="rounded-md border border-l-4 border-l-orange-500 bg-orange-500/5 px-3 py-2">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
            Source
          </div>
          <span className="font-mono text-xs text-red-400">{source}</span>
        </div>
      )}
      {source && sink && (
        <FlowConnection
          step={{
            step: 0,
            type: 'propagation',
            file: '',
            line: 0,
            code: '',
          }}
        />
      )}
      {sink && (
        <div className="rounded-md border border-l-4 border-l-red-600 bg-red-500/5 px-3 py-2">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
            Sink
          </div>
          <span className="font-mono text-xs text-red-400">{sink}</span>
        </div>
      )}
    </div>
  );
}

// ── Main DataFlowPathDiagram ─────────────────────────────────────────

interface DataFlowPathDiagramProps {
  dataflowPath?: DataFlowStep[] | null;
  source?: string | null;
  sink?: string | null;
}

export default function DataFlowPathDiagram({
  dataflowPath,
  source,
  sink,
}: DataFlowPathDiagramProps) {
  // Auto-collapse middle nodes when path > 5 steps
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(() => {
    if (!dataflowPath || dataflowPath.length <= 5) {
      // Expand all by default for short paths
      return new Set(dataflowPath?.map((s) => s.step) ?? []);
    }
    // For long paths: expand first (source) and last (sink)
    return new Set([
      dataflowPath[0]?.step,
      dataflowPath[dataflowPath.length - 1]?.step,
    ]);
  });

  const toggleStep = (stepNum: number) => {
    setExpandedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(stepNum)) {
        next.delete(stepNum);
      } else {
        next.add(stepNum);
      }
      return next;
    });
  };

  // Fallback: no structured path data
  if (!dataflowPath || !Array.isArray(dataflowPath) || dataflowPath.length === 0) {
    if (source || sink) {
      return <FallbackDiagram source={source ?? undefined} sink={sink ?? undefined} />;
    }
    return null;
  }

  return (
    <div className="space-y-0">
      {dataflowPath.map((step, idx) => {
        const isExpanded = expandedSteps.has(step.step);
        return (
          <React.Fragment key={step.step}>
            <FlowNode
              step={step}
              expanded={isExpanded}
              onToggle={() => toggleStep(step.step)}
            />
            {idx < dataflowPath.length - 1 && (
              <FlowConnection step={step} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
