/**
 * Agent 错误边界组件
 * 深色风格，全中文标签
 */

import { Component, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Terminal, ArrowLeft, Bug } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/shared/utils/utils';

interface Props {
  children: ReactNode;
  taskId?: string;
  onRetry?: () => void;
  onReset?: () => void;
  maxRetries?: number;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
  retryCount: number;
  isRetrying: boolean;
}

export class AgentErrorBoundary extends Component<Props, State> {
  private retryTimeoutId: ReturnType<typeof setTimeout> | null = null;

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0,
      isRetrying: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[AgentErrorBoundary] 捕获错误:', error, errorInfo);
    this.setState({ errorInfo });
    this.reportError(error, errorInfo);
  }

  componentWillUnmount() {
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
    }
  }

  private reportError(error: Error, errorInfo: React.ErrorInfo) {
    const report = {
      timestamp: new Date().toISOString(),
      taskId: this.props.taskId,
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
      componentStack: errorInfo.componentStack,
      userAgent: navigator.userAgent,
      url: window.location.href,
    };

    if (import.meta.env.DEV) {
      console.error('[AgentErrorBoundary] 错误报告:', report);
    }
  }

  private getErrorCategory(): 'network' | 'stream' | 'render' | 'unknown' {
    const message = this.state.error?.message?.toLowerCase() || '';

    if (message.includes('fetch') || message.includes('network') || message.includes('connection')) {
      return 'network';
    }
    if (message.includes('stream') || message.includes('sse') || message.includes('eventsource')) {
      return 'stream';
    }
    if (message.includes('render') || message.includes('react') || message.includes('component')) {
      return 'render';
    }
    return 'unknown';
  }

  private getRecoveryHint(): string {
    const category = this.getErrorCategory();
    switch (category) {
      case 'network':
        return '请检查网络连接后重试';
      case 'stream':
        return '实时连接已中断，请刷新页面重新连接';
      case 'render':
        return '页面渲染出错，请尝试刷新';
      default:
        return '发生了意外错误';
    }
  }

  handleRetry = async () => {
    const maxRetries = this.props.maxRetries ?? 3;

    if (this.state.retryCount >= maxRetries) {
      return;
    }

    this.setState({ isRetrying: true });

    const delay = Math.min(1000 * Math.pow(2, this.state.retryCount), 10000);

    await new Promise(resolve => {
      this.retryTimeoutId = setTimeout(resolve, delay);
    });

    this.setState(prev => ({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: prev.retryCount + 1,
      isRetrying: false,
    }));

    this.props.onRetry?.();
  };

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0,
      isRetrying: false,
    });
    this.props.onReset?.();
  };

  handleGoBack = () => {
    window.history.back();
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    const { hasError, error, errorInfo, retryCount, isRetrying } = this.state;
    const maxRetries = this.props.maxRetries ?? 3;
    const canRetry = retryCount < maxRetries;
    const category = this.getErrorCategory();

    if (!hasError) {
      return this.props.children;
    }

    return (
      <div className="h-screen bg-gradient-to-b from-slate-900 to-indigo-950 flex items-center justify-center p-4">
        <div className="w-full max-w-lg space-y-6">
          {/* 错误标题 */}
          <div className="flex items-center gap-4">
            <div className={cn(
              "p-3 rounded-xl",
              category === 'network' ? 'bg-amber-500/20' : 'bg-rose-500/20'
            )}>
              <AlertTriangle className={cn(
                "w-8 h-8",
                category === 'network' ? 'text-amber-400' : 'text-rose-400'
              )} />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">审计异常</h2>
              <p className="text-sm text-slate-400">{this.getRecoveryHint()}</p>
            </div>
          </div>

          {/* 错误详情 */}
          <div className="bg-slate-800/80 border border-slate-700 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-700 flex items-center gap-2">
              <Terminal className="w-4 h-4 text-slate-400" />
              <span className="text-xs text-slate-400 font-medium">错误详情</span>
            </div>
            <div className="p-4 space-y-3">
              {error && (
                <div className="space-y-2">
                  <div className="flex items-start gap-2">
                    <Bug className="w-4 h-4 text-rose-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-sans text-rose-400">{error.name}</p>
                      <p className="text-sm text-slate-300">{error.message}</p>
                    </div>
                  </div>
                </div>
              )}

              {this.props.taskId && (
                <div className="text-xs text-slate-500">
                  任务 ID: <span className="font-sans text-slate-400">{this.props.taskId}</span>
                </div>
              )}

              {retryCount > 0 && (
                <div className="text-xs text-slate-500">
                  重试次数: <span className="text-amber-400">{retryCount}/{maxRetries}</span>
                </div>
              )}

              {import.meta.env.DEV && error?.stack && (
                <details className="text-xs">
                  <summary className="cursor-pointer text-slate-500 hover:text-slate-300 transition-colors">
                    堆栈追踪
                  </summary>
                  <pre className="mt-2 p-3 bg-slate-900/50 rounded text-xs text-slate-400 overflow-auto max-h-40">
                    {error.stack}
                  </pre>
                </details>
              )}

              {import.meta.env.DEV && errorInfo?.componentStack && (
                <details className="text-xs">
                  <summary className="cursor-pointer text-slate-500 hover:text-slate-300 transition-colors">
                    组件堆栈
                  </summary>
                  <pre className="mt-2 p-3 bg-slate-900/50 rounded text-xs text-slate-400 overflow-auto max-h-40">
                    {errorInfo.componentStack}
                  </pre>
                </details>
              )}
            </div>
          </div>

          {/* 操作按钮 */}
          <div className="flex gap-3">
            {canRetry && (
              <Button
                onClick={this.handleRetry}
                disabled={isRetrying}
                className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white"
              >
                <RefreshCw className={cn("w-4 h-4 mr-2", isRetrying && "animate-spin")} />
                {isRetrying ? '重试中...' : '重试'}
              </Button>
            )}
            <Button
              onClick={this.handleGoBack}
              variant="outline"
              className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-800 hover:text-white"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              返回
            </Button>
            <Button
              onClick={this.handleReload}
              variant="ghost"
              className="flex-1 text-slate-400 hover:text-white hover:bg-slate-800"
            >
              刷新页面
            </Button>
          </div>

          {!canRetry && (
            <p className="text-center text-xs text-slate-500">
              已达到最大重试次数，请刷新页面或联系技术支持。
            </p>
          )}
        </div>
      </div>
    );
  }
}

export default AgentErrorBoundary;