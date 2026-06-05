# 字体与字号体系统一设计

**日期**: 2026-06-02
**状态**: 待实施
**方案**: 渐进式统一（方案 A）

---

## 问题概述

当前系统存在以下字体/字号不一致问题：

1. **字体家族冲突**：Tailwind 配置用 `Inter`，globals.css 用 `Noto Sans SC`，index.html 加载了从未使用的 `Plus Jakarta Sans`
2. **font-mono 劫持**：125 处 `font-mono` 使用中，大部分实际渲染为无衬线字体（因为 globals.css 覆盖了 `.font-mono` 为 `var(--font-ui)`）
3. **字号体系混乱**：自定义 Tailwind 字号偏离默认值（xs=13px, sm=15px），22 处任意像素硬编码绕过字号体系
4. **ReportExportDialog 硬编码**：约 30 个独立 font-size 值
5. **标题/文本框样式不统一**：同为标题或同为文本框，字号和字重不一致

---

## 设计决策

| 决策项 | 选择 | 原因 |
|--------|------|------|
| 西文主字体 | Inter | 现代无衬线字体，与 shadcn/ui 生态一致 |
| 中文主字体 | Noto Sans SC + PingFang SC | 开源、中文渲染质量高、跨平台 |
| 字号体系 | Tailwind 默认值 | 与 shadcn/ui 组件库一致 |
| 硬编码处理 | 统一到 Tailwind 体系 | 消除双体系并存问题 |
| 实施策略 | 渐进式统一 | 风险可控、每步可验证 |

---

## 字体家族体系

### Tailwind 配置 (`tailwind.config.js`)

```js
fontFamily: {
  sans: ['Inter', 'Noto Sans SC', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'system-ui', 'sans-serif'],
  mono: ['SFMono-Regular', 'JetBrains Mono', 'Roboto Mono', 'Menlo', 'monospace'],
  display: ['Inter', 'Noto Sans SC', 'PingFang SC', 'sans-serif'],
}
```

### CSS 变量 (`globals.css`)

```css
--font-ui: 'Inter', 'Noto Sans SC', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', system-ui, sans-serif;
--font-code: 'SFMono-Regular', 'JetBrains Mono', 'Roboto Mono', 'Menlo', monospace;
```

### font-mono 修复

- 删除 globals.css 中错误的 `.font-mono { font-family: var(--font-ui) !important; }` 覆盖
- 保留 `pre.font-mono, code.font-mono, kbd.font-mono, samp.font-mono` 的等宽字体规则
- 审查 125 处 font-mono 使用：代码场景保留等宽，非代码场景改用 font-sans

### 清理项

- 移除 index.html 中 Plus Jakarta Sans 的 Google Font 加载，替换为 Inter
- 标记 public/fonts/ 下 Ark Pixel 字体文件为可清理（当前未引用）

---

## 字号体系

### Tailwind 字号（恢复默认值）

| Token | 字号 | 行高 | 语义用途 |
|-------|------|------|----------|
| `text-xs` | 12px (0.75rem) | 16px | 徽章、小标签、辅助信息 |
| `text-sm` | 14px (0.875rem) | 20px | 表格内容、输入框文本、次要描述 |
| `text-base` | 16px (1rem) | 24px | 正文、表单标签、主要内容 |
| `text-lg` | 18px (1.125rem) | 28px | 卡片标题、小节标题 |
| `text-xl` | 20px (1.25rem) | 28px | 页面副标题 |
| `text-2xl` | 24px (1.5rem) | 32px | 页面主标题 |
| `text-3xl` | 30px (1.875rem) | 36px | 大标题、统计数值 |
| `text-4xl` | 36px (2.25rem) | 40px | Hero 区域、特殊标题 |

### 硬编码值映射

| 当前值 | 映射目标 | 说明 |
|--------|----------|------|
| `text-[8px]` | `text-xs` (12px) | 最小字号不低于 12px |
| `text-[10px]` | `text-xs` (12px) | 同上 |
| `text-[11px]` | `text-xs` (12px) | 同上 |
| `text-[13px]` | `text-sm` (14px) | 接近 sm |

### globals.css 自定义类字号更新

