# AgentAudit 页面重构设计文档

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 AgentAudit 页面的整体布局重构为与 Dashboard/ProjectDetail 一致的卡片化布局风格

**Architecture:** 采用混合布局结构 - Header、PhaseStepper、StatsPanel、StatusBar 作为独立的 cyber-card 模块垂直堆叠，PhaseDetail 与 AgentTree 保持左右分栏布局

**Tech Stack:** React, TypeScript, Tailwind CSS, Lucide Icons

---

## 设计约束

- **重构范围**: 整个页面布局重构
- **布局结构**: 混合布局（部分模块单栏，部分模块左右分栏）
- **分栏内容**: PhaseDetail + AgentTree 左右分栏（63% / 37%）
- **StatsPanel位置**: 独立模块，在分栏区域下方
- **风格一致性**: 与 Dashboard/ProjectDetail 页面保持完全一致

---

## 项目风格参考

以 Dashboard 和 ProjectDetail 页面为参考，采用以下标准样式：

| 元素 | 样式类 |
|------|--------|
| 页面容器 | `space-y-4 px-6 pt-1 pb-6 bg-background min-h-screen font-mono relative` |
| 卡片 | `cyber-card p-3` 或 `cyber-card p-4` |
| 标题区域 | `section-header` + `section-title` |
| 空状态 | `empty-state` + `empty-state-icon` + `empty-state-description` |
| 加载状态 | `loading-spinner` |
| 状态标签 | Badge 组件 + severity 样式类 |

---

## 组件重构详情

### 1. 页面整体结构

**文件**: `frontend/src/pages/AgentAudit/index.tsx`

**改动**:
- 移除 `h-screen flex flex-col overflow-hidden relative`
- 使用 `space-y-4 px-6 pt-1 pb-6 bg-background min-h-screen font-mono relative`

```tsx
// 原有结构
<div className="h-screen bg-background flex flex-col overflow-hidden relative">

// 新结构
<div className="space-y-4 px-6 pt-1 pb-6 bg-background min-h-screen font-mono relative">
```

### 2. Header 区域

**文件**: `frontend/src/pages/AgentAudit/components/Header.tsx`

**改动**:
- 使用 `cyber-card p-4` 替代原有 Header 样式
- 移除 `h-20 shrink-0 backdrop-blur-xl` 等复杂样式
- 保持内部布局（Logo、任务信息、操作按钮）不变
- 按钮样式统一使用项目标准

```tsx
// 原有结构
<header className="relative flex h-20 shrink-0 items-center justify-between border-b border-border bg-white/88 px-6 backdrop-blur-xl">

// 新结构
<div className="cyber-card p-4">
  <div className="flex items-center justify-between">
    {/* Logo + 品牌信息 + 任务信息 */}
    {/* 操作按钮 */}
  </div>
</div>
```

### 3. PhaseStepper（阶段进度条）

**文件**: `frontend/src/pages/AgentAudit/components/PhaseStepper.tsx`

**改动**:
- 使用 `cyber-card p-4` 替代原有样式
- 添加 `section-header` + `section-title` 标题区域
- 保持阶段步骤器的内部逻辑不变
- 添加运行状态 Badge

```tsx
// 原有结构
<div className="flex-shrink-0 border-b border-border bg-white/90 backdrop-blur-sm px-6 py-4">

// 新结构
<div className="cyber-card p-4">
  <div className="section-header">
    <Activity className="w-5 h-5 text-primary" />
    <h3 className="section-title">执行阶段</h3>
    {isRunning && (
      <Badge className="ml-2 bg-primary/10 text-primary border border-primary/30">进行中</Badge>
    )}
  </div>
  <div className="flex items-stretch justify-center max-w-3xl mx-auto mt-3">
    {/* 阶段步骤 */}
  </div>
</div>
```

### 4. 左右分栏区域

**文件**: `frontend/src/pages/AgentAudit/index.tsx`

**改动**:
- 使用 `grid` 替代 `flex`
- 左右两侧都使用 `cyber-card` 包裹
- 设置最小/最大高度以保持合理比例
- AgentTree 区域添加 `section-header` 标题
- 移除 StatsPanel（移到分栏区域下方）

