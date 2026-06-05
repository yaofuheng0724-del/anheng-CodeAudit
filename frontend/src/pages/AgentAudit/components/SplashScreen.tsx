/**
 * 启动页组件
 * 深色渐变背景，中文标题，底部特性卡片
 */

import { memo } from "react";
import { Shield, Play, Zap, Users, ShieldCheck } from "lucide-react";

interface SplashScreenProps {
  onComplete: () => void;
}

const FEATURES = [
  {
    icon: <Zap className="w-5 h-5 text-indigo-400" />,
    title: "实时流式分析",
    description: "审计过程全程可视化，实时追踪每个分析步骤",
  },
  {
    icon: <Users className="w-5 h-5 text-emerald-400" />,
    title: "多 Agent 协作",
    description: "侦察、分析、验证多个智能体协同工作",
  },
  {
    icon: <ShieldCheck className="w-5 h-5 text-amber-400" />,
    title: "智能漏洞验证",
    description: "AI 驱动的漏洞发现与自动化验证",
  },
];

export const SplashScreen = memo(function SplashScreen({
  onComplete,
}: SplashScreenProps) {
  return (
    <div className="h-screen bg-gradient-to-b from-indigo-950 via-indigo-900 to-slate-900 flex flex-col items-center justify-center p-8 relative overflow-hidden">
      {/* 装饰性背景光晕 */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[300px] h-[300px] bg-violet-500/8 rounded-full blur-[80px] pointer-events-none" />

      {/* 主图标 */}
      <div className="relative z-10 mb-6">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
          <Shield className="w-10 h-10 text-white" />
        </div>
      </div>

      {/* 标题 */}
      <div className="text-center mb-8 relative z-10">
        <h1 className="text-3xl font-bold text-white tracking-wide mb-2">
          深度安全审计
        </h1>
        <p className="text-slate-400 text-sm tracking-wide">
          自主化智能代码安全分析平台
        </p>
      </div>

      {/* 启动按钮 */}
      <button
        onClick={onComplete}
        className="
          relative z-10 flex items-center gap-3 px-8 py-3.5
          bg-white text-indigo-700 font-semibold text-base
          rounded-xl shadow-lg shadow-white/10
          hover:bg-indigo-50 hover:shadow-xl hover:shadow-white/15
          transition-all duration-200
          focus:outline-none focus:ring-2 focus:ring-white/40 focus:ring-offset-2 focus:ring-offset-indigo-900
        "
      >
        <Play className="w-5 h-5" />
        开始审计任务
      </button>

      <p className="text-slate-500 text-xs mt-3 relative z-10">
        点击按钮创建并启动新的安全审计任务
      </p>

      {/* 特性卡片 */}
      <div className="flex gap-4 mt-12 relative z-10">
        {FEATURES.map((feature) => (
          <div
            key={feature.title}
            className="bg-white/5 border border-white/10 rounded-xl p-4 w-52 backdrop-blur-sm hover:bg-white/8 transition-colors"
          >
            <div className="mb-2">{feature.icon}</div>
            <p className="text-sm font-medium text-white mb-1">{feature.title}</p>
            <p className="text-xs text-slate-400 leading-relaxed">{feature.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
});

export default SplashScreen;