/**
 * Agent 树节点组件
 * 简约行式展示，轻量分隔
 */

import { useState, memo } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { AGENT_TYPE_CONFIG, AGENT_STATUS_CONFIG } from "../constants";
import type { AgentTreeNodeItemProps } from "../types";

export const AgentTreeNodeItem = memo(function AgentTreeNodeItem({
  node,
  depth = 0,
  selectedId,
  onSelect,
  isLast = false
}: AgentTreeNodeItemProps & { isLast?: boolean }) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children && node.children.length > 0;
  const isSelected = selectedId === node.agent_id;
  const isRunning = node.status === 'running';

  const typeConfig = AGENT_TYPE_CONFIG[node.agent_type] || AGENT_TYPE_CONFIG.orchestrator;
  const statusConfig = AGENT_STATUS_CONFIG[node.status] || AGENT_STATUS_CONFIG.created;

  const indent = depth * 16;

  return (
    <div className="relative">
      {/* 行式节点 */}
      <div
        className={`
          flex items-center gap-2 py-1.5 px-2 cursor-pointer rounded transition-colors duration-100
          ${isSelected
            ? 'bg-indigo-50 text-indigo-700'
            : 'hover:bg-slate-50'
          }
        `}
        style={{ marginLeft: `${indent}px` }}
        onClick={() => onSelect(node.agent_id)}
      >
        {/* 展开/折叠 */}
        {hasChildren ? (
          <button
            onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
            className="flex-shrink-0 text-slate-300 hover:text-slate-500"
          >
            {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          </button>
        ) : (
          <span className="w-3" />
        )}

        {/* 类型图标 */}
        <span className="flex-shrink-0 opacity-70">{typeConfig.icon}</span>

        {/* Agent名称 */}
        <span className={`text-xs truncate flex-1 ${isSelected ? 'font-medium' : 'text-slate-600'}`}>
          {node.agent_name}
        </span>

        {/* 状态点 */}
        {isRunning && (
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
        )}

        {/* 状态文字 */}
        <span className={`text-[10px] flex-shrink-0 ${statusConfig.color}`}>
          {statusConfig.text}
        </span>

        {/* 迭代数 */}
        {(node.iterations ?? 0) > 0 && (
          <span className="text-[10px] text-slate-300 flex-shrink-0 tabular-nums">
            {node.iterations}轮
          </span>
        )}

        {/* 发现数 */}
        {!node.parent_agent_id && node.findings_count > 0 && (
          <span className="text-[10px] text-rose-400 flex-shrink-0 tabular-nums">
            {node.findings_count}发现
          </span>
        )}
      </div>

      {/* 子Agent */}
      {expanded && hasChildren && (
        <div style={{ marginLeft: `${indent + 8}px` }}>
          {node.children.map((child, index) => (
            <AgentTreeNodeItem
              key={child.agent_id}
              node={child}
              depth={0}
              selectedId={selectedId}
              onSelect={onSelect}
              isLast={index === node.children.length - 1}
            />
          ))}
        </div>
      )}
    </div>
  );
});

export default AgentTreeNodeItem;
