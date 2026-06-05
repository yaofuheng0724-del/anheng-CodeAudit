# Data Flow Path Tracking Visualization Design

## Overview

Add a clear, interactive data flow path diagram to the scan detail and issue detail views. The diagram visualizes vulnerability triggering, data flow propagation, and taint tracking from source to sink as a vertical pipeline with expandable code detail nodes.

## Problem Statement

- `AgentFinding` model has `source`, `sink`, `dataflow_path` columns but `dataflow_path` is never populated
- API response (`AgentFindingResponse`) omits all data flow fields
- `IssueDetailSheet` renders source/sink/dataflow_path as plain text via `(agent as any)` casts
- No visual representation of the taint propagation path exists

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Rendering approach | Pure CSS + SVG | Zero dependencies, consistent with project style (all existing visualizations are pure CSS) |
| Layout | Vertical pipeline (top→bottom) | Intuitive reading flow (source→sink), fits narrow slide-out panel |
| Information density | Collapsible nodes (A+C hybrid) | Default shows thumbnail (file:line + key code line), click to expand full code block |
| Integration point | Replace plain-text data flow section in `IssueDetailSheet` | No new panel needed, improves existing section |

## Data Structure

### `dataflow_path` JSON Schema

```json
[
  {
    "step": 1,
    "type": "source | propagation | sanitization | sink",
    "file": "app/handlers.py",
    "line": 23,
    "end_line": 23,
    "function": "handle_request",
    "class_name": null,
    "code": "user_input = request.args.get('id')",
    "label": "用户输入参数",
    "variable": "user_input",
    "operation": "input | assignment | parameter | return | call | sanitize"
  }
]
```

**Node types and visual mapping:**

| Type | Border Color | Icon | Meaning |
|------|-------------|------|---------|
| `source` | Orange/Red | 🔴 Entry | Taint origin (user input, file read, env var) |
| `propagation` | Gray | ➡️ Arrow | Data passes through assignment, parameter, return |
| `sanitization` | Green | 🛡️ Shield | Data is sanitized/validated (optional step) |
| `sink` | Dark Red | ⚠️ Danger | Dangerous operation (eval, exec, SQL query) |

**Operation types:**

| Operation | Description |
|-----------|-------------|
| `input` | External data enters (HTTP param, file read, env var) |
| `assignment` | Variable assignment or string concatenation |
| `parameter` | Passed as function argument |
| `return` | Returned from function |
| `call` | Used in a function/method call |
| `sanitize` | Validated or escaped |

## Backend Changes

### 1. Populate `dataflow_path` in `_save_findings()`

File: `backend/app/api/v1/endpoints/agent_tasks.py`

Add mapping for `dataflow_path` from finding dict:
```python
dataflow_path=finding.get("dataflow_path"),
source=finding.get("source"),
sink=finding.get("sink"),
code_context=finding.get("code_context"),
function_name=finding.get("function_name"),
class_name=finding.get("class_name"),
```

### 2. Extend `AgentFindingResponse` schema

File: `backend/app/api/v1/endpoints/agent_tasks.py`

Add fields to the Pydantic response model:
```python
source: Optional[str] = None
sink: Optional[str] = None
dataflow_path: Optional[List[Dict[str, Any]]] = None
code_context: Optional[str] = None
function_name: Optional[str] = None
class_name: Optional[str] = None
```

### 3. Enhance `CreateVulnerabilityReportTool`

File: `backend/app/services/agent/tools/reporting_tool.py`

Add `dataflow_path` parameter (JSON array of step objects). The agent LLM will be instructed to generate structured path steps when reporting vulnerabilities.

### 4. Enhance `DataFlowAnalysisTool` output

File: `backend/app/services/agent/tools/code_analysis_tool.py`

Extend the tool's output to include a `path_steps` array with the structured data flow path, not just flat source_type + dangerous_sinks.

### 5. Extend `AuditIssue` API response (optional, lower priority)

The legacy `AuditIssue` model lacks data flow fields. For now, the data flow diagram only applies to Agent findings. If needed later, add a JSON `metadata` field to `AuditIssue` for storing data flow paths.

## Frontend Changes

### 1. New Component: `DataFlowPathDiagram`

File: `frontend/src/components/issues/DataFlowPathDiagram.tsx`

**Props:**
```typescript
interface DataFlowPathDiagramProps {
  dataflowPath: DataFlowStep[];
  source?: string;
  sink?: string;
}
```

**Structure (vertical pipeline):**

