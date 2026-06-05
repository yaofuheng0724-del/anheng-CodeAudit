import type { ReactNode } from "react";
import {
  BRAND_COMPANY_NAME,
  BRAND_LOGO_PATH,
  BRAND_NAME,
} from "@/shared/constants/branding";
import { Code2, Shield, Search, Sparkles } from "lucide-react";

interface AuthShellProps {
  title: string;
  description: string;
  footer: ReactNode;
  children: ReactNode;
}

const features = [
  { icon: Code2, label: "代码审计" },
  { icon: Shield, label: "安全合规" },
  { icon: Search, label: "漏洞检测" },
  { icon: Sparkles, label: "智能分析" },
];

export default function AuthShell({
  title,
  description,
  footer,
  children,
}: AuthShellProps) {
  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-t from-[#e8f0fe] via-[#f4f8ff] to-white" style={{ backgroundSize: "100% 100%" }}>
      <div className="absolute bottom-0 left-0 w-full pointer-events-none overflow-hidden">
        <div className="absolute bottom-[20%] left-[8%] w-72 h-72 rounded-full bg-[#0052D9]/[0.04] blur-3xl" />
        <div className="absolute bottom-[5%] right-[12%] w-56 h-56 rounded-full bg-[#0052D9]/[0.03] blur-2xl" />
      </div>

      <div className="relative flex min-h-screen items-center justify-center px-6 py-12">
        <div className="w-full max-w-[420px]">
          <div className="mb-8 text-center">
            <div className="mb-4 flex justify-center">
              <img
                src={BRAND_LOGO_PATH}
                alt={BRAND_COMPANY_NAME}
                className="h-11 object-contain"
              />
            </div>
                      </div>

          <div className="rounded-2xl bg-white shadow-[0_2px_12px_rgba(0,0,0,0.08)] border border-[#e8ecf1] px-8 py-9">
            <div className="mb-7 text-center">
              <h2 className="text-xl font-semibold text-[#1d2129]">{title}</h2>
              <p className="mt-2 text-sm text-[#86909c]">{description}</p>
            </div>

            {children}

            <div className="mt-6 border-t border-[#e8ecf1] pt-5 text-xs text-[#86909c] text-center">
              Version V2.5.3
            </div>
          </div>

          <div className="mt-7 flex justify-center gap-5">
            {features.map(({ icon: Icon, label }) => (
              <span
                key={label}
                className="flex items-center gap-1.5 text-xs text-[#86909c]"
              >
                <Icon className="h-3.5 w-3.5 text-[#0052D9]" />
                {label}
              </span>
            ))}
          </div>

          <div className="mt-6 text-center text-xs text-[#c0c4cc]">
            <span className="hover:text-[#86909c] cursor-pointer">法律声明</span>
            <span className="mx-2">|</span>
            <span className="hover:text-[#86909c] cursor-pointer">网站地图</span>
            <p className="mt-1">
              杭州安恒信息技术股份有限公司 版权所有©2007-2025
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}