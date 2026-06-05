/**
 * Agent Audit 常量定义
 * 审计页面共享常量配置
 */

import React from "react";
import {
  Brain, Wrench, Target, Bug, Zap, Terminal,
  AlertTriangle, Shield, Search, FileCode,
  CheckCircle2, XCircle, Clock, Loader2, Square, Bot,
  Cpu, Scan, FileSearch, ShieldCheck,
  // 阶段图标
  Settings2, Eye, Microscope, ShieldAlert, FileText
} from "lucide-react";

// ============ 严重等级配色 ============

export const SEVERITY_COLORS: Record<string, string> = {
  critical: "text-rose-700 bg-rose-500/10 border border-rose-500/40",
  high: "text-orange-700 bg-orange-500/15 border border-orange-500/40",
  medium: "text-amber-700 bg-amber-500/15 border border-amber-500/40",
  low: "text-sky-700 bg-sky-500/15 border border-sky-500/40",
  info: "text-foreground bg-muted/20 border border-border",
};

// ============ 动态动词（状态动画） ============

export const ACTION_VERBS = [
  "分析中", "扫描中", "探测中", "调查中",
  "检查中", "审计中", "测试中", "探索中",
  "处理中", "评估中", "追踪中", "映射中"
];

// ============ 日志类型配置 ============

export const LOG_TYPE_CONFIG: Record<string, {
  icon: React.ReactNode;
  borderColor: string;
  bgColor: string;
  label: string;
}> = {
  thinking: {
    icon: React.createElement(Brain, { className: "w-4 h-4 text-violet-600" }),
    borderColor: "border-l-violet-400",
    bgColor: "bg-violet-50/60",
    label: "思考"
  },
  tool: {
    icon: React.createElement(Wrench, { className: "w-4 h-4 text-amber-600" }),
    borderColor: "border-l-amber-400",
    bgColor: "bg-amber-50/60",
    label: "工具"
  },
  phase: {
    icon: React.createElement(Target, { className: "w-4 h-4 text-indigo-600" }),
    borderColor: "border-l-indigo-400",
    bgColor: "bg-indigo-50/60",
    label: "阶段"
  },
  finding: {
    icon: React.createElement(Bug, { className: "w-4 h-4 text-rose-600" }),
    borderColor: "border-l-rose-500",
    bgColor: "bg-rose-50/60",
    label: "漏洞"
  },
  dispatch: {
    icon: React.createElement(Zap, { className: "w-4 h-4 text-sky-600" }),
    borderColor: "border-l-sky-400",
    bgColor: "bg-sky-50/60",
    label: "调度"
  },
  info: {
    icon: React.createElement(Terminal, { className: "w-4 h-4 text-slate-500" }),
    borderColor: "border-l-slate-300",
    bgColor: "bg-white",
    label: "信息"
  },
  error: {
    icon: React.createElement(AlertTriangle, { className: "w-4 h-4 text-red-600" }),
    borderColor: "border-l-red-500",
    bgColor: "bg-red-50/60",
    label: "错误"
  },
  user: {
    icon: React.createElement(Shield, { className: "w-4 h-4 text-indigo-600" }),
    borderColor: "border-l-indigo-400",
    bgColor: "bg-indigo-50/60",
    label: "用户"
  },
  progress: {
    icon: React.createElement(Loader2, { className: "w-4 h-4 text-emerald-600 animate-spin" }),
    borderColor: "border-l-emerald-400",
    bgColor: "bg-emerald-50/60",
    label: "进度"
  },
};

// ============ Agent 状态配置 ============

export const AGENT_STATUS_CONFIG: Record<string, {
  icon: React.ReactNode;
  color: string;
  text: string;
  animate?: boolean;
}> = {
  running: {
    icon: React.createElement("div", { className: "w-2 h-2 rounded-full bg-emerald-500" }),
    color: "text-emerald-600",
    text: "运行中",
    animate: true
  },
  completed: {
    icon: React.createElement(CheckCircle2, { className: "w-3 h-3 text-indigo-600" }),
    color: "text-indigo-600",
    text: "已完成"
  },
  failed: {
    icon: React.createElement(XCircle, { className: "w-3 h-3 text-rose-600" }),
    color: "text-rose-600",
    text: "失败"
  },
  waiting: {
    icon: React.createElement(Clock, { className: "w-3 h-3 text-amber-600" }),
    color: "text-amber-600",
    text: "等待中"
  },
  created: {
    icon: React.createElement("div", { className: "w-2 h-2 rounded-full bg-slate-400" }),
    color: "text-slate-500",
    text: "已创建"
  },
};

