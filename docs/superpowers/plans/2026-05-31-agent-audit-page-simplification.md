# Agent Audit 页面简化实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 简化深度审计页面，让用户更容易理解如何操作和执行审计任务

**Architecture:** 移除赛博朋克风格的终端输入启动屏幕，改为简洁欢迎页面加按钮；在左侧日志区顶部添加可折叠的阶段引导卡片

**Tech Stack:** React, TypeScript, Tailwind CSS, shadcn/ui 组件库

---

## 文件结构

| 文件 | 改动类型 | 负责内容 |
|------|----------|----------|
| `frontend/src/pages/AgentAudit/components/SplashScreen.tsx` | 重写 | 简洁欢迎页面 |
| `frontend/src/pages/AgentAudit/components/PhaseDetail.tsx` | 修改 | 顶部添加引导卡片 |

---

### Task 1: 重写 SplashScreen 组件

**Files:**
- Modify: `frontend/src/pages/AgentAudit/components/SplashScreen.tsx`

- [ ] **Step 1: 重写 SplashScreen 为简洁欢迎页面**

完全替换文件内容为：

```tsx
/**
 * Splash Screen Component - Simplified
 * 简洁的欢迎页面，一个醒目的「开始审计任务」按钮
 */

import { memo } from "react";
import { Shield, Play } from "lucide-react";
import { BRAND_AGENT_AUDIT_NAME } from "@/shared/constants/branding";

interface SplashScreenProps {
  onComplete: () => void;
}

export const SplashScreen = memo(function SplashScreen({
  onComplete,
}: SplashScreenProps) {
  const [BRAND_AGENT_PRIMARY, BRAND_AGENT_SECONDARY = "Audit"] =
    BRAND_AGENT_AUDIT_NAME.split(" ");

  return (
    <div className="h-screen bg-background flex flex-col items-center justify-center p-8">
      {/* Logo */}
      <div className="text-center mb-8">
        <div className="flex items-center justify-center gap-3 mb-4">
          <Shield className="w-10 h-10 text-primary" />
          <div>
            <h1 className="text-4xl font-bold tracking-wide">
              <span className="text-primary">{BRAND_AGENT_PRIMARY}</span>
              <span className="text-foreground ml-2">{BRAND_AGENT_SECONDARY}</span>
            </h1>
          </div>
        </div>
        <p className="text-muted-foreground text-sm tracking-widest uppercase">
          Autonomous Security Agent
        </p>
      </div>

      {/* Start Button */}
      <button
        onClick={onComplete}
        className="
          flex items-center gap-3 px-8 py-4
          bg-primary text-white font-semibold text-lg
          rounded-lg shadow-lg shadow-primary/25
          hover:bg-primary/90 hover:shadow-xl hover:shadow-primary/30
          transition-all duration-200
          focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2
        "
      >
        <Play className="w-5 h-5" />
        开始审计任务
      </button>

      {/* Hint */}
      <p className="text-muted-foreground text-sm mt-4">
        点击按钮创建并启动新的安全审计任务
      </p>
    </div>
  );
});

export default SplashScreen;
```

- [ ] **Step 2: 验证 SplashScreen 渲染正确**

检查组件是否：
- 显示 DeepAudit logo 和副标题
- 有一个醒目的「开始审计任务」按钮
- 点击按钮调用 onComplete（打开创建任务对话框）
- 无赛博朋克效果

---

### Task 2: 在 PhaseDetail 添加引导卡片

**Files:**
- Modify: `frontend/src/pages/AgentAudit/components/PhaseDetail.tsx`

- [ ] **Step 1: 在 PhaseDetail 组件顶部添加 PhaseGuideCard 子组件**

在 `PhaseDetail.tsx` 文件中，在现有的 imports 之后添加新的子组件：