```tsx
// 原有结构
<div className="flex-1 flex overflow-hidden relative">
  <div className="w-[63%] flex flex-col border-r border-border bg-muted/20">
    <PhaseDetail ... />
  </div>
  <div className="w-[37%] flex flex-col bg-background overflow-hidden">
    {/* Agent Tree + Stats Panel */}
  </div>
</div>

// 新结构
<div className="grid grid-cols-1 lg:grid-cols-[63%_37%] gap-4">
  {/* 左侧：PhaseDetail */}
  <div className="cyber-card p-4 min-h-[500px] max-h-[70vh] overflow-hidden flex flex-col">
    <PhaseDetail ... />
  </div>
  
  {/* 右侧：AgentTree */}
  <div className="cyber-card p-4 min-h-[300px] max-h-[70vh] overflow-hidden flex flex-col">
    <div className="section-header">
      <Radio className="w-5 h-5 text-primary" />
      <h3 className="section-title">Agent 概览</h3>
    </div>
    {/* Agent Tree 内容 */}
  </div>
</div>
```

### 5. StatsPanel（统计面板）

**文件**: `frontend/src/pages/AgentAudit/components/StatsPanel.tsx`

**改动**:
- 作为独立模块放置在分栏区域下方
- 使用 `cyber-card p-4` 外壳
- 添加 `section-header` 标题
- 内部使用 `grid` 布局（4列）
- 保持原有内容结构，仅样式调整

```tsx
// 原有结构（嵌套在右侧栏底部）
<div className="flex-shrink-0 border-t border-border overflow-y-auto ... max-h-[45vh]">
  <div className="p-3">
    <StatsPanel task={task} findings={findings} />
  </div>
</div>

// 新结构（独立模块）
<div className="cyber-card p-4">
  <div className="section-header">
    <Activity className="w-5 h-5 text-primary" />
    <h3 className="section-title">执行统计</h3>
  </div>
  
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-3">
    {/* 执行进度 */}
    {/* 统计指标 */}
    {/* 漏洞等级分布 */}
    {/* 安全评分 */}
  </div>
</div>
```

### 6. StatusBar（状态栏）

**文件**: `frontend/src/pages/AgentAudit/index.tsx`

**改动**:
- 使用 `cyber-card p-3` 替代原有样式
- 移除复杂的背景效果
- 将进度条移到底部，更加直观
- 保持状态动画和文字内容

```tsx
// 原有结构
<div className="flex-shrink-0 h-9 border-t border-border flex items-center justify-between px-5 text-xs bg-white/90 backdrop-blur-sm relative overflow-hidden">
  <div className="absolute inset-0 bg-primary/8" style={{ width: `${progress}%` }} />
  {/* 状态内容 */}
</div>

// 新结构
<div className="cyber-card p-3">
  <div className="flex items-center justify-between text-xs">
    {/* 运行状态 */}
    {/* 进度信息 */}
  </div>
  <div className="relative h-2 overflow-hidden rounded-full bg-muted mt-2">
    <div className="absolute inset-y-0 left-0 rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
  </div>
</div>
```

### 7. PhaseDetail（活动日志）

**文件**: `frontend/src/pages/AgentAudit/components/PhaseDetail.tsx`

**改动**:
- 移除外层的 `flex flex-col h-full overflow-hidden` 结构
- 移除 `PhaseGuideCard`（不再需要，阶段信息已在 PhaseStepper 中展示）
- 移除独立的"当前阶段标题"区域（已在 PhaseStepper 中展示）
- 仅保留活动日志列表

```tsx
// 原有结构
<div className="flex flex-col h-full overflow-hidden">
  <PhaseGuideCard ... />
  {/* 当前阶段标题 */}
  <div className="flex-shrink-0 px-5 py-3 border-b ...">
    ...
  </div>
  {/* 日志区域 */}
  <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
    ...
  </div>
</div>

// 新结构（简化）
<div className="overflow-y-auto space-y-3 custom-scrollbar">
  {/* 已完成阶段折叠摘要 */}
  {/* 当前阶段活动流 */}
</div>
```

---

## 文件改动清单

| 文件 | 改动类型 | 描述 |
|------|----------|------|
| `AgentAudit/index.tsx` | 修改 | 页面容器、分栏区域、StatusBar |
| `AgentAudit/components/Header.tsx` | 修改 | 改为 cyber-card 样式 |
| `AgentAudit/components/PhaseStepper.tsx` | 修改 | 改为 cyber-card 样式，添加标题 |
| `AgentAudit/components/StatsPanel.tsx` | 修改 | 改为独立模块，grid 布局 |
| `AgentAudit/components/PhaseDetail.tsx` | 修改 | 简化结构，移除冗余元素 |
| `AgentAudit/components/AgentTreeNode.tsx` | 微调 | 样式细节统一 |

---

## 验收标准

1. 页面整体结构与 Dashboard/ProjectDetail 一致
2. 所有模块使用 `cyber-card` 样式
3. Header、PhaseStepper、StatsPanel、StatusBar 作为独立模块
4. PhaseDetail + AgentTree 保持左右分栏布局
5. 所有样式类使用项目标准定义
6. 保持原有功能完整性