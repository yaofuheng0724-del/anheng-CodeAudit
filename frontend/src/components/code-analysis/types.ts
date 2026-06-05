// frontend/src/components/code-analysis/types.ts
//
// 视图模型类型 —— 与 adapters.ts 输出保持一致。
// 不再直接使用后端原始 JSON 形状，所有后端字段差异在 adapters 中吸收。

/** API 资产视图行 */
export interface ApiViewRow {
  file: string;
  line: number;
  method: string; // GET/POST/...
  path: string;   // URL 路径
  framework?: string;
  handler?: string;
  snippet?: string;
  annotations?: string[];
}

/** 调用图边（一行调用关系） */
export interface CallEdgeView {
  id: string;
  callerFile: string;
  caller: string;          // caller 函数名（可能为 <unknown>）
  callee: string;          // 被调函数名
  calleeObject?: string;   // 调用方对象（obj.method 中的 obj）
  line: number;            // caller 端行号
  callType: string;        // direct/method/static/...
}

/** 调用图按调用方文件分组 */
export interface CallGraphFileGroup {
  file: string;
  calls: CallEdgeView[];
}

export interface CallGraphView {
  fileGroups: CallGraphFileGroup[];
  edges: CallEdgeView[]; // 扁平版（供图视图）
}

/** 文件依赖 */
export interface FileDepEdgeView {
  id: string;
  source: string;
  target: string;
  type: string;            // import/include/require
  line: number;
  external: boolean;
}

export interface FileDepFileGroup {
  file: string;
  includes: FileDepEdgeView[];
}

export interface FileDepsView {
  fileGroups: FileDepFileGroup[];
  edges: FileDepEdgeView[];
}

/** 控制流节点 / 边 / 单文件结果 */
export interface ControlFlowNodeView {
  id: string;
  type: string;            // entry/exit/branch/loop/merge/...
  line: number;
  condition?: string;
  statements?: string[];
  depth?: number;
}

export interface ControlFlowEdgeView {
  id: string;
  source: string;
  target: string;
  edgeType: string;        // normal/true/false/exception/...
}

export interface ControlFlowFileView {
  file: string;
  complexity: number;
  nodes: ControlFlowNodeView[];
  edges: ControlFlowEdgeView[];
}

export interface ControlFlowView {
  files: ControlFlowFileView[];
}

/** 后端返回的代码分析完整结果（原始） */
export interface CodeAnalysisResult {
  api_endpoints?: unknown[];
  call_graph?: unknown[];
  file_dependencies?: unknown[];
  /** 后端 control_flow 是 dict，key 是相对文件路径 */
  control_flow?: Record<string, unknown> | unknown[];
  statistics?: {
    total_files?: number;
    analyzed_files?: number;
    by_language?: Record<string, number>;
  };
}
