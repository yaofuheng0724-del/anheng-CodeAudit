import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  KeyRound,
  Plus,
  Power,
  Search,
  Shield,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { SystemConfig } from "@/components/system/SystemConfig";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { apiClient } from "@/shared/api/serverClient";
import { useAuth } from "@/shared/context/AuthContext";

type AdminUser = {
  id: string;
  username: string;
  email?: string;
  full_name?: string;
  role: "admin" | "member";
  is_active: boolean;
  is_superuser: boolean;
  created_at: string;
};

type UserListResponse = {
  users: AdminUser[];
  total: number;
  skip: number;
  limit: number;
};

const DEFAULT_PASSWORD = "Admin@123456";

function formatDate(value?: string) {
  if (!value) return "-";
  return new Date(value).toLocaleString("zh-CN");
}

/** Helper: derive display label from role + is_superuser */
function getRoleLabel(role: string, is_superuser: boolean) {
  if (is_superuser) return "超级管理员";
  if (role === "admin") return "普通管理员";
  return "普通用户";
}

/** Form role values: member / admin / superadmin */
type FormRole = "member" | "admin" | "superadmin";

const INITIAL_USER_FORM = {
  username: "",
  password: DEFAULT_PASSWORD,
  email: "",
  role: "member" as FormRole,
};

