// frontend/src/components/code-analysis/CodeAnalysisPanel.tsx

import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, FileCode, GitBranch, Globe, Network } from 'lucide-react';

import { apiClient } from '@/shared/api/serverClient';

import { APIAssetsList } from './APIAssetsList';
import { CallGraphTree } from './CallGraphTree';
import { ControlFlowTree } from './ControlFlowTree';
import { FileDepsTree } from './FileDepsTree';

interface Props {
  taskId: string;
  taskType: 'quick' | 'agent';
  /** 隐藏 API 接口资产那一栏（在外部 Tab 里单独展示时使用） */
  hideApi?: boolean;
}

/** 后端 /summary 端点返回 */
interface SectionSummary {
  api_endpoints: number;
  call_graph: number;
  file_dependencies: number;
  control_flow_files: number;
}

/** 分页型 section（api/call/deps）的状态 */
interface PagedSectionState {
  items: unknown[];
  offset: number;       // 下一次拉取的 offset
  total: number;        // 来自 summary（≥0；-1 表示过大）
  loading: boolean;     // 是否正在请求一页
  error: string | null;
  done: boolean;        // 已无更多
}

/** 非分页 section（cfg）的状态——一次性加载 */
interface FullSectionState {
  data: unknown;
  loading: boolean;
  error: string | null;
}

type SectionState = PagedSectionState | FullSectionState;

function isPaged(s: SectionState | undefined): s is PagedSectionState {
  return !!s && 'items' in s;
}

interface SectionDef {
  key: 'api' | 'call' | 'deps' | 'cfg';
  title: string;
  icon: typeof Globe;
  countField: keyof SectionSummary;
  sectionPath: 'api_endpoints' | 'call_graph' | 'file_dependencies' | 'control_flow';
  /** true=数组型用分页接口；false=一次性 /{section} */
  pageable: boolean;
}

const SECTIONS: readonly SectionDef[] = [
  { key: 'api', title: 'API 接口资产', icon: Globe, countField: 'api_endpoints', sectionPath: 'api_endpoints', pageable: true },
  { key: 'call', title: '函数调用图', icon: Network, countField: 'call_graph', sectionPath: 'call_graph', pageable: true },
  { key: 'deps', title: '文件包含关系', icon: FileCode, countField: 'file_dependencies', sectionPath: 'file_dependencies', pageable: true },
  { key: 'cfg', title: '函数控制流图', icon: GitBranch, countField: 'control_flow_files', sectionPath: 'control_flow', pageable: false },
];

// 单 section 请求超时上限：大项目仍可能需要几十秒解析整列 json
const SECTION_REQUEST_TIMEOUT_MS = 5 * 60 * 1000;
const PAGE_SIZE = 50;

