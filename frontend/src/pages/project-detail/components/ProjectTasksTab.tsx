import { Link } from "react-router-dom";
import { FileText, FolderOpen } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { AuditTask } from "@/shared/types";
import type { UnifiedTask } from "@/shared/types";

export function ProjectTasksTab(props: {
  unifiedTasks: UnifiedTask[];
  onCreateTask: () => void;
  formatDate: (dateString: string) => string;
  renderStatusBadge: (status: string) => React.ReactNode;
  renderStatusIcon: (status: string) => React.ReactNode;
}) {
  const { unifiedTasks, formatDate, renderStatusBadge } = props;

  return (
    <div className="cyber-card p-0">
      {unifiedTasks.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="text-left py-2 px-6 font-medium">任务类型</th>
                <th className="text-left py-2 px-3 font-medium">文件数</th>
                <th className="text-left py-2 px-3 font-medium">问题数</th>
                <th className="text-left py-2 px-3 font-medium">任务状态</th>
                <th className="text-left py-2 px-3 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {unifiedTasks.map((wrappedTask) => {
                const isAuditTask = wrappedTask.kind === "audit";
                const task: any = wrappedTask.task as any;

                const taskType = isAuditTask
                  ? ((task as AuditTask).task_type === "repository" ? "审计任务" : "即时分析任务")
                  : "深度审计任务";
                const totalFiles = task.total_files ?? 0;
                const issueCount = isAuditTask ? (task.issues_count ?? 0) : (task.findings_count ?? 0);

                return (
                  <tr key={`${wrappedTask.kind}:${task.id}`} className="border-b border-border/50 hover:bg-muted/50 transition-colors">
                    <td className="py-2.5 px-6">
                      <span className="font-medium text-foreground">{taskType}</span>
                      <Badge className={`ml-2 ${wrappedTask.kind === "agent" ? "cyber-badge-info" : "cyber-badge-muted"}`}>
                        {wrappedTask.kind === "agent" ? "AGENT" : "AUDIT"}
                      </Badge>
                    </td>
                    <td className="py-2.5 px-3 text-muted-foreground">{totalFiles}</td>
                    <td className="py-2.5 px-3">
                      <span className={issueCount > 0 ? "text-warning font-bold" : "text-muted-foreground"}>
                        {issueCount}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">{renderStatusBadge(task.status)}</td>
                    <td className="py-2.5 px-3">
                      <Link to={isAuditTask ? `/tasks/${task.id}` : `/agent-audit/${task.id}`}>
                        <Button variant="ghost" size="sm" className="hover:bg-primary/12 hover:text-primary h-7">
                          <FileText className="w-3.5 h-3.5 mr-1" />
                          查看详情
                        </Button>
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="p-12 text-center">
          <FolderOpen className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2 uppercase">暂无审计任务</h3>
          <p className="text-sm text-muted-foreground mb-6 font-sans">该项目尚未创建审计任务</p>
        </div>
      )}
    </div>
  );
}