```
┌─ 🔴 Source ──────────────────────────────┐  ← Colored border node
│ app/handlers.py:23  handle_request()      │
│ user_input = request.args.get('id')       │  ← Key code line
└──────────────────────┬───────────────────┘
                       │
                  variable: user_input       ← Connection label
                  operation: assignment
                       │
                       ▼
┌─ ➡️ Propagation ─────────────────────────┐  ← Gray node
│ app/handlers.py:45  handle_request()      │
│ query = f'SELECT * ... WHERE id={...}'    │  ← Truncated
│                    [展开]                  │  ← Click to expand
└──────────────────────┬───────────────────┘
                       │
                  variable: query
                  operation: call
                       │
                       ▼
┌─ ⚠️ Sink ────────────────────────────────┐  ← Dark red node
│ app/db.py:89  execute_query()             │
│ cursor.execute(query)                     │
└──────────────────────────────────────────┘
```

**Sub-components (internal):**

- `FlowNode` — Single step card with colored left border, type icon, file:line badge, function name, code snippet (truncated or full), expand/collapse toggle
- `FlowConnection` — SVG arrow between nodes, rendered as a vertical line + arrowhead + operation label

**Interaction:**
- Default: nodes show thumbnail (file:line + function + code truncated to 80 chars)
- Click node header: expand to show full code block (using existing `CodeBlock` styling)
- If path has >5 steps: auto-collapse middle nodes, always show source and sink expanded
- Fallback: if `dataflow_path` is empty but `source`/`sink` exist, render a simple 2-node diagram from text fields

### 2. Update TypeScript Types

File: `frontend/src/shared/api/agentTasks.ts`

Add data flow fields to `AgentFinding` interface:
```typescript
interface AgentFinding {
  // ... existing fields ...
  source?: string;
  sink?: string;
  dataflow_path?: DataFlowStep[];
  code_context?: string;
  function_name?: string;
  class_name?: string;
}

interface DataFlowStep {
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

### 3. Integrate into `IssueDetailSheet`

File: `frontend/src/components/issues/IssueDetailSheet.tsx`

Replace the current plain-text data flow section (source → path → sink rendered as text) with the `DataFlowPathDiagram` component. Place it as a SectionCard between "Description" and "Code Snippet" sections.

Remove all `(agent as any)` casts for data flow fields since they'll now be properly typed.

### 4. Fallback Behavior

When `dataflow_path` is empty/null:
- If `source` and `sink` text exist: render a minimal 2-node diagram with source text → sink text
- If neither exists: don't render the data flow section at all

## Visual Specifications

### Node Styles

| Type | Left Border | Background | Icon |
|------|------------|------------|------|
| source | `border-l-4 border-orange-500` | `bg-orange-500/5` | 🔴 or `AlertCircle` icon |
| propagation | `border-l-4 border-gray-400` | `bg-gray-500/5` | ➡️ or `ArrowRight` icon |
| sanitization | `border-l-4 border-green-500` | `bg-green-500/5` | 🛡️ or `Shield` icon |
| sink | `border-l-4 border-red-600` | `bg-red-500/5` | ⚠️ or `AlertTriangle` icon |

### Connection Styles

- Vertical SVG line between nodes (2px, `stroke: #4b5563`)
- Arrowhead at bottom (simple triangle)
- Label positioned to the right of the line: `variable` name in bold + `operation` in muted text
- Use dashed line for sanitization steps (indicating interrupted flow)

### Code Block

When expanded, use the existing `CodeBlock` styling from `IssueDetailSheet`:
- Dark background (`bg-zinc-900`)
- Monospace font
- Syntax highlighting via CSS classes (if available)

## Scope

### In Scope (This Design)
- Backend: populate `dataflow_path`, extend API response, enhance reporting tool
- Frontend: `DataFlowPathDiagram` component with CSS+SVG rendering
- Integration into `IssueDetailSheet`
- Fallback for missing data

### Out of Scope
- Legacy `AuditIssue` data flow support (no model fields)
- Horizontal/swimlane layout
- Node drag-and-drop
- Graph auto-layout algorithms (elkjs, dagre)
- Zoom/pan on the diagram

## Files to Modify

### Backend
1. `backend/app/api/v1/endpoints/agent_tasks.py` — `_save_findings()`, `AgentFindingResponse`
2. `backend/app/services/agent/tools/reporting_tool.py` — Add `dataflow_path` parameter
3. `backend/app/services/agent/tools/code_analysis_tool.py` — Extend output with `path_steps`

### Frontend
1. `frontend/src/components/issues/DataFlowPathDiagram.tsx` — **New file**
2. `frontend/src/components/issues/IssueDetailSheet.tsx` — Replace text section with diagram
3. `frontend/src/shared/api/agentTasks.ts` — Add data flow types
4. `frontend/src/pages/AgentAudit/types.ts` — Add `DataFlowStep` type if not in shared API