export function CodeAnalysisPanel({ taskId, taskType, hideApi = false }: Props) {
  const [summary, setSummary] = useState<SectionSummary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  /** summary 已经 loading 超过 3 秒，提示"项目较大"文案 */
  const [summarySlow, setSummarySlow] = useState(false);
  const [sections, setSections] = useState<Record<string, SectionState>>({});
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const basePath = taskType === 'quick' ? '/tasks' : '/agent-tasks';

  // 首屏只加载 summary，并在 3s 后追加"项目较大"提示
  useEffect(() => {
    let cancelled = false;
    setLoadingSummary(true);
    setSummaryError(null);
    setSummarySlow(false);
    const slowTimer = setTimeout(() => {
      if (!cancelled) setSummarySlow(true);
    }, 3000);

    apiClient
      .get(`${basePath}/${taskId}/code-analysis/summary`, { timeout: SECTION_REQUEST_TIMEOUT_MS })
      .then((res) => {
        if (cancelled) return;
        setSummary(res.data as SectionSummary);
        setLoadingSummary(false);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('Failed to load code analysis summary:', err);
        setSummaryError('加载失败');
        setLoadingSummary(false);
      });
    return () => {
      cancelled = true;
      clearTimeout(slowTimer);
    };
  }, [basePath, taskId]);

  /** 加载某个分页 section 的下一页；幂等：loading 中或 done 时直接跳过 */
  const loadNextPage = useCallback(
    (sectionKey: string) => {
      const sec = SECTIONS.find((s) => s.key === sectionKey);
      if (!sec || !sec.pageable) return;

      setSections((prev) => {
        const cur = prev[sectionKey];
        if (cur && isPaged(cur) && (cur.loading || cur.done)) return prev;

        const next: PagedSectionState =
          cur && isPaged(cur)
            ? { ...cur, loading: true, error: null }
            : { items: [], offset: 0, total: summary?.[sec.countField] ?? 0, loading: true, error: null, done: false };

        const offset = next.offset;
        apiClient
          .get(`${basePath}/${taskId}/code-analysis/${sec.sectionPath}/page`, {
            params: { offset, limit: PAGE_SIZE },
            timeout: SECTION_REQUEST_TIMEOUT_MS,
          })
          .then((res) => {
            const batch = Array.isArray(res.data) ? res.data : [];
            setSections((p) => {
              const c = p[sectionKey];
              if (!c || !isPaged(c)) return p;
              const items = c.items.concat(batch);
              const newOffset = c.offset + batch.length;
              const reachedTotal = c.total > 0 && items.length >= c.total;
              const done = batch.length < PAGE_SIZE || reachedTotal;
              return { ...p, [sectionKey]: { ...c, items, offset: newOffset, loading: false, done } };
            });
          })
          .catch((err) => {
            console.error(`Failed to load section ${sec.sectionPath} page:`, err);
            setSections((p) => {
              const c = p[sectionKey];
              if (!c || !isPaged(c)) return p;
              return { ...p, [sectionKey]: { ...c, loading: false, error: '加载失败' } };
            });
          });
        return { ...prev, [sectionKey]: next };
      });
    },
    [basePath, taskId, summary]
  );

  /** 加载非分页 section（cfg）的全量数据 */
  const loadFullSection = useCallback(
    (sectionKey: string) => {
      const sec = SECTIONS.find((s) => s.key === sectionKey);
      if (!sec || sec.pageable) return;
      setSections((prev) => ({ ...prev, [sectionKey]: { data: null, loading: true, error: null } as FullSectionState }));
      apiClient
        .get(`${basePath}/${taskId}/code-analysis/${sec.sectionPath}`, { timeout: SECTION_REQUEST_TIMEOUT_MS })
        .then((res) => {
          setSections((prev) => ({
            ...prev,
            [sectionKey]: { data: res.data, loading: false, error: null } as FullSectionState,
          }));
        })
        .catch((err) => {
          console.error(`Failed to load section ${sec.sectionPath}:`, err);
          setSections((prev) => ({
            ...prev,
            [sectionKey]: { data: null, loading: false, error: '加载失败' } as FullSectionState,
          }));
        });
    },
    [basePath, taskId]
  );

  const toggleSection = useCallback(
    (sectionKey: string) => {
      const sec = SECTIONS.find((s) => s.key === sectionKey);
      if (!sec) return;
      setExpanded((prev) => {
        const next = new Set(prev);
        if (next.has(sectionKey)) {
          next.delete(sectionKey);
        } else {
          next.add(sectionKey);
          if (!sections[sectionKey]) {
            if (sec.pageable) loadNextPage(sectionKey);
            else loadFullSection(sectionKey);
          }
        }
        return next;
      });
    },
    [sections, loadNextPage, loadFullSection]
  );

  // ─── 渲染 ──────────────────────────────────────────────
  if (loadingSummary) return <SummarySkeleton slow={summarySlow} />;
  if (summaryError) return <div className="p-4 text-destructive">{summaryError}</div>;
  if (!summary) return <div className="p-4 text-muted-foreground">暂无数据</div>;

  const visibleSections = SECTIONS.filter((s) => !(hideApi && s.key === 'api'));

  return (
    <div className="cyber-card p-4 h-full overflow-auto">
      <h3 className="text-sm font-bold uppercase mb-3 text-foreground">代码结构分析</h3>

      <div className="space-y-2">
        {visibleSections.map((section) => {
          const open = expanded.has(section.key);
          const state = sections[section.key];
          const count = summary[section.countField];
          const oversized = count === -1;

          return (
            <div key={section.key} className="border border-border rounded">
              <button
                className="w-full flex items-center justify-between p-2 text-sm hover:bg-muted/50"
                onClick={() => toggleSection(section.key)}
              >
                <div className="flex items-center gap-2">
                  {open ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                  <section.icon className="w-4 h-4 text-primary" />
                  <span className="font-medium">{section.title}</span>
                </div>
                <span
                  className={`text-xs px-2 py-0.5 rounded ${
                    oversized
                      ? 'bg-orange-500/20 text-orange-700 dark:text-orange-400'
                      : 'text-muted-foreground bg-muted'
                  }`}
                  title={oversized ? '数据过大，DB 解析失败' : undefined}
                >
                  {oversized ? '过大' : count}
                </span>
              </button>

              {open && (
                <div className="p-2 border-t border-border">
                  <SectionBody
                    section={section}
                    state={state}
                    onLoadMore={() => loadNextPage(section.key)}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 子组件                                                              */
/* ------------------------------------------------------------------ */

interface SectionBodyProps {
  section: SectionDef;
  state: SectionState | undefined;
  onLoadMore: () => void;
}

function SectionBody({ section, state, onLoadMore }: SectionBodyProps) {
  // 首屏（还没拉到任何东西）骨架
  const isInitialLoading =
    !state ||
    (isPaged(state) && state.loading && state.items.length === 0) ||
    (!isPaged(state) && state.loading && state.data == null);

  if (isInitialLoading) return <RowSkeleton lines={3} />;

  if (state?.error && (!isPaged(state) || state.items.length === 0)) {
    return <div className="text-destructive text-xs py-2">{state.error}</div>;
  }

  if (section.pageable && isPaged(state)) {
    const commonProps = {
      hasMore: !state.done,
      loadingMore: state.loading,
      total: state.total,
      error: state.error,
      onLoadMore,
    };
    switch (section.key) {
      case 'api':
        return <APIAssetsList data={state.items} {...commonProps} />;
      case 'call':
        return <CallGraphTree data={state.items} {...commonProps} />;
      case 'deps':
        return <FileDepsTree data={state.items} {...commonProps} />;
    }
  }

  // 非分页（cfg）
  if (!isPaged(state) && state?.data != null) {
    if (section.key === 'cfg') return <ControlFlowTree data={state.data ?? {}} />;
  }

  return <div className="text-muted-foreground text-xs py-2">暂无数据</div>;
}

/* ------------------------------------------------------------------ */
/* 占位骨架                                                            */
/* ------------------------------------------------------------------ */

function SummarySkeleton({ slow }: { slow: boolean }) {
  return (
    <div className="cyber-card p-4 h-full overflow-auto">
      <h3 className="text-sm font-bold uppercase mb-3 text-foreground">代码结构分析</h3>
      <div className="space-y-2 mb-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="border border-border rounded p-2 flex items-center justify-between animate-pulse">
            <div className="flex items-center gap-2 flex-1">
              <div className="w-4 h-4 rounded bg-muted" />
              <div className="w-4 h-4 rounded bg-muted" />
              <div className="h-3 bg-muted rounded w-32" />
            </div>
            <div className="h-4 w-10 bg-muted rounded" />
          </div>
        ))}
      </div>
      <div className="text-xs text-muted-foreground space-y-0.5">
        <div>正在统计代码结构…</div>
        {slow && <div className="text-[11px] opacity-70">项目较大，仍在解析（可能需要 10–30 秒）…</div>}
      </div>
    </div>
  );
}

function RowSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="space-y-1.5 py-1 animate-pulse">
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="h-3 bg-muted rounded" style={{ width: `${60 + ((i * 13) % 35)}%` }} />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 公共：滚动哨兵 hook                                                 */
/* ------------------------------------------------------------------ */

/**
 * 把返回的 ref 挂在列表底部一个空 div 上；该 div 进入视口时调用 onHit。
 * enabled=false 时不挂载 observer。
 */
export function useInfiniteSentinel<T extends HTMLElement = HTMLDivElement>(
  onHit: () => void,
  enabled: boolean
) {
  const ref = useRef<T | null>(null);
  // 用 ref 避免 onHit 引用变化反复重建 observer
  const handlerRef = useRef(onHit);
  useEffect(() => {
    handlerRef.current = onHit;
  }, [onHit]);
  useEffect(() => {
    if (!enabled) return;
    const node = ref.current;
    if (!node) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) handlerRef.current();
      },
      { rootMargin: '120px' }
    );
    io.observe(node);
    return () => io.disconnect();
  }, [enabled]);
  return ref;
}
