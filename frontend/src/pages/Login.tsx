/**
 * Login Page
 */

import { useState, FormEvent, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/shared/context/AuthContext";
import { apiClient } from "@/shared/api/serverClient";
import AuthShell from "@/components/layout/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { User, Lock } from "lucide-react";
import { BRAND_NAME, CONSOLE_HOME_ROUTE } from "@/shared/constants/branding";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isAuthenticated } = useAuth();

  const from = location.state?.from?.pathname || CONSOLE_HOME_ROUTE;

  useEffect(() => {
    const savedUsername = localStorage.getItem("remembered_username");
    if (savedUsername) {
      setUsername(savedUsername);
      setRememberMe(true);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated && !loading) {
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, navigate, from, loading]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setLoading(true);
    try {
      const formData = new URLSearchParams();
      formData.append("username", username);
      formData.append("password", password);

      const response = await apiClient.post("/auth/login", formData, {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      });

      if (rememberMe) {
        localStorage.setItem("remembered_username", username);
      } else {
        localStorage.removeItem("remembered_username");
      }

      await login(response.data.access_token, rememberMe);
      toast.success("登录成功");
    } catch (error: any) {
      const detail = error.response?.data?.detail;
      if (Array.isArray(detail)) {
        setErrorMsg(detail.map((err: any) => err.msg || err.message || JSON.stringify(err)).join('; '));
      } else if (typeof detail === 'object') {
        setErrorMsg(detail.msg || detail.message || JSON.stringify(detail));
      } else {
        setErrorMsg(detail || "登录失败，请检查用户名和密码");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="账号登录"
      description="智能代码安全审计，守护每一行代码"
      footer={<span></span>}
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-1.5">
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#c0c4cc]">
              <User className="h-4 w-4" />
            </span>
            <Input
              id="username"
              type="text"
              placeholder="请输入用户名"
              value={username}
              onChange={(e) => { setUsername(e.target.value); setErrorMsg(""); }}
              required
              className={`h-11 pl-10 bg-[#f9fafb] focus:bg-white focus:ring-1 rounded-lg text-sm placeholder:text-[#c0c4cc] ${errorMsg ? "border-red-500 focus:border-red-500 focus:ring-red-500/20" : "border-[#e8ecf1] focus:border-[#0052D9] focus:ring-[#0052D9]/20"}`}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#c0c4cc]">
              <Lock className="h-4 w-4" />
            </span>
            <Input
              id="password"
              type="password"
              placeholder="请输入密码"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setErrorMsg(""); }}
              required
              className={`h-11 pl-10 bg-[#f9fafb] focus:bg-white focus:ring-1 rounded-lg text-sm placeholder:text-[#c0c4cc] ${errorMsg ? "border-red-500 focus:border-red-500 focus:ring-red-500/20" : "border-[#e8ecf1] focus:border-[#0052D9] focus:ring-[#0052D9]/20"}`}
            />
          </div>
        </div>

        {errorMsg && (
          <p className="text-xs text-red-500 -mt-2">{errorMsg}</p>
        )}

        <div className="flex items-center">
          <label className="flex cursor-pointer items-center gap-1.5 text-xs text-[#86909c] select-none">
            <Checkbox
              id="remember"
              checked={rememberMe}
              onCheckedChange={(checked) => setRememberMe(checked as boolean)}
              className="h-3.5 w-3.5 rounded border-[#d0d5dd] data-[state=checked]:bg-[#0052D9] data-[state=checked]:border-[#0052D9]"
            />
            记住登录状态
          </label>
        </div>

        <Button
          type="submit"
          className="h-11 w-full rounded-lg bg-[#0052D9] text-sm font-medium text-white shadow-none hover:bg-[#0041b8] border-0 focus:ring-2 focus:ring-[#0052D9]/30"
          disabled={loading}
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              登录中...
            </span>
          ) : (
            "登 录"
          )}
        </Button>
      </form>
    </AuthShell>
  );
}