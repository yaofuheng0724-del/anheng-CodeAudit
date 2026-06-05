// frontend/src/components/code-analysis/CallGraphTree.tsx
//
// 调用图视图：按文件分组的调用列表。
// 视图模型来自 adapters.toCallGraphView()。
// 支持滚动到底自动加载更多。

import { useMemo, useState } from 'react';
import { ArrowRight, ChevronDown, ChevronRight, File } from 'lucide-react';

import { toCallGraphView } from './adapters';
import { useInfiniteSentinel } from './CodeAnalysisPanel';
import { LoadMoreBar } from './APIAssetsList';

interface Props {
  /** 后端返回的原始 call_graph（数组），CodeAnalysisPanel 已做分页累计 */
  data: unknown[] | unknown;
  hasMore?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
  total?: number;
  error?: string | null;
}

export function CallGraphTree({
  data,
  hasMore = false,
  loadingMore = false,
  onLoadMore,
  total,
  error,
}: Props) {
  const view = useMemo(() => toCallGraphView(data), [data]);
  const [openFiles, setOpenFiles] = useState<Set<string>>(new Set());
  const [highlightCaller, setHighlightCaller] = useState<string | null>(null);

  const sentinelRef = useInfiniteSentinel(
    () => onLoadMore?.(),
    hasMore && !loadingMore && !error
  );

  if (view.edges.length === 0 && !hasMore) {
    return <div className="text-muted-foreground text-xs py-4 px-2">暂无调用关系</div>;
  }

  const toggleFile = (file: string) => {
    setOpenFiles((prev) => {
      const next = new Set(prev);
      next.has(file) ? next.delete(file) : next.add(file);
      return next;
    });
  };

  const totalLabel = total ?? view.edges.length;

  return (
    <div className="h-[420px] flex flex-col">
      <div className="flex-1 overflow-auto border border-border rounded p-1">
        {view.fileGroups.map((g) => {
          const open = openFiles.has(g.file);
          return (
            <div key={g.file} className="mb-1">
              <button
                className="w-full flex items-center gap-1 text-xs px-1.5 py-1 hover:bg-muted/40 rounded font-medium"
                onClick={() => toggleFile(g.file)}
              >
                {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                <File className="w-3 h-3 text-primary" />
                <span className="truncate flex-1 text-left">{g.file}</span>
                <span className="text-muted-foreground text-[10px] bg-muted px-1.5 py-0.5 rounded">
                  {g.calls.length}
                </span>
              </button>
              {open && (
                <div className="ml-4 mt-0.5 space-y-0.5">
                  {g.calls.map((c) => {
                    const calleeLabel = c.calleeObject ? `${c.calleeObject}.${c.callee}` : c.callee;
                    const isHl = highlightCaller === c.caller;
                    return (
                      <button
                        key={c.id}
                        onMouseEnter={() => setHighlightCaller(c.caller)}
                        onMouseLeave={() => setHighlightCaller(null)}
                        className={`w-full flex items-center gap-1 text-[11px] px-1 py-0.5 rounded text-left ${
                          isHl ? 'bg-primary/15' : 'hover:bg-muted/30'
                        }`}
                      >
                        <span className="font-medium truncate">{c.caller}</span>
                        <ArrowRight className="w-3 h-3 text-primary shrink-0" />
                        <span className="font-medium truncate flex-1">{calleeLabel}</span>
                        <span className="text-muted-foreground text-[10px]">:{c.line}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        <LoadMoreBar
          sentinelRef={sentinelRef}
          hasMore={hasMore}
          loadingMore={loadingMore}
          loaded={view.edges.length}
          total={totalLabel}
          error={error}
          onRetry={onLoadMore}
        />
      </div>
    </div>
  );
}
