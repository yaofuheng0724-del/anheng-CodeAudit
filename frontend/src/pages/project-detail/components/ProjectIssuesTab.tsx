import { useState, useMemo } from "react";
import { FileText, Shield, Search, Sparkles, Loader2, CheckCircle, ChevronDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { IssuesSummary, LatestProblem, AggregatedAuditIssue, AggregatedAgentFinding } from "@/shared/types";
import { ISSUE_STATUS_LABELS, ISSUE_STATUS_BADGE_CLASS, ISSUE_STATUS } from "@/shared/constants";
import IssueDetailSheet from "@/components/issues/IssueDetailSheet";

function getStatusLabel(status?: string): string {
  if (!status) return "未修复";
  return ISSUE_STATUS_LABELS[status] || status;
}

function getStatusBadgeClass(status?: string): string {
  return ISSUE_STATUS_BADGE_CLASS[status || "not_fixed"] || "bg-warning/15 text-warning dark:text-warning border-warning/25";
}

// 检查问题是否已有AI排查结果
function hasAiSuggestion(problem: LatestProblem): boolean {
  return !!problem.ai_suggestion;
}

// 检查问题是否正在AI排查中
function isAiAnalyzing(problem: LatestProblem): boolean {
  if (!problem.ai_suggestion) return false;
  try {
    const data = JSON.parse(problem.ai_suggestion);
    return data.verdict === "analyzing";
  } catch {
    return false;
  }
}

export function ProjectIssuesTab(props: {
  hasAnyTasks: boolean;
  issuesSummary: IssuesSummary;
  loading: boolean;
  latestProblems: LatestProblem[];
  latestIssues: AggregatedAuditIssue[];
  latestFindings: AggregatedAgentFinding[];
  formatDate: (dateString: string) => string;
  onStatusChange?: (problem: LatestProblem, newStatus: string) => void;
  onAiInvestigate?: (problem: LatestProblem) => void;
  onBatchAiInvestigate?: () => void;
  aiBatchProgress?: { completed: number; total: number; inProgress: boolean };
}) {
  const {
    loading, latestProblems, latestIssues, latestFindings, formatDate,
    onStatusChange, onAiInvestigate, onBatchAiInvestigate, aiBatchProgress,
  } = props;

  // 筛选状态
  const [searchTerm, setSearchTerm] = useState("");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [displayCount, setDisplayCount] = useState(20);

  // 详情 Sheet
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedAuditIssue, setSelectedAuditIssue] = useState<AggregatedAuditIssue | undefined>(undefined);
  const [selectedAgentFinding, setSelectedAgentFinding] = useState<AggregatedAgentFinding | undefined>(undefined);

  const handleViewDetail = (problem: LatestProblem) => {
    if (problem.kind === "audit") {
      const full = latestIssues.find((i) => i.id === problem.id);
      setSelectedAuditIssue(full);
      setSelectedAgentFinding(undefined);
    } else {
      const full = latestFindings.find((f) => f.id === problem.id);
      setSelectedAgentFinding(full);
      setSelectedAuditIssue(undefined);
    }
    setDetailOpen(true);
  };

  // 筛选后的问题列表
  const filteredProblems = useMemo(() => {
    return latestProblems.filter((issue) => {
      // 问题名称搜索
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchTitle = issue.title?.toLowerCase().includes(term);
        const matchPath = issue.file_path?.toLowerCase().includes(term);
        if (!matchTitle && !matchPath) return false;
      }
      // 严重程度筛选
      if (severityFilter !== "all" && issue.severity !== severityFilter) return false;
      // 处理状态筛选
      if (statusFilter !== "all") {
        const currentStatus = issue.status || "not_fixed";
        if (currentStatus !== statusFilter) return false;
      }
      return true;
    });
  }, [latestProblems, searchTerm, severityFilter, statusFilter]);

  // 分页显示
  const displayedProblems = useMemo(() => {
    return filteredProblems.slice(0, displayCount);
  }, [filteredProblems, displayCount]);

  const hasMore = filteredProblems.length > displayCount;

  // 筛选条件变化时重置分页
  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    setDisplayCount(20);
  };
  const handleSeverityChange = (value: string) => {
    setSeverityFilter(value);
    setDisplayCount(20);
  };
  const handleStatusChange = (value: string) => {
    setStatusFilter(value);
    setDisplayCount(20);
  };

  if (loading) {
    return (
      <div className="cyber-card p-12 text-center">
        <div className="loading-spinner mx-auto mb-4"></div>
        <p className="text-muted-foreground font-sans">正在加载问题列表...</p>
      </div>
    );
  }

  return (
    <>
      <div className="cyber-card p-0">
        {latestProblems.length > 0 ? (
          <>
            {/* 筛选栏 */}
            <div className="p-4 flex items-center gap-3 border-b border-border flex-wrap">
              <div className="relative flex-1 min-w-[180px] max-w-[240px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <Input
                  value={searchTerm}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  placeholder="搜索问题名称"
                  className="h-8 text-sm !pl-9"
                />
              </div>
              <Select value={severityFilter} onValueChange={handleSeverityChange}>
                <SelectTrigger className="cyber-input h-8 w-[120px] text-sm">
                  <SelectValue placeholder="严重程度" />
                </SelectTrigger>
                <SelectContent className="cyber-dialog border-border">
                  <SelectItem value="all">全部程度</SelectItem>
                  <SelectItem value="critical">严重</SelectItem>
                  <SelectItem value="high">高</SelectItem>
                  <SelectItem value="medium">中等</SelectItem>
                  <SelectItem value="low">低</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={handleStatusChange}>
                <SelectTrigger className="cyber-input h-8 w-[120px] text-sm">
                  <SelectValue placeholder="处理状态" />
                </SelectTrigger>
                <SelectContent className="cyber-dialog border-border">
                  <SelectItem value="all">全部状态</SelectItem>
                  <SelectItem value="not_fixed">未修复</SelectItem>
                  <SelectItem value="fixed">已修复</SelectItem>
                  <SelectItem value="false_positive">误报</SelectItem>
                  <SelectItem value="suspicious">存疑</SelectItem>
                </SelectContent>
              </Select>
              {/* 批量AI排查按钮 */}
              {onBatchAiInvestigate && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-sm border-purple-500/30 hover:bg-purple-500/12 hover:text-purple-500 hover:border-purple-500/50"
                  disabled={aiBatchProgress?.inProgress}
                  onClick={onBatchAiInvestigate}
                >
                  <Sparkles className="w-3.5 h-3.5 mr-1" />
                  {aiBatchProgress?.inProgress
                    ? `排查中 (${aiBatchProgress.completed}/${aiBatchProgress.total})`
                    : '批量AI排查'}
                </Button>
              )}
              {(searchTerm || severityFilter !== "all" || statusFilter !== "all") && (
                <span className="text-xs text-muted-foreground">
                  {filteredProblems.length} / {latestProblems.length}
                </span>
              )}
            </div>

            {/* 问题列表 */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="text-left py-2 px-6 font-medium">问题名称</th>
                    <th className="text-left py-2 px-3 font-medium">严重程度</th>
                    <th className="text-left py-2 px-3 font-medium">文件路径</th>
                    <th className="text-left py-2 px-3 font-medium">状态</th>
                    <th className="text-left py-2 px-3 font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedProblems.length > 0 ? (
                    displayedProblems.map((issue, index) => (
                      <tr key={index} className="border-b border-border/50 hover:bg-muted/50 transition-colors">
                        <td className="py-2.5 px-6">
                          <span className="font-medium text-foreground">{issue.title}</span>
                        </td>
                        <td className="py-2.5 px-3">
                          <Badge
                            className={`
                              ${issue.severity === "critical"
                                ? "severity-critical"
                                : issue.severity === "high"
                                  ? "severity-high"
                                  : issue.severity === "medium"
                                    ? "severity-medium"
                                    : "severity-low"}
                              font-bold uppercase px-2 py-1 rounded text-xs inline-flex justify-center min-w-[56px] text-center
                            `}
                          >
                            {issue.severity === "critical" ? "严重" : issue.severity === "high" ? "高" : issue.severity === "medium" ? "中" : "低"}
                          </Badge>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="text-muted-foreground text-xs bg-muted px-2 py-0.5 rounded border border-border">
                            {issue.file_path || "-"}
                            {issue.line_number != null
                              ? issue.line_end != null && issue.line_end !== issue.line_number
                                ? `:${issue.line_number}-${issue.line_end}`
                                : `:${issue.line_number}`
                              : ""}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          {onStatusChange ? (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm" className={`text-xs font-sans border h-7 ${getStatusBadgeClass(issue.status)}`}>
                                  {getStatusLabel(issue.status)}
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => onStatusChange(issue, ISSUE_STATUS.FIXED)}>已修复</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => onStatusChange(issue, ISSUE_STATUS.NOT_FIXED)}>未修复</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => onStatusChange(issue, ISSUE_STATUS.FALSE_POSITIVE)}>误报</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => onStatusChange(issue, ISSUE_STATUS.SUSPICIOUS)}>存疑</DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          ) : (
                            <span className="text-xs">{getStatusLabel(issue.status)}</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 flex items-center gap-1">
                          {/* AI排查按钮 */}
                          {onAiInvestigate && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className={`h-7 ${hasAiSuggestion(issue)
                                ? 'text-muted-foreground cursor-not-allowed'
                                : isAiAnalyzing(issue)
                                  ? 'text-purple-500'
                                  : 'hover:bg-purple-500/12 hover:text-purple-500'}`}
                              disabled={hasAiSuggestion(issue) && !isAiAnalyzing(issue)}
                              onClick={() => onAiInvestigate(issue)}
                            >
                              {isAiAnalyzing(issue) ? (
                                <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                              ) : hasAiSuggestion(issue) ? (
                                <CheckCircle className="w-3.5 h-3.5 mr-1" />
                              ) : (
                                <Sparkles className="w-3.5 h-3.5 mr-1" />
                              )}
                              {isAiAnalyzing(issue) ? '排查中' : hasAiSuggestion(issue) ? '已排查' : 'AI排查'}
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="hover:bg-primary/12 hover:text-primary h-7"
                            onClick={() => handleViewDetail(issue)}
                          >
                            <FileText className="w-3.5 h-3.5 mr-1" />
                            查看详情
                          </Button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-muted-foreground">
                        无匹配的问题
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {/* 分页加载更多 */}
            {hasMore && (
              <div className="flex items-center justify-center py-4 border-t border-border">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-sm gap-1 border-border hover:bg-primary/10 hover:text-primary"
                  onClick={() => setDisplayCount(prev => prev + 20)}
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                  加载更多 (还有 {filteredProblems.length - displayCount} 条)
                </Button>
              </div>
            )}
            {!hasMore && filteredProblems.length > 0 && (
              <div className="flex items-center justify-center py-3 border-t border-border">
                <span className="text-xs text-muted-foreground">已加载全部 {filteredProblems.length} 条问题</span>
              </div>
            )}
          </>
        ) : (
          <div className="p-12 text-center">
            <Shield className="w-16 h-16 text-primary/40 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2 uppercase">未发现问题</h3>
            <p className="text-sm text-muted-foreground font-sans">该项目暂未发现安全问题，或尚未进行审计。</p>
          </div>
        )}
      </div>

      {/* 问题详情 Sheet */}
      <IssueDetailSheet
        open={detailOpen}
        onOpenChange={setDetailOpen}
        auditIssue={selectedAuditIssue}
        agentFinding={selectedAgentFinding}
      />
    </>
  );
}