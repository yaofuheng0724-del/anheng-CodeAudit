/**
 * Agent 详情面板
 * 简约行式展示
 */

import { memo } from "react";
import { X } from "lucide-react";
import { AGENT_TYPE_CONFIG, AGENT_STATUS_CONFIG } from "../constants";
import { findAgentInTree } from "../utils";
import type { AgentDetailPanelProps } from "../types";

export const AgentDetailPanel = memo(function AgentDetailPanel({ agentId, treeNodes, onClose }: AgentDetailPanelProps) {
  const agent = findAgentInTree(treeNodes, agentId);
  if (!agent) return null;

  const typeConfig = AGENT_TYPE_CONFIG[agent.agent_type] || AGENT_TYPE_CONFIG.orchestrator;
  const statusConfig = AGENT_STATUS_CONFIG[agent.status] || AGENT_STATUS_CONFIG.created;

  return (
    <div className="p-3 space-y-2">
      {/* 头部 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="opacity-70">{typeConfig.icon}</span>
          <span className="text-xs font-medium text-slate-700">{agent.agent_name}</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-medium`}>
            {typeConfig.label}
          </span>
          <span className={`text-[10px] font-medium ${statusConfig.color}`}>
            {statusConfig.text}
          </span>
        </div>
        <button
          onClick={onClose}
          className="text-slate-300 hover:text-slate-500 transition-colors p-0.5"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* 指标 */}
      <div className="flex items-center gap-3 text-[10px] text-slate-400">
        {!agent.parent_agent_id && (
          <span>发现 <span className="text-rose-500 font-medium">{agent.findings_count}</span></span>
        )}
        {(agent.iterations ?? 0) > 0 && (
          <span>迭代 <span className="text-slate-600 font-medium">{agent.iterations}</span></span>
        )}
        {agent.parent_agent_id && agent.duration_ms && (
          <span>耗时 <span className="text-slate-600 font-medium">{(agent.duration_ms / 1000).toFixed(1)}s</span></span>
        )}
        {agent.children && agent.children.length > 0 && (
          <span>子Agent <span className="text-slate-600 font-medium">{agent.children.length}</span></span>
        )}
      </div>

      {/* 任务描述 */}
      {agent.task_description && (
        <p className="text-[10px] text-slate-400 leading-relaxed">
          {agent.task_description.length > 150 ? agent.task_description.slice(0, 150) + "..." : agent.task_description}
        </p>
      )}
    </div>
  );
});

export default AgentDetailPanel;
