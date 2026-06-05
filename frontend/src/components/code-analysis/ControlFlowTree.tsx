// frontend/src/components/code-analysis/ControlFlowTree.tsx
//
// 控制流视图：左侧文件列表（带圈复杂度徽标） + 右侧选中文件的「文本控制流摘要」。
//
// 之前的 reactflow 图因后端边大量指向合成 ID（:body/:exit/...），
// 拓扑无法还原导致节点堆叠。改为按行号顺序输出文本：
//   - 按嵌套深度缩进
//   - 节点类型 → 关键字（IF / FOR / TRY / ...）+ 颜色徽标
//   - 条件表达式 / 语句类型 inline 显示
//   - 边按 source → target 反查相关性，避免合成 ID 干扰

import { useMemo, useState } from 'react';
import { GitBranch } from 'lucide-react';

import { toControlFlowView } from './adapters';
import type { ControlFlowFileView, ControlFlowNodeView } from './types';

interface Props {
  data: Record<string, unknown> | unknown[] | unknown;
}

export function ControlFlowTree({ data }: Props) {
  const view = useMemo(() => toControlFlowView(data), [data]);
  const [selected, setSelected] = useState<string | null>(view.files[0]?.file ?? null);

  const current = view.files.find((f) => f.file === selected) ?? view.files[0];

  if (!view.files.length) {
    return <div className="text-muted-foreground text-xs py-4 px-2">暂无控制流数据</div>;
  }

  return (
    <div className="flex gap-3 h-[460px]">
      {/* 左：文件列表 */}
      <div className="w-2/5 overflow-auto border border-border rounded p-1">
        {view.files.map((f) => {
          const active = f.file === current?.file;
          return (
            <button
              key={f.file}
              onClick={() => setSelected(f.file)}
              className={`w-full flex items-center gap-1 text-xs px-1.5 py-1.5 rounded mb-0.5 ${
                active ? 'bg-primary/15 text-foreground' : 'hover:bg-muted/40'
              }`}
            >
              <GitBranch className="w-3 h-3 text-primary shrink-0" />
              <span className="truncate flex-1 text-left">{f.file}</span>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 ${complexityBadge(f.complexity)}`}
                title="圈复杂度"
              >
                CC {f.complexity}
              </span>
              <span className="text-muted-foreground text-[10px] shrink-0">{f.nodes.length} 节点</span>
            </button>
          );
        })}
      </div>

      {/* 右：文本摘要 */}
      <div className="flex-1 border border-border rounded overflow-hidden bg-background flex flex-col">
        {current ? (
          <CfgText file={current} />
        ) : (
          <div className="text-muted-foreground text-xs p-4">选择左侧文件查看控制流</div>
        )}
      </div>
    </div>
  );
}

function complexityBadge(cc: number): string {
  if (cc >= 11) return 'bg-red-500/15 text-red-600 dark:text-red-400';
  if (cc >= 6) return 'bg-orange-500/15 text-orange-600 dark:text-orange-400';
  if (cc >= 3) return 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-400';
  return 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400';
}

/* ------------------------------------------------------------------ */
/* 文本视图                                                            */
/* ------------------------------------------------------------------ */

function CfgText({ file }: { file: ControlFlowFileView }) {
  // 按行号排序 → 顺序展开；entry / exit 永远在头尾
  const ordered = useMemo(() => orderNodes(file.nodes), [file.nodes]);

  // 反查每个节点的出边类型计数（用于显示「→ 2 分支」等线索）
  const outEdges = useMemo(() => {
    const map = new Map<string, { type: string; count: number }[]>();
    for (const e of file.edges) {
      const list = map.get(e.source) ?? [];
      const found = list.find((x) => x.type === e.edgeType);
      if (found) found.count += 1;
      else list.push({ type: e.edgeType, count: 1 });
      map.set(e.source, list);
    }
    return map;
  }, [file.edges]);

  return (
    <div className="flex flex-col h-full">
      {/* 顶部摘要 */}
      <div className="px-3 py-2 border-b border-border text-xs flex items-center gap-3 shrink-0">
        <span className="font-mono truncate flex-1" title={file.file}>
          {file.file}
        </span>
        <span className={`px-1.5 py-0.5 rounded ${complexityBadge(file.complexity)}`}>
          CC {file.complexity}
        </span>
        <span className="text-muted-foreground">
          {file.nodes.length} 节点 / {file.edges.length} 边
        </span>
      </div>

      {/* 文本流 */}
      <div className="flex-1 overflow-auto font-mono text-[11px] leading-relaxed p-3">
        {ordered.length === 0 ? (
          <div className="text-muted-foreground">该文件未识别到控制流节点。</div>
        ) : (
          ordered.map((n, idx) => {
            const outs = outEdges.get(n.id) ?? [];
            return <NodeRow key={`${n.id}:${idx}`} node={n} outs={outs} />;
          })
        )}
      </div>

      {/* 图例 */}
      <div className="px-3 py-1.5 border-t border-border text-[10px] text-muted-foreground flex flex-wrap gap-x-3 gap-y-1 shrink-0">
        <span>
          <Tag color="entry" inline /> 入口/出口
        </span>
        <span>
          <Tag color="branch" inline /> 分支
        </span>
        <span>
          <Tag color="loop" inline /> 循环
        </span>
        <span>
          <Tag color="try" inline /> 异常
        </span>
        <span>
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 mr-1 align-middle" />
          true 边
        </span>
        <span>
          <span className="inline-block w-2 h-2 rounded-full bg-red-500 mr-1 align-middle" />
          false 边
        </span>
        <span>
          <span className="inline-block w-2 h-2 rounded-full bg-orange-500 mr-1 align-middle" />
          exception 边
        </span>
      </div>
    </div>
  );
}

interface NodeRowProps {
  node: ControlFlowNodeView;
  outs: { type: string; count: number }[];
}

function NodeRow({ node, outs }: NodeRowProps) {
  const depth = Math.max(0, node.depth ?? 0);
  const indent = depth * 16; // px
  const kind = nodeKind(node.type);
  return (
    <div
      className="flex items-baseline gap-2 py-0.5 hover:bg-muted/30 rounded px-1"
      style={{ paddingLeft: indent }}
    >
      <span className="text-muted-foreground shrink-0 w-10 text-right">L{node.line}</span>
      <Tag color={kind.color}>{kind.label}</Tag>
      {node.condition && (
        <span className="text-foreground truncate" title={node.condition}>
          ({truncate(node.condition, 80)})
        </span>
      )}
      {node.statements && node.statements.length > 0 && (
        <span className="text-muted-foreground truncate">
          {'{ '}
          {node.statements.join(', ')}
          {' }'}
        </span>
      )}
      {outs.length > 0 && (
        <span className="ml-auto flex items-center gap-1 shrink-0">
          {outs.map((o) => (
            <span
              key={o.type}
              className={`text-[10px] px-1 rounded ${edgeBadge(o.type)}`}
              title={`${o.count} 条 ${o.type} 边`}
            >
              {o.type}
              {o.count > 1 ? ` ×${o.count}` : ''}
            </span>
          ))}
        </span>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 工具                                                                */
/* ------------------------------------------------------------------ */

function orderNodes(nodes: ControlFlowNodeView[]): ControlFlowNodeView[] {
  const entry = nodes.find((n) => n.type === 'entry');
  const exit = nodes.find((n) => n.type === 'exit');
  const middle = nodes
    .filter((n) => n.type !== 'entry' && n.type !== 'exit')
    .sort((a, b) => a.line - b.line || (a.depth ?? 0) - (b.depth ?? 0));
  return [...(entry ? [entry] : []), ...middle, ...(exit ? [exit] : [])];
}

function nodeKind(type: string): { label: string; color: TagColor } {
  switch (type) {
    case 'entry':
      return { label: 'ENTRY', color: 'entry' };
    case 'exit':
      return { label: 'EXIT', color: 'entry' };
    case 'branch':
      return { label: 'IF/SWITCH', color: 'branch' };
    case 'loop':
      return { label: 'LOOP', color: 'loop' };
    case 'try':
      return { label: 'TRY', color: 'try' };
    case 'catch':
      return { label: 'CATCH', color: 'try' };
    case 'finally':
      return { label: 'FINALLY', color: 'try' };
    case 'throw':
      return { label: 'THROW', color: 'try' };
    default:
      return { label: type.toUpperCase(), color: 'default' };
  }
}

type TagColor = 'entry' | 'branch' | 'loop' | 'try' | 'default';

function Tag({
  color,
  children,
  inline,
}: {
  color: TagColor;
  children?: React.ReactNode;
  inline?: boolean;
}) {
  const cls: Record<TagColor, string> = {
    entry: 'bg-muted text-muted-foreground border-border',
    branch: 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-yellow-500/30',
    loop: 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30',
    try: 'bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/30',
    default: 'bg-muted/60 text-foreground border-border',
  };
  if (inline && !children) {
    return <span className={`inline-block w-2 h-2 rounded-sm mr-1 align-middle ${cls[color]}`} />;
  }
  return (
    <span
      className={`inline-block px-1.5 py-0.5 rounded border text-[10px] font-bold tracking-wide shrink-0 ${cls[color]}`}
    >
      {children}
    </span>
  );
}

function edgeBadge(type: string): string {
  switch (type) {
    case 'true':
      return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400';
    case 'false':
      return 'bg-red-500/15 text-red-600 dark:text-red-400';
    case 'exception':
      return 'bg-orange-500/15 text-orange-700 dark:text-orange-400';
    default:
      return 'bg-muted text-muted-foreground';
  }
}

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n) + '…' : s;
}
