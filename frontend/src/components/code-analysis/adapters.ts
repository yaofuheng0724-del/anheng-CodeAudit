// frontend/src/components/code-analysis/adapters.ts
//
// 把后端原始 JSON 字段转换为视图模型。
// 后端 dataclass 字段名（service.py 中 asdict 后）：
//   - api_endpoints: { file_path, line_number, method, path, framework, handler, parameters, annotations, source_snippet }
//   - call_graph:    { caller_file, caller_function, caller_line, callee_name, callee_object, call_type, arguments }
//   - file_dependencies: { source_file, target_file, dependency_type, line_number, is_external }
//   - control_flow:  { [relPath]: { nodes: [{node_id, node_type, line_number, condition, statements, depth}], edges: [{source_id, target_id, edge_type}], complexity } }
//
// 前端组件读取的字段在 types.ts 定义。若后端字段以后再变，只改本文件即可。

import type {
  ApiViewRow,
  CallEdgeView,
  CallGraphView,
  ControlFlowView,
  FileDepEdgeView,
  FileDepsView,
} from './types';

type Dict = Record<string, unknown>;

function asStr(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback;
}
function asNum(v: unknown, fallback = 0): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}
function asBool(v: unknown, fallback = false): boolean {
  return typeof v === 'boolean' ? v : fallback;
}
function asArr(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

/** 调用图：后端字段 → 视图 */
export function toCallGraphView(raw: unknown): CallGraphView {
  const rows = asArr(raw) as Dict[];
  const edges: CallEdgeView[] = rows.map((r, i) => ({
    id: `call:${i}`,
    callerFile: asStr(r.caller_file),
    caller: asStr(r.caller_function, '<unknown>'),
    callee: asStr(r.callee_name),
    calleeObject: asStr(r.callee_object) || undefined,
    line: asNum(r.caller_line),
    callType: asStr(r.call_type, 'direct'),
  }));

  // 按 caller_file 分组
  const groupMap = new Map<string, CallEdgeView[]>();
  for (const e of edges) {
    const key = e.callerFile || '(unknown)';
    let bucket = groupMap.get(key);
    if (!bucket) {
      bucket = [];
      groupMap.set(key, bucket);
    }
    bucket.push(e);
  }
  const fileGroups = Array.from(groupMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([file, calls]) => ({ file, calls }));

  return { fileGroups, edges };
}

/** 文件依赖：扁平 import 列表 → 视图（按源文件分组） */
export function toFileDepsView(raw: unknown): FileDepsView {
  const rows = asArr(raw) as Dict[];
  const edges: FileDepEdgeView[] = rows.map((r, i) => ({
    id: `dep:${i}`,
    source: asStr(r.source_file),
    target: asStr(r.target_file),
    type: asStr(r.dependency_type, 'import'),
    line: asNum(r.line_number),
    external: asBool(r.is_external),
  }));

  const groupMap = new Map<string, FileDepEdgeView[]>();
  for (const e of edges) {
    const key = e.source || '(unknown)';
    let bucket = groupMap.get(key);
    if (!bucket) {
      bucket = [];
      groupMap.set(key, bucket);
    }
    bucket.push(e);
  }
  const fileGroups = Array.from(groupMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([file, includes]) => ({ file, includes }));

  return { fileGroups, edges };
}

/** 控制流：dict 或 array → 视图 */
export function toControlFlowView(raw: unknown): ControlFlowView {
  const files: ControlFlowView['files'] = [];

  if (Array.isArray(raw)) {
    // 兼容数组形态
    for (const item of raw as Dict[]) {
      const file = asStr(item.file) || asStr(item.function);
      if (!file) continue;
      files.push(buildFile(file, item));
    }
  } else if (raw && typeof raw === 'object') {
    for (const [file, val] of Object.entries(raw as Dict)) {
      if (!val || typeof val !== 'object') continue;
      files.push(buildFile(file, val as Dict));
    }
  }

  // 按复杂度从高到低排序，便于聚焦
  files.sort((a, b) => b.complexity - a.complexity || a.file.localeCompare(b.file));
  return { files };
}

function buildFile(file: string, cf: Dict): ControlFlowView['files'][number] {
  const rawNodes = asArr(cf.nodes) as Dict[];
  const rawEdges = asArr(cf.edges) as Dict[];
  return {
    file,
    complexity: asNum(cf.complexity, 1),
    nodes: rawNodes.map((n) => ({
      id: asStr(n.node_id) || `n_${asNum(n.line_number)}_${asStr(n.node_type)}`,
      type: asStr(n.node_type, 'statement'),
      line: asNum(n.line_number),
      condition: asStr(n.condition) || undefined,
      statements: Array.isArray(n.statements) ? (n.statements as string[]) : undefined,
      depth: asNum(n.depth),
    })),
    edges: rawEdges.map((e, i) => ({
      id: `cfe:${i}`,
      source: asStr(e.source_id),
      target: asStr(e.target_id),
      edgeType: asStr(e.edge_type, 'normal'),
    })),
  };
}

/** API 资产：后端字段 → 视图行 */
export function toApiView(raw: unknown): ApiViewRow[] {
  const rows = asArr(raw) as Dict[];
  return rows.map((r) => ({
    file: asStr(r.file_path) || asStr(r.file),
    line: asNum(r.line_number) || asNum(r.line),
    method: asStr(r.method, '').toUpperCase(),
    path: asStr(r.path),
    framework: asStr(r.framework) || undefined,
    handler: asStr(r.handler) || undefined,
    snippet: asStr(r.source_snippet) || asStr(r.snippet) || undefined,
    annotations: Array.isArray(r.annotations) ? (r.annotations as string[]) : undefined,
  }));
}
