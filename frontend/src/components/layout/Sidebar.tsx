/**
 * TopNav Component
 * Horizontal navigation bar at the top of the page
 */

import { useState, useRef, useEffect, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Menu,
  X,
  BarChart3,
  Layers,
  Zap,
  ClipboardList,
  Scale,
  Sparkles,
  Settings,
  Trash2,
  User,
  BriefcaseBusiness,
  ChevronDown,
  Bot,
  FileSearch,
  Wrench,
  Shield,
  Users,
  BookOpen,
  Bug,
  Container,
} from "lucide-react";
import routes from "@/app/routes";
import { useAuth } from "@/shared/context/AuthContext";
import {
  BRAND_COMPANY_NAME,
  BRAND_LOGO_PATH,
  BRAND_NAME,
  CONSOLE_HOME_ROUTE,
} from "@/shared/constants/branding";

const routeIcons: Record<string, ReactNode> = {
  "/dashboard": <BarChart3 className="h-[18px] w-[18px]" />,
  "/projects": <Layers className="h-[18px] w-[18px]" />,
  "/instant-analysis": <Zap className="h-[18px] w-[18px]" />,
  "/audit-tasks": <ClipboardList className="h-[18px] w-[18px]" />,
  "/audit-rules": <Scale className="h-[18px] w-[18px]" />,
  "/vulnerabilities": <Bug className="h-[18px] w-[18px]" />,
  "/prompts": <Sparkles className="h-[18px] w-[18px]" />,
  "/admin": <Settings className="h-[18px] w-[18px]" />,
  "/recycle-bin": <Trash2 className="h-[18px] w-[18px]" />,
};

const auditSubItems = [
  { path: "/audit-tasks?tab=regular", name: "快速审计", icon: <FileSearch className="h-[18px] w-[18px]" /> },
  { path: "/audit-tasks?tab=agent", name: "深度审计", icon: <Bot className="h-[18px] w-[18px]" /> },
  { path: "/audit-tasks?tab=iac", name: "IaC扫描", icon: <Container className="h-[18px] w-[18px]" /> },
];

const rulesSubItems = [
  { path: "/audit-rules?tab=static", name: "静态规则", icon: <Shield className="h-[18px] w-[18px]" /> },
  { path: "/audit-rules?tab=ai", name: "AI规则", icon: <Sparkles className="h-[18px] w-[18px]" /> },
];

const systemSubItems = [
  { path: "/admin?tab=users", name: "用户管理", icon: <Users className="h-[18px] w-[18px]" /> },
  { path: "/admin?tab=config", name: "配置管理", icon: <Wrench className="h-[18px] w-[18px]" /> },
];

