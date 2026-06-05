// 应用常量定义

// 支持的编程语言
export const SUPPORTED_LANGUAGES = [
  'javascript',
  'typescript',
  'python',
  'java',
  'go',
  'objective-c',
  'c',
  'rust',
  'cpp',
  'csharp',
  'php',
  'ruby',
  'swift',
] as const;

// 问题类型（规则名带性能→performance，带质量→quality，其他→security）
export const ISSUE_TYPES = {
  SECURITY: 'security',
  PERFORMANCE: 'performance',
  QUALITY: 'quality',
} as const;

// 问题严重程度
export const SEVERITY_LEVELS = {
  CRITICAL: 'critical',
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
} as const;

// 问题状态（统一审核状态）
export const ISSUE_STATUS = {
  FIXED: 'fixed',
  NOT_FIXED: 'not_fixed',
  FALSE_POSITIVE: 'false_positive',
  SUSPICIOUS: 'suspicious',
} as const;

// 状态中文标签
export const ISSUE_STATUS_LABELS: Record<string, string> = {
  fixed: "已修复",
  not_fixed: "未修复",
  false_positive: "误报",
  suspicious: "存疑",
  // 旧状态兼容（可能出现在未迁移的数据中）
  open: "未修复",
  new: "未修复",
  resolved: "已修复",
  pending_review: "存疑",
  analyzing: "存疑",
  verified: "未修复",
  needs_review: "存疑",
  wont_fix: "未修复",
  duplicate: "误报",
};

// 状态徽章颜色样式（统一最小宽度）
export const ISSUE_STATUS_BADGE_CLASS: Record<string, string> = {
  fixed: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/25 min-w-[48px]",
  not_fixed: "bg-warning/15 text-warning dark:text-warning border-warning/25 min-w-[48px]",
  false_positive: "bg-gray-500/20 text-gray-600 dark:text-gray-400 border-gray-500/30 min-w-[48px]",
  suspicious: "bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/25 min-w-[48px]",
  // 旧状态兼容
  open: "bg-warning/15 text-warning dark:text-warning border-warning/25 min-w-[48px]",
  new: "bg-warning/15 text-warning dark:text-warning border-warning/25 min-w-[48px]",
  resolved: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/25 min-w-[48px]",
};

// 任务状态
export const TASK_STATUS = {
  PENDING: 'pending',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
} as const;

// 用户角色
export const USER_ROLES = {
  ADMIN: 'admin',
  MEMBER: 'member',
} as const;

// 项目成员角色
export const PROJECT_ROLES = {
  OWNER: 'owner',
  ADMIN: 'admin',
  MEMBER: 'member',
  VIEWER: 'viewer',
} as const;

// 项目来源类型
export const PROJECT_SOURCE_TYPES = {
  REPOSITORY: 'repository',
  ZIP: 'zip',
} as const;

// 分析深度
export const ANALYSIS_DEPTH = {
  BASIC: 'basic',
  STANDARD: 'standard',
  DEEP: 'deep',
} as const;

// 默认配置（与后端对齐）
export const DEFAULT_CONFIG = {
  MAX_FILE_SIZE: 200 * 1024, // 200KB (对齐后端 MAX_FILE_SIZE_BYTES)
  MAX_FILES_PER_SCAN: 0, // 对齐后端 MAX_ANALYZE_FILES，0表示无限制
  ANALYSIS_TIMEOUT: 30000, // 30秒
  DEBOUNCE_DELAY: 300, // 300ms
} as const;

// ProjectDetail 页面专用常量
// 单请求超时（ms）：避免外部/后端卡死导致 UI 长时间无响应
export const PROJECT_DETAIL_REQUEST_TIMEOUT_MS = 12_000;
// Issues/Findings 面板：最多抓取最近 N 个已完成任务
export const PROJECT_DETAIL_ISSUES_MAX_TASKS = 20;
// Issues/Findings 拉取并发度：防止对后端形成突发压力
export const PROJECT_DETAIL_ISSUES_FETCH_CONCURRENCY = 5;

// API 端点
export const API_ENDPOINTS = {
  PROJECTS: '/api/projects',
  AUDIT_TASKS: '/api/audit-tasks',
  INSTANT_ANALYSIS: '/api/instant-analysis',
  USERS: '/api/users',
} as const;

// 本地存储键名
export const STORAGE_KEYS = {
  THEME: 'deepaudit-theme',
  USER_PREFERENCES: 'deepaudit-preferences',
  RECENT_PROJECTS: 'deepaudit-recent-projects',
} as const;

// 导出项目类型相关常量
export * from './projectTypes';
