# Data Flow Path Visualization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an interactive vertical pipeline data flow path diagram to the issue detail view, visualizing vulnerability taint tracking from source to sink with expandable code detail nodes.

**Architecture:** Backend populates the existing `dataflow_path` JSON column in `AgentFinding` via enhanced reporting/analysis tools, and exposes it through the API response schema. Frontend renders a CSS+SVG vertical pipeline component integrated into `IssueDetailSheet`, with collapsible nodes and fallback for missing data.

**Tech Stack:** Python/FastAPI/SQLAlchemy (backend), React/TypeScript/Tailwind CSS/SVG (frontend), no new external libraries.

---

## File Structure

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `backend/app/api/v1/endpoints/agent_tasks.py` | Extend API response schema + `_save_findings` mapping |
| Modify | `backend/app/services/agent/tools/reporting_tool.py` | Add `dataflow_path` parameter to vulnerability report tool |
| Modify | `backend/app/services/agent/tools/code_analysis_tool.py` | Enhance DataFlowAnalysisTool output with `path_steps` |
| Modify | `frontend/src/shared/api/agentTasks.ts` | Add `DataFlowStep` type + extend `AgentFinding` interface |
| Create | `frontend/src/components/issues/DataFlowPathDiagram.tsx` | New diagram component with CSS+SVG rendering |
| Modify | `frontend/src/components/issues/IssueDetailSheet.tsx` | Replace plain-text data flow section with diagram |

---

### Task 1: Extend AgentFindingResponse Schema

**Files:**
- Modify: `backend/app/api/v1/endpoints/agent_tasks.py:179-205`

The `AgentFindingResponse` Pydantic schema currently omits all data flow fields. Add them so the GET endpoint returns them.

- [ ] **Step 1: Add data flow fields to AgentFindingResponse**

At `backend/app/api/v1/endpoints/agent_tasks.py`, in the `AgentFindingResponse` class (line 179), add the following fields after `code_snippet` (after line 188):

```python
    # Data flow fields
    source: Optional[str] = None
    sink: Optional[str] = None
    dataflow_path: Optional[List[Dict[str, Any]]] = None
    code_context: Optional[str] = None
    function_name: Optional[str] = None
    class_name: Optional[str] = None
```

Also add the necessary import at the top of the file if `Dict` and `Any` aren't already imported from `typing`:

```python
from typing import Any, Dict
```

- [ ] **Step 2: Verify the schema works by checking the model has matching columns**

The `AgentFinding` SQLAlchemy model at `backend/app/models/agent_task.py:349-351` already has `source`, `sink`, and `dataflow_path` columns. The `function_name` and `class_name` columns exist at lines 341-342. `code_context` is at line 346. No migration needed.

- [ ] **Step 3: Commit**

```bash
git add backend/app/api/v1/endpoints/agent_tasks.py
git commit -m "feat(api): extend AgentFindingResponse with data flow fields"
```

---

### Task 2: Update _save_findings to Map Data Flow Fields

**Files:**
- Modify: `backend/app/api/v1/endpoints/agent_tasks.py:1382-1407`

The `_save_findings` function creates `AgentFinding` objects but does not map `source`, `sink`, or `dataflow_path` from the finding dict.

- [ ] **Step 1: Add extraction of data flow fields from finding dict**

In `_save_findings`, before the `db_finding = AgentFinding(...)` call (around line 1382), add extraction logic:

```python
    # Extract data flow information
    source = finding.get("source")
    sink = finding.get("sink")
    dataflow_path = finding.get("dataflow_path")
    code_context = finding.get("code_context")
    function_name = finding.get("function_name")
    class_name = finding.get("class_name")
```

- [ ] **Step 2: Add fields to the AgentFinding constructor call**

In the `db_finding = AgentFinding(...)` call (lines 1382-1407), add these new fields after the existing `references` field:

```python
    source=source,
    sink=sink,
    dataflow_path=dataflow_path,
    code_context=code_context,
    function_name=function_name,
    class_name=class_name,
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/api/v1/endpoints/agent_tasks.py
git commit -m "feat(api): map data flow fields in _save_findings"
```

---

### Task 3: Enhance CreateVulnerabilityReportTool with dataflow_path

**Files:**
- Modify: `backend/app/services/agent/tools/reporting_tool.py`

The `CreateVulnerabilityReportTool` already accepts `source` and `sink` parameters but has no `dataflow_path` parameter. We need to add it so the LLM agent can pass structured path steps when reporting vulnerabilities.

- [ ] **Step 1: Add dataflow_path to VulnerabilityReportInput schema**

At `backend/app/services/agent/tools/reporting_tool.py`, in the `VulnerabilityReportInput` class (lines 19-42), add after the `sink` field (after line 36):

```python
    dataflow_path: Optional[List[Dict[str, Any]]] = Field(
        default=None,
        description="数据流路径步骤列表，每个步骤包含: step(序号), type(source/propagation/sanitization/sink), file(文件路径), line(行号), function(函数名), code(关键代码行), label(操作描述), variable(跟踪变量名), operation(input/assignment/parameter/return/call/sanitize)"
    )
```

