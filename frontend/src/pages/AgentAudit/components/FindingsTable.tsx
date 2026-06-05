/**
 * Findings Table Component for Agent Audit Page
 * 问题列表表格 - 深度审计页面专用（无AI排查功能）
 */

import { memo, useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertTriangle,
  CheckCircle,
  FileText,
  Search,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { AgentFinding } from "@/shared/api/agentTasks";
import { ISSUE_STATUS_LABELS, ISSUE_STATUS_BADGE_CLASS, ISSUE_STATUS } from "@/shared/constants";

// ============ 严重等级配色 ============

const SEVERITY_CONFIG: Record<string, { label: string; className: string }> = {
  critical: { label: "严重", className: "severity-critical" },
  high: { label: "高", className: "severity-high" },
  medium: { label: "中", className: "severity-medium" },
  low: { label: "低", className: "severity-low" },
  info: { label: "信息", className: "severity-info" },
};

const VULN_TYPE_LABELS: Record<string, string> = {
  sql_injection: "SQL 注入",
  nosql_injection: "NoSQL 注入",
  xss: "XSS 跨站脚本",
  command_injection: "命令注入",
  code_injection: "代码注入",
  path_traversal: "路径遍历",
  file_inclusion: "文件包含",
  ssrf: "SSRF",
  xxe: "XXE",
  deserialization: "反序列化",
  auth_bypass: "认证绕过",
  idor: "IDOR",
  sensitive_data_exposure: "敏感数据泄露",
  hardcoded_secret: "硬编码密钥",
  weak_crypto: "弱加密",
  race_condition: "竞态条件",
  business_logic: "业务逻辑",
  memory_corruption: "内存破坏",
  other: "其他",
};

// ============ 从 title 中提取文件路径 ============

// 常见的代码文件扩展名
const CODE_EXTENSIONS = [
  '.py', '.js', '.ts', '.jsx', '.tsx', '.java', '.go', '.php', '.rb', '.rs',
  '.c', '.cpp', '.h', '.hpp', '.cs', '.swift', '.kt', '.scala', '.vue', '.svelte',
  '.html', '.htm', '.css', '.scss', '.sass', '.less', '.sql', '.sh', '.bash',
  '.json', '.xml', '.yaml', '.yml', '.toml', '.ini', '.cfg', '.conf', '.env',
  '.jsp', '.asp', '.aspx', '.erb', '.haml', '.pug', '.jade', '.ejs'
];

/**
 * 从 title 中提取文件路径
 * 支持的格式：
 * - "app/routes/user.py: SQL 注入"
 * - "app/routes/user.py - SQL 注入"
 * - "SQL 注入 (app/routes/user.py)"
 * - "app/routes/user.py" 开头
 */
function extractFilePathFromTitle(title: string): string | null {
  if (!title) return null;

  // 尝试匹配以文件路径开头的格式: "path/to/file.ext: 描述" 或 "path/to/file.ext - 描述"
  const prefixMatch = title.match(/^([a-zA-Z0-9_\-./]+\.[a-zA-Z0-9]+)\s*[:\-–—]\s*/);
  if (prefixMatch && CODE_EXTENSIONS.some(ext => prefixMatch[1].toLowerCase().endsWith(ext))) {
    return prefixMatch[1];
  }

  // 尝试匹配括号内的文件路径: "描述 (path/to/file.ext)" 或 "描述【path/to/file.ext】"
  const bracketMatch = title.match(/[([{]([a-zA-Z0-9_\-./]+\.[a-zA-Z0-9]+)[)\]}]/);
  if (bracketMatch && CODE_EXTENSIONS.some(ext => bracketMatch[1].toLowerCase().endsWith(ext))) {
    return bracketMatch[1];
  }

  // 尝试匹配包含路径分隔符的文件路径: "path/to/file.ext"
  const pathMatch = title.match(/([a-zA-Z0-9_\-]+(?:\/[a-zA-Z0-9_\-]+)+\.[a-zA-Z0-9]+)/);
  if (pathMatch && CODE_EXTENSIONS.some(ext => pathMatch[1].toLowerCase().endsWith(ext))) {
    return pathMatch[1];
  }

  // 尝试匹配简单的文件名: "filename.ext"
  const fileMatch = title.match(/([a-zA-Z0-9_\-]+\.[a-zA-Z0-9]{2,4})(?:\s|$|:|-)/);
  if (fileMatch && CODE_EXTENSIONS.some(ext => fileMatch[1].toLowerCase().endsWith(ext))) {
    return fileMatch[1];
  }

  return null;
}

// ============ Props ============

interface FindingsTableProps {
  findings: AgentFinding[];
  taskId?: string;
  onViewDetail?: (finding: AgentFinding) => void;
  onStatusChange?: (finding: AgentFinding, newStatus: string) => void;
}

// ============ Component ============

export const FindingsTable = memo(function FindingsTable({
  findings,
  taskId,
  onViewDetail,
  onStatusChange,
}: FindingsTableProps) {
  // 筛选状态
  const [nameFilter, setNameFilter] = useState("");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // 筛选后的问题列表
  const filteredFindings = useMemo(() => {
    return findings.filter(f => {
      if (nameFilter && !f.title.toLowerCase().includes(nameFilter.toLowerCase())) return false;
      if (severityFilter !== "all" && f.severity !== severityFilter) return false;
      if (statusFilter !== "all" && (f.status || 'not_fixed') !== statusFilter) return false;
      return true;
    });
  }, [findings, nameFilter, severityFilter, statusFilter]);

  const getSeverityBadge = (severity: string) => {
    const config = SEVERITY_CONFIG[severity] || SEVERITY_CONFIG.low;
    return (
      <Badge className={`${config.className} font-bold uppercase px-2 py-1 rounded text-xs`}>
        {config.label}
      </Badge>
    );
  };

  const getStatusLabel = (status: string) => ISSUE_STATUS_LABELS[status] || status;
  const getStatusBadgeClass = (status: string) =>
    ISSUE_STATUS_BADGE_CLASS[status] || "bg-warning/15 text-warning border-warning/25";

  if (findings.length === 0) {
    return (
      <div className="cyber-card p-0">
        <div className="p-12 text-center">
          <CheckCircle className="w-16 h-16 text-primary dark:text-emerald-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2 uppercase">未发现问题</h3>
          <p className="text-sm text-muted-foreground font-sans">深度审计完成，没有发现任何安全漏洞</p>
        </div>
      </div>
    );
  }

  return (
    <div className="cyber-card p-0">
      {/* 筛选栏 */}
      <div className="flex items-center gap-3 p-4 border-b border-border flex-wrap">
        <div className="relative flex-1 min-w-[180px] max-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            value={nameFilter}
            onChange={e => setNameFilter(e.target.value)}
            placeholder="搜索问题名称"
            className="h-8 text-sm !pl-9"
          />
        </div>
        <Select value={severityFilter} onValueChange={setSeverityFilter}>
          <SelectTrigger className="cyber-input h-8 w-[120px] text-sm">
            <SelectValue placeholder="全部程度" />
          </SelectTrigger>
          <SelectContent className="cyber-dialog border-border">
            <SelectItem value="all">全部程度</SelectItem>
            <SelectItem value="critical">严重 ({findings.filter(f => f.severity === 'critical').length})</SelectItem>
            <SelectItem value="high">高 ({findings.filter(f => f.severity === 'high').length})</SelectItem>
            <SelectItem value="medium">中 ({findings.filter(f => f.severity === 'medium').length})</SelectItem>
            <SelectItem value="low">低 ({findings.filter(f => f.severity === 'low').length})</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="cyber-input h-8 w-[120px] text-sm">
            <SelectValue placeholder="全部状态" />
          </SelectTrigger>
          <SelectContent className="cyber-dialog border-border">
            <SelectItem value="all">全部状态</SelectItem>
            {Object.entries(
              findings.reduce((acc: Record<string, number>, f) => {
                const key = f.status || 'not_fixed';
                acc[key] = (acc[key] || 0) + 1;
                return acc;
              }, {})
            ).map(([key, count]) => (
              <SelectItem key={key} value={key}>
                {ISSUE_STATUS_LABELS[key] || key} ({count})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* 表格 */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th className="text-left py-2 px-6 font-medium">问题名称</th>
              <th className="text-left py-2 px-3 font-medium">严重程度</th>
              <th className="text-left py-2 px-3 font-medium">漏洞类型</th>
              <th className="text-left py-2 px-3 font-medium">文件路径</th>
              <th className="text-left py-2 px-3 font-medium">状态</th>
              <th className="text-left py-2 px-3 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {filteredFindings.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-muted-foreground">
                  无匹配问题
                </td>
              </tr>
            ) : (
              filteredFindings.map((finding, index) => (
                <tr
                  key={finding.id || index}
                  className="border-b border-border/50 hover:bg-muted/50 transition-colors"
                >
                  <td className="py-2.5 px-6">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">{finding.title}</span>
                      {finding.is_verified && (
                        <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30 text-[10px]">
                          已验证
                        </Badge>
                      )}
                    </div>
                  </td>
                  <td className="py-2.5 px-3">{getSeverityBadge(finding.severity)}</td>
                  <td className="py-2.5 px-3">
                    <span className="text-xs text-muted-foreground">
                      {VULN_TYPE_LABELS[finding.vulnerability_type] || finding.vulnerability_type || "-"}
                    </span>
                  </td>
                  <td className="py-2.5 px-3">
                    {(() => {
                      // 优先使用 file_path，如果为空则从 title 中提取
                      const filePath = finding.file_path || extractFilePathFromTitle(finding.title);
                      if (filePath) {
                        return (
                          <span className="text-muted-foreground text-xs bg-muted px-2 py-0.5 rounded border border-border">
                            {filePath}
                            {finding.line_start ? `:${finding.line_start}` : ""}
                          </span>
                        );
                      }
                      return <span className="text-muted-foreground text-xs">-</span>;
                    })()}
                  </td>
                  <td className="py-2.5 px-3">
                    {onStatusChange ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm" className={`text-xs font-sans border w-[60px] h-[26px] justify-center ${getStatusBadgeClass(finding.status)}`}>
                            {getStatusLabel(finding.status)}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => onStatusChange(finding, ISSUE_STATUS.FIXED)}>已修复</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onStatusChange(finding, ISSUE_STATUS.NOT_FIXED)}>未修复</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onStatusChange(finding, ISSUE_STATUS.FALSE_POSITIVE)}>误报</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onStatusChange(finding, ISSUE_STATUS.SUSPICIOUS)}>存疑</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : (
                      <span className={`text-xs border px-2 py-1 rounded w-[52px] h-[22px] inline-flex justify-center items-center ${getStatusBadgeClass(finding.status)}`}>
                        {getStatusLabel(finding.status)}
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 px-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="hover:bg-primary/12 hover:text-primary h-7"
                      onClick={() => onViewDetail?.(finding)}
                    >
                      <FileText className="w-3.5 h-3.5 mr-1" />
                      查看详情
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-center py-3 border-t border-border">
        <span className="text-xs text-muted-foreground">
          {filteredFindings.length === findings.length
            ? `共发现 ${findings.length} 个问题`
            : `显示 ${filteredFindings.length} / ${findings.length} 个问题`}
        </span>
      </div>
    </div>
  );
});

export default FindingsTable;
