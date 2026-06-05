import { BrowserRouter, Routes, Route, Outlet, useLocation } from "react-router-dom";
import Sidebar from "@/components/layout/Sidebar";
import routes from "./routes";
import { AuthProvider } from "@/shared/context/AuthContext";
import { ProtectedRoute } from "./ProtectedRoute";
import Login from "@/pages/Login";
import NotFound from "@/pages/NotFound";
import { Toaster } from "@/components/ui/sonner";
import { ChevronRight, Home } from "lucide-react";
import { CONSOLE_HOME_ROUTE } from "@/shared/constants/branding";

const auditSubMap: Record<string, string> = {
  "regular": "快速审计",
  "agent": "深度审计",
};

function Breadcrumb() {
  const location = useLocation();

  let primaryName = "";
  let secondaryName = "";

  const match = routes.find((r) => {
    if (r.path.includes(":")) {
      const base = r.path.split("/:")[0];
      return location.pathname.startsWith(base);
    }
    return location.pathname === r.path;
  });

  // Special case: /audit-tasks with sub-tabs
  if (location.pathname === "/audit-tasks") {
    primaryName = "任务管理";
    const tab = new URLSearchParams(location.search).get("tab");
    if (tab && auditSubMap[tab]) {
      secondaryName = auditSubMap[tab];
    }
  } else if (location.pathname === "/instant-analysis") {
    primaryName = "任务管理";
    secondaryName = "审计工具";
  } else if (location.pathname === "/audit-rules") {
    primaryName = "规则管理";
    const tab = new URLSearchParams(location.search).get("tab");
    secondaryName = tab === "ai" ? "AI规则" : "静态规则";
  } else if (location.pathname === "/admin") {
    primaryName = "系统管理";
    const tab = new URLSearchParams(location.search).get("tab");
    secondaryName = tab === "config" ? "配置管理" : "用户管理";
  } else if (match) {
    primaryName = match.name;
  }

  if (!primaryName) return null;

  return (
    <div className="flex items-center gap-2 px-6 pt-4 pb-1 text-sm text-[#6B7280]">
      <Home className="h-4 w-4" />
      <span className="text-[#374151] hover:text-[#6366F1] cursor-pointer" onClick={() => window.location.href = CONSOLE_HOME_ROUTE}>首页</span>
      {primaryName && (
        <>
          <ChevronRight className="h-4 w-4 text-[#C7D2FE]" />
          {secondaryName ? (
            <>
              <span className="text-[#374151]">{primaryName}</span>
              <ChevronRight className="h-4 w-4 text-[#C7D2FE]" />
              <span className="text-[#6366F1] font-medium">{secondaryName}</span>
            </>
          ) : (
            <span className="text-[#6366F1] font-medium">{primaryName}</span>
          )}
        </>
      )}
    </div>
  );
}

function AppLayout() {
  return (
    <div className="min-h-screen gradient-bg">
      <Sidebar />
      <main className="min-h-[calc(100vh-3.5rem)]">
        <Breadcrumb />
        <Outlet />
      </main>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster position="top-right" />
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<Login />} />

          {/* Protected Routes */}
          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              {routes.map((route) => (
                <Route
                  key={route.path}
                  path={route.path}
                  element={route.element}
                />
              ))}
            </Route>
          </Route>

          {/* Catch all */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;