Add the necessary imports at the top if not already present:

```python
from typing import Any, Dict, List
```

- [ ] **Step 2: Include dataflow_path in the report dict**

In the `_execute` method, in the `report = {...}` dict (around lines 179-199), add after `"sink": sink,` (after line 190):

```python
    "dataflow_path": dataflow_path,
```

- [ ] **Step 3: Update the tool description to mention dataflow_path**

In the `description` field of the class (around line 89), update to include dataflow_path guidance. Find the existing description string and append:

```
\n- dataflow_path: 数据流路径步骤列表(可选)，每步包含: step(序号), type(source|propagation|sanitization|sink), file(文件路径), line(行号), function(函数名), code(关键代码行), label(人可读操作描述), variable(跟踪的变量名), operation(input|assignment|parameter|return|call|sanitize)
```

- [ ] **Step 4: Commit**

```bash
git add backend/app/services/agent/tools/reporting_tool.py
git commit -m "feat(agent): add dataflow_path parameter to vulnerability report tool"
```

---

### Task 4: Enhance DataFlowAnalysisTool to Produce path_steps

**Files:**
- Modify: `backend/app/services/agent/tools/code_analysis_tool.py:181-449`

The `DataFlowAnalysisTool` currently outputs flat analysis results. Enhance it to produce structured `path_steps` that can be used by the reporting tool to populate `dataflow_path`.

- [ ] **Step 1: Extend the LLM prompt to request path_steps**

In `_execute` method (around lines 231-261), find the prompt that asks the LLM for analysis results. Update the JSON schema section of the prompt to include `path_steps`. Find the line that describes the expected JSON output format and add:

```
"path_steps": [
  {
    "step": 1,
    "type": "source",
    "file": "文件路径",
    "line": 行号,
    "function": "函数名",
    "code": "关键代码行",
    "label": "操作描述",
    "variable": "跟踪的变量名",
    "operation": "input|assignment|parameter|return|call|sanitize"
  }
]
```

- [ ] **Step 2: Include path_steps in the ToolResult metadata**

In the return statement (around lines 314-322), find where `metadata` is built. Add `path_steps` from the LLM result:

```python
return ToolResult(
    success=True,
    data="\n".join(output_parts),
    metadata={
        "variable": variable_name,
        "file_path": file_path,
        "analysis": result,
        "path_steps": result.get("path_steps", []),
    }
)
```

- [ ] **Step 3: Enhance _quick_pattern_analysis to produce basic path_steps**

In the `_quick_pattern_analysis` method (around lines 334-414), add a `path_steps` key to the result dict. After the `result = {...}` dict is built (around line 343-349), add:

```python
    # Build basic path_steps from pattern analysis
    path_steps = []
    if has_source:
        path_steps.append({
            "step": 1,
            "type": "source",
            "file": file_path,
            "line": source_line,
            "function": None,
            "code": source_match.group(0) if source_match else "",
            "label": f"用户输入源: {source_type}",
            "variable": variable_name,
            "operation": "input",
        })
    for i, (sink_name, sink_line, sink_match) in enumerate(dangerous_sinks_found):
        path_steps.append({
            "step": len(path_steps) + 1,
            "type": "sink",
            "file": file_path,
            "line": sink_line,
            "function": None,
            "code": sink_match.group(0),
            "label": f"危险函数: {sink_name}",
            "variable": variable_name,
            "operation": "call",
        })
    result["path_steps"] = path_steps
```

Note: `dangerous_sinks_found` is a local list that needs to be populated during the pattern scan. Inspect the existing regex scanning loop and collect `(sink_name, line_number, match_object)` tuples into this list. The variable `has_source`, `source_match`, `source_line`, and `source_type` should be derived from the existing source detection logic.

- [ ] **Step 4: Commit**

```bash
git add backend/app/services/agent/tools/code_analysis_tool.py
git commit -m "feat(agent): enhance DataFlowAnalysisTool with path_steps output"
```

---

### Task 5: Add DataFlowStep TypeScript Type

**Files:**
- Modify: `frontend/src/shared/api/agentTasks.ts:65-90`

- [ ] **Step 1: Add DataFlowStep interface**

At `frontend/src/shared/api/agentTasks.ts`, before the `AgentFinding` interface (before line 65), add:

```typescript
/** 数据流路径步骤 */
export interface DataFlowStep {
  step: number;
  type: 'source' | 'propagation' | 'sanitization' | 'sink';
  file: string;
  line: number;
  end_line?: number;
  function?: string;
  class_name?: string;
  code: string;
  label?: string;
  variable?: string;
  operation?: string;
}
```

- [ ] **Step 2: Add data flow fields to AgentFinding interface**

In the `AgentFinding` interface (lines 65-90), add after the `ai_suggestion` field (after line 89):

```typescript
  // Data flow fields
  source?: string;
  sink?: string;
  dataflow_path?: DataFlowStep[];
  code_context?: string;
  function_name?: string;
  class_name?: string;
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/shared/api/agentTasks.ts
git commit -m "feat(types): add DataFlowStep type and extend AgentFinding with data flow fields"
```

