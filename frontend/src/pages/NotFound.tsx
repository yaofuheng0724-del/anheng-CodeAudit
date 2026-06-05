/**
 * NotFound Page
 */

import { Link } from "react-router-dom";
import PageMeta from "@/components/layout/PageMeta";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ArrowLeft, Home } from "lucide-react";
import { BRAND_NAME, CONSOLE_HOME_ROUTE } from "@/shared/constants/branding";

export default function NotFound() {
  return (
    <>
      <PageMeta title="页面未找到" description="" />
      <div className="gradient-bg flex min-h-screen items-center justify-center p-6">
        <div className="cyber-card w-full max-w-3xl p-8 sm:p-12">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-xl">
              <div className="inline-flex h-16 w-16 items-center justify-center rounded-3xl bg-rose-50 text-rose-600 ring-1 ring-rose-100">
                <AlertTriangle className="h-8 w-8" />
              </div>
              <div className="mt-8 text-sm font-medium text-primary">Error 404</div>
              <h1 className="mt-3 text-4xl font-semibold tracking-tight text-foreground">
                页面不存在或已被移除
              </h1>
              <p className="mt-4 text-base leading-7 text-muted-foreground">
                你访问的地址当前不可用。它可能已经被删除、路径发生变化，或链接本身不正确。
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link to={CONSOLE_HOME_ROUTE}>
                  <Button className="h-11 px-5">
                    <Home className="mr-1 h-4 w-4" />
                    返回首页
                  </Button>
                </Link>
                <button
                  type="button"
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-border bg-white px-5 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-muted"
                  onClick={() => window.history.back()}
                >
                  <ArrowLeft className="h-4 w-4" />
                  返回上一页
                </button>
              </div>
            </div>

            <div className="rounded-[28px] border border-primary/10 bg-[linear-gradient(180deg,rgba(217,38,37,0.08),rgba(255,255,255,0.92))] p-6 lg:w-[280px]">
              <div className="text-6xl font-semibold tracking-tight text-primary/90">404</div>
              <div className="mt-3 text-sm font-medium text-foreground">{BRAND_NAME}</div>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                建议从首页重新进入对应模块，或通过左侧导航查找项目、任务和审计页面。
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
