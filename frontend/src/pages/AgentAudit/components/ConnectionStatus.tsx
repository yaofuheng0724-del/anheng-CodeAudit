/**
 * 连接状态指示器
 * 显示实时连接状态，全中文标签
 */

import { Wifi, WifiOff, RefreshCw, AlertCircle } from 'lucide-react';
import { cn } from '@/shared/utils/utils';
import type { ConnectionState } from '../hooks';

interface ConnectionStatusProps {
  state: ConnectionState;
  reconnectAttempts?: number;
  maxReconnectAttempts?: number;
  className?: string;
}

const STATUS_CONFIG: Record<ConnectionState, {
  icon: typeof Wifi;
  label: string;
  color: string;
  bgColor: string;
  animate?: boolean;
}> = {
  disconnected: {
    icon: WifiOff,
    label: '已断开',
    color: 'text-slate-400',
    bgColor: 'bg-slate-400/10',
  },
  connecting: {
    icon: RefreshCw,
    label: '连接中',
    color: 'text-amber-500',
    bgColor: 'bg-amber-400/10',
    animate: true,
  },
  connected: {
    icon: Wifi,
    label: '实时',
    color: 'text-emerald-500',
    bgColor: 'bg-emerald-400/10',
  },
  reconnecting: {
    icon: RefreshCw,
    label: '重连中',
    color: 'text-amber-500',
    bgColor: 'bg-amber-400/10',
    animate: true,
  },
  failed: {
    icon: AlertCircle,
    label: '连接失败',
    color: 'text-rose-500',
    bgColor: 'bg-rose-400/10',
  },
};

export function ConnectionStatus({
  state,
  reconnectAttempts = 0,
  maxReconnectAttempts = 5,
  className,
}: ConnectionStatusProps) {
  const config = STATUS_CONFIG[state];
  const Icon = config.icon;

  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      <div className={cn(
        'flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
        config.bgColor,
        config.color
      )}>
        <Icon className={cn(
          'w-3 h-3',
          config.animate && 'animate-spin'
        )} />
        <span>{config.label}</span>
        {state === 'reconnecting' && reconnectAttempts > 0 && (
          <span className="opacity-70">
            ({reconnectAttempts}/{maxReconnectAttempts})
          </span>
        )}
      </div>

      {state === 'connected' && (
        <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
      )}
    </div>
  );
}

export default ConnectionStatus;