---

### Task 6: Create DataFlowPathDiagram Component

**Files:**
- Create: `frontend/src/components/issues/DataFlowPathDiagram.tsx`

This is the core new component. It renders a vertical pipeline of nodes connected by SVG arrows, with collapsible code detail.

- [ ] **Step 1: Create the DataFlowPathDiagram component**

Create `frontend/src/components/issues/DataFlowPathDiagram.tsx` with the following content:

```tsx
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
          {/* Type badge + file:line */}
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
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/issues/DataFlowPathDiagram.tsx
git commit -m "feat(ui): create DataFlowPathDiagram component with CSS+SVG pipeline"
```

---

### Task 7: Integrate DataFlowPathDiagram into IssueDetailSheet

**Files:**
- Modify: `frontend/src/components/issues/IssueDetailSheet.tsx`

Replace the plain-text data flow section with the `DataFlowPathDiagram` component and remove `(agent as any)` casts for data flow fields.

- [ ] **Step 1: Add import for DataFlowPathDiagram**

At the top of `IssueDetailSheet.tsx`, add the import:

```typescript
import DataFlowPathDiagram from './DataFlowPathDiagram';
```

- [ ] **Step 2: Replace `as any` casts for data flow fields**

Find the lines around 204-206:

```tsx
const dataflowPath = (agent as any)?.dataflow_path;
const source = (agent as any)?.source;
const sink = (agent as any)?.sink;
```

Replace with typed access (since `AgentFinding` now includes these fields):

```tsx
const dataflowPath = agent?.dataflow_path;
const source = agent?.source;
const sink = agent?.sink;
```

- [ ] **Step 3: Replace the data flow SectionCard content**

Find the data flow SectionCard (around lines 322-342):

```tsx
{isAgent && (source || sink || dataflowPath) && (
  <SectionCard icon={ChevronRight} title="数据流" accentColor="text-violet-400">
    {source && (
      <InfoRow label="污点源" value={<span className="font-mono text-red-400">{source}</span>} mono />
    )}
    {dataflowPath && Array.isArray(dataflowPath) && dataflowPath.length > 0 && (
      <div className="space-y-1">
        {dataflowPath.map((step: any, idx: number) => (
          <div key={idx} className="flex items-center gap-2 text-xs">
            <ChevronRight className="w-3 h-3 text-muted-foreground flex-shrink-0" />
            <span className="font-mono text-muted-foreground">{typeof step === "string" ? step : step.description || step.function || JSON.stringify(step)}</span>
          </div>
        ))}
      </div>
    )}
    {sink && (
      <InfoRow label="危险终点" value={<span className="font-mono text-red-400">{sink}</span>} mono />
    )}
  </SectionCard>
)}
```

Replace with:

```tsx
{isAgent && (source || sink || dataflowPath) && (
  <SectionCard icon={ChevronRight} title="数据流路径" accentColor="text-violet-400">
    <DataFlowPathDiagram
      dataflowPath={dataflowPath}
      source={source}
      sink={sink}
    />
  </SectionCard>
)}
```

- [ ] **Step 4: Verify the ChevronRight import can be removed if no longer used elsewhere**

Check if `ChevronRight` is still used in other parts of the file. If it's only used in the data flow section, remove its import. Otherwise, keep it.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/issues/IssueDetailSheet.tsx
git commit -m "feat(ui): integrate DataFlowPathDiagram into IssueDetailSheet"
```

---

## Self-Review

### 1. Spec Coverage

| Spec Requirement | Task |
|-----------------|------|
| `dataflow_path` JSON structure definition | Task 3 (reporting tool schema) + Task 5 (TypeScript type) |
| Populate `dataflow_path` in `_save_findings` | Task 2 |
| Extend `AgentFindingResponse` schema | Task 1 |
| Enhance `CreateVulnerabilityReportTool` | Task 3 |
| Enhance `DataFlowAnalysisTool` output | Task 4 |
| `DataFlowPathDiagram` component (CSS+SVG) | Task 6 |
| Collapsible nodes (expand/collapse code) | Task 6 (FlowNode component) |
| Node type visual mapping (source/propagation/sanitization/sink) | Task 6 (NODE_STYLES) |
| Connection labels (variable + operation) | Task 6 (FlowConnection component) |
| Fallback for missing data | Task 6 (FallbackDiagram) |
| Auto-collapse >5 steps | Task 6 (expandedSteps logic) |
| Integration into IssueDetailSheet | Task 7 |
| Remove `as any` casts for data flow fields | Task 7 |
| TypeScript type updates | Task 5 |

All spec requirements covered.

### 2. Placeholder Scan

No TBD, TODO, or placeholder patterns found. All steps contain complete code.

### 3. Type Consistency

- `DataFlowStep` type defined in Task 5 matches the schema described in Task 3 (reporting tool) and used in Task 6 (component) and Task 7 (integration).
- Field names consistent across backend (`dataflow_path`, `source`, `sink`) and frontend (`dataflow_path`, `source`, `sink`).
- `AgentFinding` interface extended consistently with `DataFlowStep[]` type for `dataflow_path`.