| 类名 | 当前字号 | 目标 | Tailwind token |
|------|----------|------|----------------|
| `.terminal-title` | 14px (0.875rem) | 14px | text-sm |
| `.cyber-btn` | 15px (0.9375rem) | 14px | text-sm |
| `.cyber-input` | 15px | 14px | text-sm |
| `.cyber-table` | 15px | 14px | text-sm |
| `.cyber-badge` | 12px (0.75rem) | 12px | text-xs |
| `.cyber-label` | 13px (0.8125rem) | 12px | text-xs |
| `.section-title` | 18px (1.125rem) | 18px | text-lg |
| `.stat-value` | 32px (2rem) | 30px | text-3xl |
| `.stat-label` | 13px (0.8125rem) | 12px | text-xs |
| `.data-label` | 13px | 12px | text-xs |
| `.empty-state-title` | 22px (1.375rem) | 20px | text-xl |
| `.empty-state-description` | 15px (0.9375rem) | 14px | text-sm |
| `.cyber-table th` | 13px | 12px | text-xs |

### 语义化字号 CSS 变量（新增）

```css
--text-badge: 0.75rem;       /* 12px - xs */
--text-caption: 0.875rem;    /* 14px - sm */
--text-body: 1rem;           /* 16px - base */
--text-heading-sm: 1.125rem; /* 18px - lg */
--text-heading-md: 1.25rem;  /* 20px - xl */
--text-heading-lg: 1.5rem;   /* 24px - 2xl */
--text-heading-xl: 1.875rem; /* 30px - 3xl */
```

### ReportExportDialog 特殊处理

PDF 导出模块保留精确的字号控制，但统一为基于根字号的比例单位（rem），并新增注释标记为打印专用字号。不在主应用字号体系重构范围内。

---

## 标题与文本框样式统一规则

### 标题层级

| 层级 | 字号 | 字重 | 使用场景 |
|------|------|------|----------|
| 页面标题 | text-2xl (24px) | font-semibold (600) | 每个页面的主标题 |
| 区块标题 | text-lg (18px) | font-semibold (600) | 卡片、面板的标题 |
| 小节标题 | text-base (16px) | font-medium (500) | 列表分组标题、子面板标题 |
| 列表项标题 | text-sm (14px) | font-medium (500) | 表格行标题、列表项名称 |

### 文本框/输入框

| 元素 | 字号 | 字重 | 说明 |
|------|------|------|------|
| 输入框文本 | text-sm (14px) | font-normal | 与 shadcn/ui 默认一致 |
| 输入框标签 | text-sm (14px) | font-medium | 表单标签 |
| 输入框占位符 | text-sm | font-normal + text-muted-foreground | — |
| 文本域文本 | text-sm (14px) | font-normal | — |
| 下拉选项 | text-sm (14px) | font-normal | — |

---

## 实施步骤

### 阶段 1：配置层统一

1. 修改 `tailwind.config.js` — 恢复默认 fontSize 值，统一 fontFamily 定义
2. 修改 `globals.css` — 统一 `--font-ui` CSS 变量，删除 `.font-mono` 错误覆盖，更新自定义类字号，新增语义化字号变量
3. 修改 `index.html` — 替换 Google Font 加载（Plus Jakarta Sans → Inter）
4. 更新 globals.css 中所有自定义类（cyber-* 等）的字号为新 token

### 阶段 2：硬编码值替换

5. 替换所有 `text-[8px]` → `text-xs`
6. 替换所有 `text-[10px]` → `text-xs`
7. 替换所有 `text-[11px]` → `text-xs`
8. 替换所有 `text-[13px]` → `text-sm`

### 阶段 3：font-mono 审查与修复

9. 逐文件审查 font-mono 使用，将非代码场景的改为 font-sans
10. 为终端/代码区域确保等宽字体正确渲染

### 阶段 4：标题和文本框一致性统一

11. 统一所有页面标题字号和字重（页面标题 → text-2xl + font-semibold）
12. 统一所有输入框/文本框内的字号（输入文本 → text-sm）
13. 统一所有区块标题和小节标题（区块标题 → text-lg + font-semibold，小节标题 → text-base + font-medium）

---

## 不在范围内

- 暗黑模式颜色对比度调整（字体与颜色无关）
- ReportExportDialog 内部 PDF 样式重构（仅统一为 rem 单位）
- 清理 public/fonts/ 遗留字体文件（需单独确认）
- 新增字重体系（当前 font-weight 使用基本合理）