// ============ Agent 类型配置 ============

export const AGENT_TYPE_CONFIG: Record<string, {
  icon: React.ReactNode;
  label: string;
  color: string;
  borderColor: string;
}> = {
  orchestrator: {
    icon: React.createElement(Cpu, { className: "w-4 h-4 text-violet-600" }),
    label: "编排器",
    color: "violet",
    borderColor: "border-l-violet-500"
  },
  recon: {
    icon: React.createElement(Scan, { className: "w-4 h-4 text-sky-600" }),
    label: "侦察",
    color: "sky",
    borderColor: "border-l-sky-500"
  },
  analysis: {
    icon: React.createElement(FileSearch, { className: "w-4 h-4 text-amber-600" }),
    label: "分析",
    color: "amber",
    borderColor: "border-l-amber-500"
  },
  verification: {
    icon: React.createElement(ShieldCheck, { className: "w-4 h-4 text-emerald-600" }),
    label: "验证",
    color: "emerald",
    borderColor: "border-l-emerald-500"
  },
};

// ============ 任务状态配置 ============

export const TASK_STATUS_CONFIG: Record<string, {
  bg: string;
  icon: React.ReactNode;
  text: string;
}> = {
  pending: {
    bg: "bg-slate-400",
    icon: React.createElement(Clock, { className: "w-3 h-3" }),
    text: "待处理"
  },
  running: {
    bg: "bg-emerald-500",
    icon: React.createElement(Loader2, { className: "w-3 h-3 animate-spin" }),
    text: "运行中"
  },
  completed: {
    bg: "bg-indigo-600",
    icon: React.createElement(CheckCircle2, { className: "w-3 h-3" }),
    text: "已完成"
  },
  failed: {
    bg: "bg-rose-500",
    icon: React.createElement(XCircle, { className: "w-3 h-3" }),
    text: "失败"
  },
  cancelled: {
    bg: "bg-amber-500",
    icon: React.createElement(Square, { className: "w-3 h-3" }),
    text: "已取消"
  },
};

// ============ Polling Intervals ============

export const POLLING_INTERVALS = {
  AGENT_TREE: 2000,
  TASK_STATS: 2000,
  AGENT_TREE_DEBOUNCE: 500,
  AGENT_TREE_MIN_DELAY: 100,
};

// ============ Timeouts ============

export const TIMEOUTS = {
  SPLASH_SCREEN: 2800,
  HEARTBEAT: 45000,
  RECONNECT_BASE: 1000,
  MAX_RECONNECT_ATTEMPTS: 5,
};

// ============ UI Configuration ============

export const UI_CONFIG = {
  LOG_MAX_HEIGHT: 256,
  TREE_INDENT: 16,
  ANIMATION_DURATION: 200,
  SCROLL_BEHAVIOR: 'smooth' as const,
};

// ============ Color Palette ============

export const COLORS = {
  primary: '#FF6B2C',
  success: '#34d399',  // emerald-400
  error: '#fb7185',    // rose-400
  warning: '#fbbf24',  // amber-400
  info: '#38bdf8',     // sky-400
  background: {
    primary: '#0a0a0f',
    secondary: '#0d0d12',
    tertiary: '#0b0b10',
  },
  border: {
    primary: 'rgba(255,255,255,0.1)',
    secondary: 'rgba(255,255,255,0.05)',
  }
};

// ============ ASCII Art ============

export const DEEPAUDIT_ASCII = `
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║     ____  _____ _____ ____   _   _   _ ____ ___ _____         ║
║    |  _ \\| ____| ____|  _ \\ / \\ | | | |  _ \\_ _|_   _|        ║
║    | | | |  _| |  _| | |_) / _ \\| | | | | | | |  | |          ║
║    | |_| | |___| |___|  __/ ___ \\ |_| | |_| | |  | |          ║
║    |____/|_____|_____|_| /_/   \\_\\___/|____/___| |_|          ║
║                                                               ║
║                 [ Autonomous Security Agent ]                 ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝`;