export default function Sidebar() {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 });
  const dropdownRef = useRef<HTMLDivElement>(null);
  const dropdownPanelRef = useRef<HTMLDivElement>(null);
  const [rulesDropdownOpen, setRulesDropdownOpen] = useState(false);
  const [rulesDropdownPos, setRulesDropdownPos] = useState({ top: 0, left: 0, width: 0 });
  const rulesDropdownRef = useRef<HTMLDivElement>(null);
  const rulesDropdownPanelRef = useRef<HTMLDivElement>(null);
  const [systemDropdownOpen, setSystemDropdownOpen] = useState(false);
  const [systemDropdownPos, setSystemDropdownPos] = useState({ top: 0, left: 0, width: 0 });
  const systemDropdownRef = useRef<HTMLDivElement>(null);
  const systemDropdownPanelRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (
        dropdownRef.current && !dropdownRef.current.contains(target) &&
        dropdownPanelRef.current && !dropdownPanelRef.current.contains(target)
      ) {
        setDropdownOpen(false);
      }
      if (
        rulesDropdownRef.current && !rulesDropdownRef.current.contains(target) &&
        rulesDropdownPanelRef.current && !rulesDropdownPanelRef.current.contains(target)
      ) {
        setRulesDropdownOpen(false);
      }
      if (
        systemDropdownRef.current && !systemDropdownRef.current.contains(target) &&
        systemDropdownPanelRef.current && !systemDropdownPanelRef.current.contains(target)
      ) {
        setSystemDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const visibleRoutes = routes.filter((route) => {
    if (route.visible === false) return false;
    if (route.path === "/admin" && user?.role !== "admin") return false;
    return true;
  });

  const isAuditGroupActive = location.pathname === "/audit-tasks" || location.pathname === "/instant-analysis";
  const isRulesGroupActive = location.pathname === "/audit-rules";
  const isSystemGroupActive = location.pathname === "/admin";

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-[#E0E7FF] bg-[#F5F3FF] shadow-[0_2px_12px_rgba(99,102,241,0.06)]">
        {/* Desktop nav */}
        <div className="hidden md:flex md:h-14 md:items-center md:px-5">
          <Link to={CONSOLE_HOME_ROUTE} className="flex items-center gap-3 shrink-0 mr-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center">
              <img src={BRAND_LOGO_PATH} alt={BRAND_COMPANY_NAME} className="h-9 w-9 object-contain" />
            </div>
            <div className="truncate text-sm font-semibold tracking-[0.02em] text-[#1E1B4B]">
              {BRAND_NAME}
            </div>
          </Link>

          <nav className="flex items-center gap-1 ml-6 flex-1 overflow-x-auto">
            {visibleRoutes.map((route) => {
              if (route.path === "/audit-tasks") {
                const currentSubName = location.search === "?tab=agent" ? "深度审计" : "快速审计";
                return (
                  <div key={route.path} ref={dropdownRef} className="relative">
                    <button
                      className={`group flex items-center gap-2 rounded-md px-3 py-2 transition-all duration-200 whitespace-nowrap ${
                        isAuditGroupActive
                          ? "bg-[#E0E7FF] text-[#6366F1] shadow-[0_2px_8px_rgba(99,102,241,0.10)] ring-1 ring-[#C7D2FE]/60"
                          : "text-[#374151] hover:bg-white hover:text-[#1E1B4B]"
                      }`}
                      onClick={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        setDropdownPos({ top: rect.bottom + 4, left: rect.left, width: rect.width });
                        setDropdownOpen(!dropdownOpen);
                      }}
                    >
                      <span
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded transition-colors ${
                          isAuditGroupActive
                            ? "text-[#6366F1]"
                            : "text-[#6B7280] group-hover:text-[#6366F1]"
                        }`}
                      >
                        {routeIcons[route.path] || <BriefcaseBusiness className="h-[18px] w-[18px]" />}
                      </span>
                      <span className={`text-sm ${isAuditGroupActive ? "font-semibold tracking-[0.01em]" : "font-medium"}`}>
                        任务管理
                      </span>
                      <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${dropdownOpen ? "rotate-180" : ""}`} />
                    </button>

                    </div>
                );
              }

              if (route.path === "/audit-rules") {
                return (
                  <div key={route.path} ref={rulesDropdownRef} className="relative">
                    <button
                      className={`group flex items-center gap-2 rounded-md px-3 py-2 transition-all duration-200 whitespace-nowrap ${
                        isRulesGroupActive
                          ? "bg-[#E0E7FF] text-[#6366F1] shadow-[0_2px_8px_rgba(99,102,241,0.10)] ring-1 ring-[#C7D2FE]/60"
                          : "text-[#374151] hover:bg-white hover:text-[#1E1B4B]"
                      }`}
                      onClick={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        setRulesDropdownPos({ top: rect.bottom + 4, left: rect.left, width: rect.width });
                        setRulesDropdownOpen(!rulesDropdownOpen);
                      }}
                    >
                      <span
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded transition-colors ${
                          isRulesGroupActive
                            ? "text-[#6366F1]"
                            : "text-[#6B7280] group-hover:text-[#6366F1]"
                        }`}
                      >
                        {routeIcons[route.path] || <BriefcaseBusiness className="h-[18px] w-[18px]" />}
                      </span>
                      <span className={`text-sm ${isRulesGroupActive ? "font-semibold tracking-[0.01em]" : "font-medium"}`}>
                        规则管理
                      </span>
                      <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${rulesDropdownOpen ? "rotate-180" : ""}`} />
                    </button>
                  </div>
                );
              }

              if (route.path === "/admin") {
                return (
                  <div key={route.path} ref={systemDropdownRef} className="relative">
                    <button
                      className={`group flex items-center gap-2 rounded-md px-3 py-2 transition-all duration-200 whitespace-nowrap ${
                        isSystemGroupActive
                          ? "bg-[#E0E7FF] text-[#6366F1] shadow-[0_2px_8px_rgba(99,102,241,0.10)] ring-1 ring-[#C7D2FE]/60"
                          : "text-[#374151] hover:bg-white hover:text-[#1E1B4B]"
                      }`}
                      onClick={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        setSystemDropdownPos({ top: rect.bottom + 4, left: rect.left, width: rect.width });
                        setSystemDropdownOpen(!systemDropdownOpen);
                      }}
                    >
                      <span
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded transition-colors ${
                          isSystemGroupActive
                            ? "text-[#6366F1]"
                            : "text-[#6B7280] group-hover:text-[#6366F1]"
                        }`}
                      >
                        {routeIcons[route.path] || <BriefcaseBusiness className="h-[18px] w-[18px]" />}
                      </span>
                      <span className={`text-sm ${isSystemGroupActive ? "font-semibold tracking-[0.01em]" : "font-medium"}`}>
                        系统管理
                      </span>
                      <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${systemDropdownOpen ? "rotate-180" : ""}`} />
                    </button>
                  </div>
                );
              }

              const isActive =
                location.pathname === route.path ||
                (route.path !== "/" && location.pathname.startsWith(route.path));

              return (
                <Link
                  key={route.path}
                  to={route.path}
                  className={`group flex items-center gap-2 rounded-md px-3 py-2 transition-all duration-200 whitespace-nowrap ${
                    isActive
                      ? "bg-[#E0E7FF] text-[#6366F1] shadow-[0_2px_8px_rgba(99,102,241,0.10)] ring-1 ring-[#C7D2FE]/60"
                      : "text-[#374151] hover:bg-white hover:text-[#1E1B4B]"
                  }`}
                >
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded transition-colors ${
                      isActive
                        ? "text-[#6366F1]"
                        : "text-[#6B7280] group-hover:text-[#6366F1]"
                    }`}
                  >
                    {routeIcons[route.path] || <BriefcaseBusiness className="h-[18px] w-[18px]" />}
                  </span>
                  <span className={`text-sm ${isActive ? "font-semibold tracking-[0.01em]" : "font-medium"}`}>
                    {route.name}
                  </span>
                </Link>
              );
            })}
          </nav>

          <Link
            to="/account"
            className={`group flex items-center gap-2 rounded-md px-3 py-2 transition-all shrink-0 ${
              location.pathname === "/account"
                ? "bg-[#E0E7FF] text-[#6366F1] ring-1 ring-[#C7D2FE]/60"
                : "text-[#374151] hover:bg-white hover:text-[#1E1B4B]"
            }`}
          >
            <span
              className={`flex h-7 w-7 items-center justify-center rounded ${
                location.pathname === "/account"
                  ? "text-[#6366F1]"
                  : "text-[#6B7280]"
              }`}
            >
              <User className="h-[18px] w-[18px]" />
            </span>
            <span className="text-sm font-medium">{user?.username || "账号"}</span>
          </Link>
        </div>

        {/* Mobile nav */}
        <div className="flex h-14 items-center justify-between px-4 md:hidden">
          <Link to={CONSOLE_HOME_ROUTE} className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center">
              <img src={BRAND_LOGO_PATH} alt={BRAND_COMPANY_NAME} className="h-9 w-9 object-contain" />
            </div>
            <div className="truncate text-sm font-semibold tracking-[0.02em] text-[#1E1B4B]">
              {BRAND_NAME}
            </div>
          </Link>
          <Button
            variant="outline"
            size="icon"
            className="border-primary/30 bg-white text-primary shadow-lg"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>

        {/* Mobile dropdown */}
        {mobileOpen && (
          <div className="border-t border-[#E0E7FF] bg-[#F5F3FF] px-4 py-3 md:hidden">
            <nav className="flex flex-col gap-1">
              {visibleRoutes.map((route) => {
                if (route.path === "/audit-tasks") {
                  return (
                    <div key={route.path}>
                      <div className="flex items-center gap-3 rounded-md px-3 py-2.5 text-[#374151]">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded text-[#6B7280]">
                          {routeIcons[route.path] || <BriefcaseBusiness className="h-[18px] w-[18px]" />}
                        </span>
                        <span className="text-sm font-medium">{route.name}</span>
                      </div>
                      {auditSubItems.map((item) => {
                        const isActive =
                          (location.pathname === "/audit-tasks" &&
                          (location.search === item.path.replace("/audit-tasks", "") ||
                            (item.path.includes("tab=regular") && !location.search)));
                        return (
                          <Link
                            key={item.path}
                            to={item.path}
                            className={`flex items-center gap-3 rounded-md px-3 py-2 pl-12 transition-all duration-200 ${
                              isActive
                                ? "bg-[#E0E7FF] text-[#6366F1] ring-1 ring-[#C7D2FE]/60"
                                : "text-[#374151] hover:bg-white hover:text-[#1E1B4B]"
                            }`}
                            onClick={() => setMobileOpen(false)}
                          >
                            <span className={`flex h-7 w-7 items-center justify-center rounded ${
                              isActive ? "text-[#6366F1]" : "text-[#6B7280]"
                            }`}>
                              {item.icon}
                            </span>
                            <span className={`text-sm ${isActive ? "font-semibold" : "font-medium"}`}>
                              {item.name}
                            </span>
                          </Link>
                        );
                      })}
                    </div>
                  );
                }

                if (route.path === "/audit-rules") {
                  return (
                    <div key={route.path}>
                      <div className="flex items-center gap-3 rounded-md px-3 py-2.5 text-[#374151]">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded text-[#6B7280]">
                          {routeIcons[route.path] || <BriefcaseBusiness className="h-[18px] w-[18px]" />}
                        </span>
                        <span className="text-sm font-medium">规则管理</span>
                      </div>
                      {rulesSubItems.map((item) => {
                        const isActive =
                          (location.pathname === "/audit-rules" &&
                          location.search === item.path.replace("/audit-rules", "")) ||
                          (item.path.includes("tab=static") && location.pathname === "/audit-rules" && !location.search);
                        return (
                          <Link
                            key={item.path}
                            to={item.path}
                            className={`flex items-center gap-3 rounded-md px-3 py-2 pl-12 transition-all duration-200 ${
                              isActive
                                ? "bg-[#E0E7FF] text-[#6366F1] ring-1 ring-[#C7D2FE]/60"
                                : "text-[#374151] hover:bg-white hover:text-[#1E1B4B]"
                            }`}
                            onClick={() => setMobileOpen(false)}
                          >
                            <span className={`flex h-7 w-7 items-center justify-center rounded ${
                              isActive ? "text-[#6366F1]" : "text-[#6B7280]"
                            }`}>
                              {item.icon}
                            </span>
                            <span className={`text-sm ${isActive ? "font-semibold" : "font-medium"}`}>
                              {item.name}
                            </span>
                          </Link>
                        );
                      })}
                    </div>
                  );
                }

                if (route.path === "/admin") {
                  return (
                    <div key={route.path}>
                      <div className="flex items-center gap-3 rounded-md px-3 py-2.5 text-[#374151]">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded text-[#6B7280]">
                          {routeIcons[route.path] || <BriefcaseBusiness className="h-[18px] w-[18px]" />}
                        </span>
                        <span className="text-sm font-medium">系统管理</span>
                      </div>
                      {systemSubItems.map((item) => {
                        const isActive =
                          location.pathname === "/admin" &&
                          location.search === item.path.replace("/admin", "");
                        return (
                          <Link
                            key={item.path}
                            to={item.path}
                            className={`flex items-center gap-3 rounded-md px-3 py-2 pl-12 transition-all duration-200 ${
                              isActive
                                ? "bg-[#E0E7FF] text-[#6366F1] ring-1 ring-[#C7D2FE]/60"
                                : "text-[#374151] hover:bg-white hover:text-[#1E1B4B]"
                            }`}
                            onClick={() => setMobileOpen(false)}
                          >
                            <span className={`flex h-7 w-7 items-center justify-center rounded ${
                              isActive ? "text-[#6366F1]" : "text-[#6B7280]"
                            }`}>
                              {item.icon}
                            </span>
                            <span className={`text-sm ${isActive ? "font-semibold" : "font-medium"}`}>
                              {item.name}
                            </span>
                          </Link>
                        );
                      })}
                    </div>
                  );
                }

                return (
                  <Link
                    key={route.path}
                    to={route.path}
                    className={`group flex items-center gap-3 rounded-md px-3 py-2.5 transition-all duration-200 ${
                      isActive
                        ? "bg-[#E0E7FF] text-[#6366F1] shadow-[0_2px_8px_rgba(99,102,241,0.10)] ring-1 ring-[#C7D2FE]/60"
                        : "text-[#374151] hover:bg-white hover:text-[#1E1B4B]"
                    }`}
                    onClick={() => setMobileOpen(false)}
                  >
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded transition-colors ${
                        isActive
                          ? "text-[#6366F1]"
                          : "text-[#6B7280] group-hover:text-[#6366F1]"
                      }`}
                    >
                      {routeIcons[route.path] || <BriefcaseBusiness className="h-[18px] w-[18px]" />}
                    </span>
                    <span className={`text-sm ${isActive ? "font-semibold tracking-[0.01em]" : "font-medium"}`}>
                      {route.name}
                    </span>
                  </Link>
                );
              })}
              <Link
                to="/account"
                className={`group flex items-center gap-3 rounded-md px-3 py-2.5 transition-all ${
                  location.pathname === "/account"
                    ? "bg-[#E0E7FF] text-[#6366F1] ring-1 ring-[#C7D2FE]/60"
                    : "text-[#374151] hover:bg-white hover:text-[#1E1B4B]"
                }`}
                onClick={() => setMobileOpen(false)}
              >
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded ${
                    location.pathname === "/account"
                      ? "text-[#6366F1]"
                      : "text-[#6B7280]"
                  }`}
                >
                  <User className="h-[18px] w-[18px]" />
                </span>
                <span className="text-sm font-medium">{user?.username || "账号"}</span>
              </Link>
            </nav>
          </div>
        )}
      </header>

      {/* Fixed dropdown panel - rendered outside header to avoid overflow clipping */}
      {dropdownOpen && (
        <div
          className="fixed z-50 rounded-lg border border-[#E0E7FF] bg-white shadow-[0_8px_24px_rgba(99,102,241,0.12)] py-1"
          ref={dropdownPanelRef}
          style={{ top: dropdownPos.top, left: dropdownPos.left, width: dropdownPos.width }}
        >
          {auditSubItems.map((item) => {
            const isActive =
              (location.pathname === "/audit-tasks" &&
              location.search === item.path.replace("/audit-tasks", "")) ||
              (item.path.includes("tab=regular") && location.pathname === "/audit-tasks" && !location.search) ||
              (item.path === "/instant-analysis" && location.pathname === "/instant-analysis");
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-2.5 transition-colors ${
                  isActive
                    ? "bg-[#E0E7FF] text-[#6366F1] font-semibold"
                    : "text-[#374151] hover:bg-[#F5F3FF] hover:text-[#1E1B4B]"
                }`}
                onClick={() => setDropdownOpen(false)}
              >
                <span className={`flex h-6 w-6 items-center justify-center rounded ${
                  isActive ? "text-[#6366F1]" : "text-[#6B7280]"
                }`}>
                  {item.icon}
                </span>
                <span className="text-sm">{item.name}</span>
              </Link>
            );
          })}
        </div>
      )}

      {/* Rules dropdown panel */}
      {rulesDropdownOpen && (
        <div
          className="fixed z-50 rounded-lg border border-[#E0E7FF] bg-white shadow-[0_8px_24px_rgba(99,102,241,0.12)] py-1"
          ref={rulesDropdownPanelRef}
          style={{ top: rulesDropdownPos.top, left: rulesDropdownPos.left, width: rulesDropdownPos.width }}
        >
          {rulesSubItems.map((item) => {
            const isActive =
              (location.pathname === "/audit-rules" &&
              location.search === item.path.replace("/audit-rules", "")) ||
              (item.path.includes("tab=static") && location.pathname === "/audit-rules" && !location.search) ||
              (item.path === "/audit-rules?tab=ai" && location.search === "?tab=ai");
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-2.5 transition-colors ${
                  isActive
                    ? "bg-[#E0E7FF] text-[#6366F1] font-semibold"
                    : "text-[#374151] hover:bg-[#F5F3FF] hover:text-[#1E1B4B]"
                }`}
                onClick={() => setRulesDropdownOpen(false)}
              >
                <span className={`flex h-6 w-6 items-center justify-center rounded ${
                  isActive ? "text-[#6366F1]" : "text-[#6B7280]"
                }`}>
                  {item.icon}
                </span>
                <span className="text-sm">{item.name}</span>
              </Link>
            );
          })}
        </div>
      )}

      {/* System dropdown panel */}
      {systemDropdownOpen && (
        <div
          className="fixed z-50 rounded-lg border border-[#E0E7FF] bg-white shadow-[0_8px_24px_rgba(99,102,241,0.12)] py-1"
          ref={systemDropdownPanelRef}
          style={{ top: systemDropdownPos.top, left: systemDropdownPos.left, width: systemDropdownPos.width }}
        >
          {systemSubItems.map((item) => {
            const isActive =
              location.pathname === "/admin" &&
              location.search === item.path.replace("/admin", "");
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-2.5 transition-colors ${
                  isActive
                    ? "bg-[#E0E7FF] text-[#6366F1] font-semibold"
                    : "text-[#374151] hover:bg-[#F5F3FF] hover:text-[#1E1B4B]"
                }`}
                onClick={() => setSystemDropdownOpen(false)}
              >
                <span className={`flex h-6 w-6 items-center justify-center rounded ${
                  isActive ? "text-[#6366F1]" : "text-[#6B7280]"
                }`}>
                  {item.icon}
                </span>
                <span className="text-sm">{item.name}</span>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}