export default function AdminDashboard() {
  const [searchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "users";
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [loadingUsers, setLoadingUsers] = useState(false);
  const [users, setUsers] = useState<AdminUser[]>([]);

  // Sheet (sidebar) visibility
  const [showCreateSheet, setShowCreateSheet] = useState(false);

  // User creation form
  const [userForm, setUserForm] = useState({ ...INITIAL_USER_FORM });

  // Filters
  const [filterUsername, setFilterUsername] = useState("");
  const [filterEmail, setFilterEmail] = useState("");
  const [filterRole, setFilterRole] = useState("all");

  const loadUsers = async () => {
    if (!isAdmin) return;
    setLoadingUsers(true);
    try {
      const response = await apiClient.get<UserListResponse>("/users/");
      setUsers(response.data.users);
    } catch (error) {
      console.error("加载用户列表失败", error);
      toast.error("加载用户列表失败");
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    if (!isAdmin) return;
    void loadUsers();
  }, [isAdmin]);

  const handleCreateUser = async () => {
    if (!userForm.username || !userForm.password) {
      toast.error("请填写用户名和密码");
      return;
    }
    try {
      const apiRole = userForm.role === "member" ? "member" : "admin";
      const isSuperuser = userForm.role === "superadmin";
      await apiClient.post("/users/", {
        username: userForm.username,
        password: userForm.password,
        email: userForm.email || null,
        role: apiRole,
        is_superuser: isSuperuser,
        is_active: true,
      });
      toast.success("用户已创建");
      setUserForm({ ...INITIAL_USER_FORM });
      setShowCreateSheet(false);
      await loadUsers();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "创建用户失败");
    }
  };

  const handleToggleUserStatus = async (target: AdminUser) => {
    try {
      await apiClient.post(`/users/${target.id}/toggle-status`);
      toast.success(`用户已${target.is_active ? "禁用" : "启用"}`);
      await loadUsers();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "更新用户状态失败");
    }
  };

  const handleResetPassword = async (target: AdminUser) => {
    try {
      await apiClient.put(`/users/${target.id}`, {
        password: DEFAULT_PASSWORD,
      });
      toast.success(`已将 ${target.username} 的密码重置为 ${DEFAULT_PASSWORD}`);
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "重置密码失败");
    }
  };

  const handleDeleteUser = async (target: AdminUser) => {
    try {
      await apiClient.delete(`/users/${target.id}`);
      toast.success("用户已删除");
      await loadUsers();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "删除用户失败");
    }
  };

  // Filtered user list
  const filteredUsers = users.filter((item) => {
    if (
      filterUsername &&
      !item.username.toLowerCase().includes(filterUsername.toLowerCase())
    )
      return false;
    if (
      filterEmail &&
      !(item.email || "").toLowerCase().includes(filterEmail.toLowerCase())
    )
      return false;
    if (filterRole === "member" && item.role !== "member") return false;
    if (filterRole === "admin" && (item.role !== "admin" || item.is_superuser)) return false;
    if (filterRole === "superadmin" && !item.is_superuser) return false;
    return true;
  });

  if (!isAdmin) {
    return (
      <div className="space-y-4 px-6 pt-1 pb-6 cyber-bg-elevated min-h-screen font-sans relative">
        <div className="absolute inset-0 cyber-grid-subtle pointer-events-none" />
        <div className="relative z-10 cyber-card p-8">
          <div className="cyber-card-header">
            <Shield className="w-5 h-5 text-primary" />
            <h1 className="text-2xl font-semibold uppercase tracking-wider text-foreground">
              系统管理
            </h1>
          </div>
          <div className="p-6 text-sm text-muted-foreground">
            当前账号不是管理员，无法访问系统管理功能。
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 px-6 pt-1 pb-6 cyber-bg-elevated min-h-screen font-sans relative">
      <div className="absolute inset-0 cyber-grid-subtle pointer-events-none" />

      {activeTab === "users" && (
        <div className="relative z-10">
          <div className="cyber-card p-0">
            {/* Toolbar: filters + actions (AuditRules style) */}
            <div className="p-4 flex items-center gap-3 border-b border-border flex-wrap">
              <div className="relative flex-1 min-w-[140px] max-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <Input
                  value={filterUsername}
                  onChange={(e) => setFilterUsername(e.target.value)}
                  placeholder="搜索用户名"
                  className="h-8 text-sm !pl-9"
                />
              </div>
              <div className="relative flex-1 min-w-[140px] max-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <Input
                  value={filterEmail}
                  onChange={(e) => setFilterEmail(e.target.value)}
                  placeholder="搜索邮箱"
                  className="h-8 text-sm !pl-9"
                />
              </div>
              <Select value={filterRole} onValueChange={setFilterRole}>
                <SelectTrigger className="cyber-input h-8 w-[130px] text-sm">
                  <SelectValue placeholder="角色" />
                </SelectTrigger>
                <SelectContent className="cyber-dialog border-border">
                  <SelectItem value="all">全部角色</SelectItem>
                  <SelectItem value="member">普通用户</SelectItem>
                  <SelectItem value="admin">普通管理员</SelectItem>
                  <SelectItem value="superadmin">超级管理员</SelectItem>
                </SelectContent>
              </Select>
              <div className="ml-auto flex gap-2">
                <Button
                  onClick={() => setShowCreateSheet(true)}
                  className="cyber-btn-primary h-8"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  创建用户
                </Button>
              </div>
            </div>

            {/* User table (AuditRules flat-table style) */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="text-left py-2 px-6 font-medium">用户名</th>
                    <th className="text-left py-2 px-3 font-medium">角色</th>
                    <th className="text-left py-2 px-3 font-medium">状态</th>
                    <th className="text-left py-2 px-3 font-medium">创建时间</th>
                    <th className="text-left py-2 px-3 font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingUsers ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="py-12 text-center text-muted-foreground"
                      >
                        加载中...
                      </td>
                    </tr>
                  ) : filteredUsers.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="py-12 text-center text-muted-foreground"
                      >
                        无匹配用户
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((item) => (
                      <tr
                        key={item.id}
                        className="border-b border-border/50 hover:bg-muted/50 transition-colors"
                      >
                        <td className="py-2.5 px-6">
                          <span className="font-medium text-foreground">
                            {item.username}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <Badge className="cyber-badge-muted">
                            {getRoleLabel(item.role, item.is_superuser)}
                          </Badge>
                        </td>
                        <td className="py-2.5 px-3">
                          <Badge
                            className={
                              item.is_active
                                ? "cyber-badge-success"
                                : "cyber-badge-danger"
                            }
                          >
                            {item.is_active ? "启用" : "禁用"}
                          </Badge>
                        </td>
                        <td className="py-2.5 px-3 text-muted-foreground">
                          {formatDate(item.created_at)}
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => void handleResetPassword(item)}
                              className="h-7 w-7 hover:bg-primary/12 hover:text-primary"
                              title="重置密码"
                            >
                              <KeyRound className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() =>
                                void handleToggleUserStatus(item)
                              }
                              className={`h-7 w-7 ${item.is_active ? "bg-primary/12 text-primary" : "hover:bg-primary/12 hover:text-primary"}`}
                              title={item.is_active ? "禁用" : "启用"}
                            >
                              <Power className="w-3.5 h-3.5" />
                            </Button>
                            {item.username !== user?.username && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => void handleDeleteUser(item)}
                                className="h-7 w-7 hover:bg-destructive/12 hover:text-destructive"
                                title="删除"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === "config" && (
        <div className="relative z-10 flex flex-col gap-6">
          <SystemConfig />
        </div>
      )}

      {/* Create User Sheet (sidebar) */}
      <Sheet open={showCreateSheet} onOpenChange={setShowCreateSheet}>
        <SheetContent
          side="right"
          className="!w-[min(90vw,500px)] sm:max-w-[500px] !sm:max-w-none flex flex-col p-0 gap-0 border-border overflow-y-auto"
        >
          <SheetHeader className="px-6 py-4 border-b border-border flex-shrink-0 bg-muted">
            <SheetTitle className="flex items-center gap-3 font-sans text-foreground">
              <div className="p-2 bg-primary/20 rounded border border-primary/30">
                <Plus className="w-5 h-5 text-primary" />
              </div>
              <span className="text-lg font-semibold uppercase tracking-wider">
                创建新用户
              </span>
            </SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground uppercase">
                用户名 *
              </Label>
              <Input
                value={userForm.username}
                onChange={(e) =>
                  setUserForm((prev) => ({ ...prev, username: e.target.value }))
                }
                placeholder="输入用户名"
                className="cyber-input"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground uppercase">
                邮箱
              </Label>
              <Input
                value={userForm.email}
                onChange={(e) =>
                  setUserForm((prev) => ({ ...prev, email: e.target.value }))
                }
                placeholder="输入邮箱"
                className="cyber-input"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground uppercase">
                初始密码 *
              </Label>
              <Input
                value={userForm.password}
                onChange={(e) =>
                  setUserForm((prev) => ({ ...prev, password: e.target.value }))
                }
                placeholder="输入初始密码"
                className="cyber-input"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground uppercase">
                角色
              </Label>
              <Select
                value={userForm.role}
                onValueChange={(value: FormRole) =>
                  setUserForm((prev) => ({ ...prev, role: value }))
                }
              >
                <SelectTrigger className="cyber-input">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="cyber-dialog border-border">
                  <SelectItem value="member">普通用户</SelectItem>
                  <SelectItem value="admin">普通管理员</SelectItem>
                  <SelectItem value="superadmin">超级管理员</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex-shrink-0 flex justify-end gap-3 px-6 py-4 bg-muted border-t border-border">
            <Button
              variant="outline"
              onClick={() => setShowCreateSheet(false)}
              className="cyber-btn-outline"
            >
              取消
            </Button>
            <Button
              onClick={() => void handleCreateUser()}
              className="cyber-btn-primary"
            >
              保存
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
