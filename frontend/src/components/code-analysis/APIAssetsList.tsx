// frontend/src/components/code-analysis/APIAssetsList.tsx
//
// API 资产列表：method 徽标 + path + framework + file:line + 注解。
// 顶部带一个按 API 地址（path）筛选的搜索框。
// 支持滚动到底自动加载更多（哨兵 div + IntersectionObserver）。
// 注意筛选框：只对已加载到本地的数据生效，状态条仍按 total 显示。

import { useMemo, useState } from 'react';
import { Globe, Search } from 'lucide-react';

import { toApiView } from './adapters';
import { useInfiniteSentinel } from './CodeAnalysisPanel';

interface Props {
  data: unknown[] | unknown;
  /** 是否还有下一页（CodeAnalysisPanel 传入） */
  hasMore?: boolean;
  /** 是否正在加载下一页 */
  loadingMore?: boolean;
  /** 触发加载下一页 */
  onLoadMore?: () => void;
  /** 总条数（来自 summary） */
  total?: number;
  /** 上一次加载错误，error 时显示重试 */
  error?: string | null;
}

const METHOD_COLOR: Record<string, string> = {
  GET: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
  POST: 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30',
  PUT: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30',
  PATCH: 'bg-violet-500/15 text-violet-700 dark:text-violet-400 border-violet-500/30',
  DELETE: 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30',
};

export function APIAssetsList({
  data,
  hasMore = false,
  loadingMore = false,
  onLoadMore,
  total,
  error,
}: Props) {
  const rows = useMemo(() => toApiView(data), [data]);
  const [pathFilter, setPathFilter] = useState('');

  const filtered = useMemo(() => {
    const kw = pathFilter.trim().toLowerCase();
    if (!kw) return rows;
    return rows.filter((r) => (r.path || '').toLowerCase().includes(kw));
  }, [rows, pathFilter]);

  // 哨兵在筛选状态下不触发——避免用户筛剩 0 条时滚到底无限加载
  const sentinelRef = useInfiniteSentinel(
    () => onLoadMore?.(),
    hasMore && !loadingMore && !pathFilter && !error
  );

  if (!rows.length && !hasMore) {
    return <div className="text-muted-foreground text-xs py-4 px-2">暂无 API 接口</div>;
  }

  const totalLabel = total ?? rows.length;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-[320px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          <input
            value={pathFilter}
            onChange={(e) => setPathFilter(e.target.value)}
            placeholder="按 API 地址搜索（仅过滤已加载）"
            className="h-8 w-full text-xs pl-8 pr-2 rounded border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary/40"
          />
        </div>
        <span className="text-[11px] text-muted-foreground shrink-0">
          {pathFilter
            ? `${filtered.length} / ${rows.length}（已加载）`
            : `已加载 ${rows.length} / ${totalLabel}`}
        </span>
      </div>

      <div className="space-y-1 max-h-[420px] overflow-auto">
        {filtered.length === 0 ? (
          <div className="text-muted-foreground text-xs py-4 px-2">无匹配 API</div>
        ) : (
          filtered.map((r, idx) => {
            const methodCls = METHOD_COLOR[r.method] ?? 'bg-muted text-muted-foreground border-border';
            return (
              <div
                key={`${r.file}:${r.line}:${idx}`}
                className="flex items-center gap-2 text-xs p-1.5 hover:bg-muted/30 rounded"
              >
                <Globe className="w-3 h-3 text-primary shrink-0" />
                <span
                  className={`inline-block min-w-[44px] text-center text-[10px] font-bold px-1.5 py-0.5 rounded border ${methodCls}`}
                >
                  {r.method || '?'}
                </span>
                <span className="font-mono truncate flex-1" title={r.path}>
                  {r.path || '(no path)'}
                </span>
                {r.framework && (
                  <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 shrink-0">
                    {r.framework}
                  </span>
                )}
                <span className="text-muted-foreground truncate shrink-0" title={`${r.file}:${r.line}`}>
                  {r.file}:{r.line}
                </span>
              </div>
            );
          })
        )}

        {/* 哨兵 + 状态条 */}
        <LoadMoreBar
          sentinelRef={sentinelRef}
          hasMore={hasMore}
          loadingMore={loadingMore}
          loaded={rows.length}
          total={totalLabel}
          error={error}
          onRetry={onLoadMore}
          disabled={!!pathFilter}
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 通用：底部加载更多状态条                                            */
/* ------------------------------------------------------------------ */

interface LoadMoreBarProps {
  sentinelRef: React.RefObject<HTMLDivElement | null>;
  hasMore: boolean;
  loadingMore: boolean;
  loaded: number;
  total: number;
  error?: string | null;
  onRetry?: () => void;
  /** 在筛选模式下禁用哨兵 */
  disabled?: boolean;
}

export function LoadMoreBar({
  sentinelRef,
  hasMore,
  loadingMore,
  loaded,
  total,
  error,
  onRetry,
  disabled,
}: LoadMoreBarProps) {
  if (error && hasMore) {
    return (
      <div className="py-2 text-center text-[10px] text-destructive flex items-center justify-center gap-2">
        <span>{error}</span>
        {onRetry && (
          <button onClick={onRetry} className="underline hover:text-primary">
            重试
          </button>
        )}
      </div>
    );
  }
  if (hasMore) {
    return (
      <div ref={sentinelRef} className="py-2 text-center text-[10px] text-muted-foreground">
        {loadingMore
          ? '加载中…'
          : disabled
            ? `已加载 ${loaded} / ${total}（清空搜索可继续加载）`
            : `已加载 ${loaded} / ${total}，下滑加载更多`}
      </div>
    );
  }
  if (loaded > 0) {
    return (
      <div className="py-2 text-center text-[10px] text-muted-foreground">
        — 已加载全部 {loaded} 条 —
      </div>
    );
  }
  return null;
}
