// frontend/src/components/code-analysis/FileDepsTree.tsx
//
// 文件依赖视图：按源文件分组的依赖列表。
// 支持滚动到底自动加载更多。

import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, File, FileCode } from 'lucide-react';

import { toFileDepsView } from './adapters';
import { useInfiniteSentinel } from './CodeAnalysisPanel';
import { LoadMoreBar } from './APIAssetsList';

interface Props {
  data: unknown[] | unknown;
  hasMore?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
  total?: number;
  error?: string | null;
}

export function FileDepsTree({
  data,
  hasMore = false,
  loadingMore = false,
  onLoadMore,
  total,
  error,
}: Props) {
  const view = useMemo(() => toFileDepsView(data), [data]);
  const [openFiles, setOpenFiles] = useState<Set<string>>(new Set());

  const sentinelRef = useInfiniteSentinel(
    () => onLoadMore?.(),
    hasMore && !loadingMore && !error
  );

  if (view.edges.length === 0 && !hasMore) {
    return <div className="text-muted-foreground text-xs py-4 px-2">暂无依赖关系</div>;
  }

  const toggle = (file: string) => {
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
          const externalCount = g.includes.filter((i) => i.external).length;
          return (
            <div key={g.file} className="mb-1">
              <button
                className="w-full flex items-center gap-1 text-xs px-1.5 py-1 hover:bg-muted/40 rounded font-medium"
                onClick={() => toggle(g.file)}
              >
                {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                <FileCode className="w-3 h-3 text-primary" />
                <span className="truncate flex-1 text-left">{g.file}</span>
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground"
                  title={`${g.includes.length} 个依赖，其中 ${externalCount} 个外部`}
                >
                  {g.includes.length}
                </span>
              </button>
              {open && (
                <div className="ml-4 mt-0.5 space-y-0.5">
                  {g.includes.map((inc) => (
                    <div
                      key={inc.id}
                      className="flex items-center gap-1 text-[11px] px-1 py-0.5 rounded hover:bg-muted/30"
                    >
                      <File className="w-3 h-3 shrink-0 text-muted-foreground" />
                      <span className="truncate flex-1">{inc.target}</span>
                      <span
                        className={`text-[10px] shrink-0 px-1 rounded ${
                          inc.external
                            ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400'
                            : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                        }`}
                      >
                        {inc.type}
                      </span>
                      <span className="text-muted-foreground text-[10px] shrink-0">:{inc.line}</span>
                    </div>
                  ))}
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