```tsx
// ============ Phase Guide Card ============

interface PhaseGuideCardProps {
  isExpanded: boolean;
  onToggle: () => void;
}

function PhaseGuideCard({ isExpanded, onToggle }: PhaseGuideCardProps) {
  return (
    <div className="border border-border rounded-lg bg-muted/50 mb-4 overflow-hidden">
      {/* Header - clickable to toggle */}
      <button
        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-muted/80 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-center gap-2">
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          )}
          <span className="text-sm font-semibold text-foreground">任务执行指南</span>
        </div>
        <span className="text-xs text-muted-foreground">
          {isExpanded ? "折叠" : "展开"}
        </span>
      </button>

      {/* Content - expandable */}
      {isExpanded && (
        <div className="px-4 pb-3 border-t border-border/50">
          <p className="text-xs text-muted-foreground mb-3">
            审计任务将自动依次执行以下5个阶段，您可以观察实时进度：
          </p>
          <div className="space-y-1.5">
            {AUDIT_PHASES.map((phase) => {
              const config = AUDIT_PHASE_CONFIG[phase];
              return (
                <div key={phase} className="flex items-center gap-2 text-xs">
                  <span className="w-5 text-center">{config.icon}</span>
                  <span className="font-medium text-foreground">{config.label}</span>
                  <span className="text-muted-foreground">-</span>
                  <span className="text-muted-foreground">{config.description}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: 在 PhaseDetail 主组件中添加引导卡片状态和渲染**

修改 `PhaseDetail` 组件：

1. 在组件内部添加状态：
```tsx
const [guideExpanded, setGuideExpanded] = useState(true);
```

2. 在 `return` 的最外层 `div` 内，在最顶部添加引导卡片（在"当前阶段标题"区域之前）：
```tsx
{/* 阶段引导卡片 */}
<PhaseGuideCard
  isExpanded={guideExpanded}
  onToggle={() => setGuideExpanded(!guideExpanded)}
/>
```

完整修改后的 PhaseDetail 组件结构：

```tsx
export const PhaseDetail = memo(function PhaseDetail({
  logs,
  currentPhase,
  completedPhases,
  isRunning,
  expandedLogIds,
  onToggleLogExpanded,
}: PhaseDetailProps) {
  const [expandedPhases, setExpandedPhases] = useState<Set<AuditPhase>>(new Set());
  const [guideExpanded, setGuideExpanded] = useState(true);  // 🔥 新增
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isAutoScroll, setIsAutoScroll] = useState(true);

  // ... 现有的日志分组逻辑 ...

  return (
    <div className="flex flex-col h-full">
      {/* 🔥 新增：阶段引导卡片 */}
      <PhaseGuideCard
        isExpanded={guideExpanded}
        onToggle={() => setGuideExpanded(!guideExpanded)}
      />

      {/* 当前阶段标题 - 保持不变 */}
      <div className="flex-shrink-0 px-5 py-3 border-b border-border bg-white/80 backdrop-blur-sm">
        {/* ... 现有内容 ... */}
      </div>

      {/* 日志区域 - 保持不变 */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
        {/* ... 现有内容 ... */}
      </div>
    </div>
  );
});
```

- [ ] **Step 3: 验证引导卡片功能正确**

检查：
- 引导卡片在 PhaseDetail 顶部显示
- 默认展开状态
- 内容显示5个阶段的信息
- 点击标题栏可折叠/展开
- 折叠后只显示标题栏

---

### Task 3: 最终验证和提交

- [ ] **Step 1: 启动前端开发服务器验证**

Run: `cd frontend && npm run dev`

检查：
1. 访问深度审计页面，启动屏幕应显示简洁欢迎页和「开始审计任务」按钮
2. 点击按钮打开创建任务对话框
3. 进入审计页面后，左侧顶部有引导卡片，默认展开
4. 点击引导卡片标题栏可折叠/展开

- [ ] **Step 2: 提交代码**

```bash
git add frontend/src/pages/AgentAudit/components/SplashScreen.tsx frontend/src/pages/AgentAudit/components/PhaseDetail.tsx docs/superpowers/specs/2026-05-31-agent-audit-page-simplification-design.md docs/superpowers/plans/2026-05-31-agent-audit-page-simplification.md
git commit -m "feat: simplify agent audit page for better UX

- Replace cyberpunk terminal SplashScreen with simple welcome page + button
- Add collapsible phase guide card to PhaseDetail component
- Users can now easily understand how to start audit and what phases do"
```

---

## Self-Review Checklist

**1. Spec coverage:**
- ✅ SplashScreen 简化为按钮启动 (Task 1)
- ✅ PhaseDetail 顶部添加引导卡片 (Task 2)
- ✅ 引导卡片默认展开 (Task 2 Step 2)
- ✅ 引导卡片可折叠 (Task 2 Step 1)
- ✅ 引导卡片内容简洁列表式 (Task 2 Step 1)

**2. Placeholder scan:**
- ✅ 无 TBD/TODO
- ✅ 所有步骤都有完整代码
- ✅ 无 "添加适当错误处理" 等模糊指令

**3. Type consistency:**
- ✅ 使用现有 AUDIT_PHASE_CONFIG 和 AUDIT_PHASES
- ✅ SplashScreenProps 接口保持不变
- ✅ PhaseDetailProps 接口保持不变

---

## 完成标准

1. SplashScreen 显示简洁欢迎页面，无赛博朋克效果
2. 「开始审计任务」按钮醒目，点击打开创建任务对话框
3. PhaseDetail 顶部有引导卡片，默认展开
4. 引导卡片内容清晰说明5个阶段
5. 用户可折叠/展开引导卡片