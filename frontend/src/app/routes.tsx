import Dashboard from "@/pages/Dashboard/index";
import Projects from "@/pages/Projects";
import ProjectDetail from "@/pages/ProjectDetail";
import RecycleBin from "@/pages/RecycleBin";
import InstantAnalysis from "@/pages/InstantAnalysis";
import AuditTasks from "@/pages/AuditTasks";
import TaskDetail from "@/pages/TaskDetail";
import AgentAudit from "@/pages/AgentAudit";
import AdminDashboard from "@/pages/AdminDashboard";
import Account from "@/pages/Account";
import AuditRules from "@/pages/AuditRules";
import PromptManager from "@/pages/PromptManager";
import ScheduleManager from "@/pages/ScheduleManager";
import VulnerabilityManager from "@/pages/VulnerabilityManager";
import { AGENT_AUDIT_ROUTE, CONSOLE_HOME_ROUTE } from "@/shared/constants/branding";
import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";

export interface RouteConfig {
  name: string;
  path: string;
  element: ReactNode;
  visible?: boolean;
}

const routes: RouteConfig[] = [
  {
    name: "控制台首页",
    path: "/",
    element: <Navigate to={CONSOLE_HOME_ROUTE} replace />,
    visible: false,
  },
  {
    name: "深度审计",
    path: AGENT_AUDIT_ROUTE,
    element: <AgentAudit />,
    visible: false,
  },
  {
    name: "深度审计任务",
    path: "/agent-audit/:taskId",
    element: <AgentAudit />,
    visible: false,
  },
  {
    name: "数据可视",
    path: CONSOLE_HOME_ROUTE,
    element: <Dashboard />,
    visible: true,
  },
  {
    name: "项目管理",
    path: "/projects",
    element: <Projects />,
    visible: true,
  },
  {
    name: "项目详情",
    path: "/projects/:id",
    element: <ProjectDetail />,
    visible: false,
  },
  {
    name: "即时分析",
    path: "/instant-analysis",
    element: <InstantAnalysis />,
    visible: false,
  },
  {
    name: "任务管理",
    path: "/audit-tasks",
    element: <AuditTasks />,
    visible: true,
  },
  {
    name: "任务详情",
    path: "/tasks/:id",
    element: <TaskDetail />,
    visible: false,
  },
  {
    name: "规则管理",
    path: "/audit-rules",
    element: <AuditRules />,
    visible: true,
  },
  {
    name: "漏洞管理",
    path: "/vulnerabilities",
    element: <VulnerabilityManager />,
    visible: false,
  },
  {
    name: "计划任务",
    path: "/schedules",
    element: <ScheduleManager />,
    visible: false,
  },
  {
    name: "提示词管理",
    path: "/prompts",
    element: <PromptManager />,
    visible: false,
  },
  {
    name: "系统管理",
    path: "/admin",
    element: <AdminDashboard />,
    visible: true,
  },
  {
    name: "回收站",
    path: "/recycle-bin",
    element: <RecycleBin />,
    visible: false,
  },
  {
    name: "账号管理",
    path: "/account",
    element: <Account />,
    visible: false, // 不在主导航显示，在侧边栏底部单独显示
  },
];

export default routes;
