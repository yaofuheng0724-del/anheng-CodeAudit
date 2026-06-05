/**
 * Agent 审计页 - 简约单栏布局
 * 顶部：信息栏 + 阶段步骤条 + 统计
 * 主体：日志流
 * 底部：Agent面板
 */

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useAgentStream } from "@/hooks/useAgentStream";

import {
  getAgentTask,
  getAgentFindings,
  cancelAgentTask,
  getAgentTree,
  getAgentEvents,
  updateAgentFinding,
  AgentEvent,
} from "@/shared/api/agentTasks";
import CreateAgentTaskDialog from "@/components/agent/CreateAgentTaskDialog";

// 本地组件
import {
  SplashScreen,
  Header,
  StatsPanel,
  AgentErrorBoundary,
  PhaseTimeline,
  LogStream,
  FindingsTable,
} from "./components";
import ReportExportDialog from "./components/ReportExportDialog";
import IssueDetailSheet from "@/components/issues/IssueDetailSheet";
import { useAgentAuditState } from "./hooks";
import { CodeAnalysisPanel } from "@/components/code-analysis/CodeAnalysisPanel";
import { ACTION_VERBS, POLLING_INTERVALS } from "./constants";
import { cleanThinkingContent, truncateOutput, inferPhaseFromEvent, inferInitialPhase } from "./utils";
import type { AuditPhase } from "./types";
import { AUDIT_PHASES } from "./types";

function AgentAuditPageContent() {
  const { taskId } = useParams<{ taskId: string }>();
  const {
    task, findings, agentTree, logs, selectedAgentId, showAllLogs,
    isLoading, connectionStatus, isAutoScroll, expandedLogIds,
    treeNodes, filteredLogs, isRunning, isComplete,
    currentPhase, completedPhases,
    setTask, setFindings, setAgentTree, addLog, updateLog, removeLog,
    selectAgent, setLoading, setConnectionStatus, setAutoScroll, toggleLogExpanded,
    setCurrentAgentName, getCurrentAgentName, setCurrentThinkingId, getCurrentThinkingId,
    setCurrentPhase, completePhase,
    dispatch, reset,
  } = useAgentAuditState();

  // 本地状态
  const [showSplash, setShowSplash] = useState(!taskId);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [statusVerb, setStatusVerb] = useState(ACTION_VERBS[0]);
  const [statusDots, setStatusDots] = useState(0);
  const [expandedPhases, setExpandedPhases] = useState<Set<AuditPhase>>(new Set());

  // 问题详情 Sheet
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedFinding, setSelectedFinding] = useState<typeof findings[0] | null>(null);

  const handleViewFindingDetail = (finding: typeof findings[0]) => {
    setSelectedFinding(finding);
    setDetailOpen(true);
  };

  // 问题状态修改
  const handleFindingStatusChange = async (finding: typeof findings[0], newStatus: string) => {
    if (!taskId) return;
    try {
      await updateAgentFinding(taskId, finding.id, { status: newStatus });
      toast.success("状态已更新");
      // 重新加载问题列表
      const data = await getAgentFindings(taskId);
      setFindings(data);
    } catch (error) {
      console.error("Failed to update finding status:", error);
      toast.error("状态更新失败");
    }
  };

  const logEndRef = useRef<HTMLDivElement>(null);
  const phaseScrollRef = useRef<HTMLDivElement>(null);
  const agentTreeRefreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastAgentTreeRefreshTime = useRef<number>(0);
  const previousTaskIdRef = useRef<string | undefined>(undefined);
  const disconnectStreamRef = useRef<(() => void) | null>(null);
  const lastEventSequenceRef = useRef<number>(0);
  const hasConnectedRef = useRef<boolean>(false);
  const hasLoadedHistoricalEventsRef = useRef<boolean>(false);
  const [afterSequence, setAfterSequence] = useState<number>(0);
  const [historicalEventsLoaded, setHistoricalEventsLoaded] = useState<boolean>(false);

  // 🔥 taskId 变化时重置
  useEffect(() => {
    if (taskId !== previousTaskIdRef.current) {
      if (disconnectStreamRef.current) {
        disconnectStreamRef.current();
        disconnectStreamRef.current = null;
      }
      reset();
      setShowSplash(!taskId);
      lastEventSequenceRef.current = 0;
      hasConnectedRef.current = false;
      hasLoadedHistoricalEventsRef.current = false;
      setHistoricalEventsLoaded(false);
      setAfterSequence(0);
    }
    previousTaskIdRef.current = taskId;
  }, [taskId, reset]);

  // ============ 阶段日志分组 ============

  const phaseLogMap: Record<string, typeof logs[0][]> = {};
  for (const phase of AUDIT_PHASES) {
    phaseLogMap[phase] = [];
  }
  for (const log of logs) {
    const phase = log.phase || currentPhase;
    if (!phaseLogMap[phase]) phaseLogMap[phase] = [];
    phaseLogMap[phase].push(log);
  }
  const currentPhaseLogs = phaseLogMap[currentPhase] || [];

  // 自动滚动
  useEffect(() => {
    if (isAutoScroll && phaseScrollRef.current) {
      phaseScrollRef.current.scrollTop = phaseScrollRef.current.scrollHeight;
    }
  }, [currentPhaseLogs.length, isAutoScroll]);

  const togglePhaseExpanded = (phase: AuditPhase) => {
    setExpandedPhases((prev) => {
      const next = new Set(prev);
      if (next.has(phase)) next.delete(phase);
      else next.add(phase);
      return next;
    });
  };

  // ============ 数据加载 ============

  const loadTask = useCallback(async () => {
    if (!taskId) return;
    try {
      const data = await getAgentTask(taskId);
      setTask(data);
      const initialPhase = inferInitialPhase(data.status, data.current_phase);
      setCurrentPhase(initialPhase);
    } catch {
      toast.error("加载任务失败");
    }
  }, [taskId, setTask, setCurrentPhase]);

  const loadFindings = useCallback(async () => {
    if (!taskId) return;
    try {
      const data = await getAgentFindings(taskId);
      setFindings(data);
    } catch (err) {
      console.error(err);
    }
  }, [taskId, setFindings]);

  const loadAgentTree = useCallback(async () => {
    if (!taskId) return;
    try {
      const data = await getAgentTree(taskId);
      setAgentTree(data);
    } catch (err) {
      console.error(err);
    }
  }, [taskId, setAgentTree]);

  const debouncedLoadAgentTree = useCallback(() => {
    const now = Date.now();
    const minInterval = POLLING_INTERVALS.AGENT_TREE_DEBOUNCE;

    if (agentTreeRefreshTimer.current) {
      clearTimeout(agentTreeRefreshTimer.current);
    }

    const timeSinceLastRefresh = now - lastAgentTreeRefreshTime.current;
    if (timeSinceLastRefresh < minInterval) {
      agentTreeRefreshTimer.current = setTimeout(() => {
        lastAgentTreeRefreshTime.current = Date.now();
        loadAgentTree();
      }, minInterval - timeSinceLastRefresh);
    } else {
      agentTreeRefreshTimer.current = setTimeout(() => {
        lastAgentTreeRefreshTime.current = Date.now();
        loadAgentTree();
      }, POLLING_INTERVALS.AGENT_TREE_MIN_DELAY);
    }
  }, [loadAgentTree]);

  // 🔥 加载历史事件并推断阶段
  const loadHistoricalEvents = useCallback(async () => {
    if (!taskId) return 0;

    if (hasLoadedHistoricalEventsRef.current) {
      return 0;
    }
    hasLoadedHistoricalEventsRef.current = true;

    try {
      const events = await getAgentEvents(taskId, { limit: 500 });

      if (events.length === 0) return 0;

      events.sort((a: AgentEvent, b: AgentEvent) => a.sequence - b.sequence);

      let processedCount = 0;
      let inferredPhase: AuditPhase = currentPhase;

      events.forEach((event: AgentEvent) => {
        if (event.sequence > lastEventSequenceRef.current) {
          lastEventSequenceRef.current = event.sequence;
        }

        inferredPhase = inferPhaseFromEvent(
          event.event_type,
          event.phase,
          event.metadata as Record<string, unknown> | null,
          inferredPhase
        );

        const agentName = (event.metadata?.agent_name as string) ||
          (event.metadata?.agent as string) ||
          undefined;

        switch (event.event_type) {
          case 'thinking':
          case 'llm_thought':
          case 'llm_decision':
          case 'llm_start':
          case 'llm_complete':
          case 'llm_action':
          case 'llm_observation':
            dispatch({
              type: 'ADD_LOG',
              payload: {
                type: 'thinking',
                title: event.message?.slice(0, 100) + (event.message && event.message.length > 100 ? '...' : '') || '思考...',
                content: event.message || (event.metadata?.thought as string) || '',
                agentName,
                phase: inferredPhase,
              }
            });
            processedCount++;
            break;

          case 'tool_call':
            dispatch({
              type: 'ADD_LOG',
              payload: {
                type: 'tool',
                title: `工具: ${event.tool_name || '未知'}`,
                content: event.tool_input ? `输入:\n${JSON.stringify(event.tool_input, null, 2)}` : '',
                tool: { name: event.tool_name || '未知', status: 'running' as const },
                agentName,
                phase: inferredPhase,
              }
            });
            processedCount++;
            break;

          case 'tool_result':
            dispatch({
              type: 'ADD_LOG',
              payload: {
                type: 'tool',
                title: `完成: ${event.tool_name || '未知'}`,
                content: event.tool_output
                  ? `输出:\n${truncateOutput(typeof event.tool_output === 'string' ? event.tool_output : JSON.stringify(event.tool_output, null, 2))}`
                  : '',
                tool: { name: event.tool_name || '未知', duration: event.tool_duration_ms || 0, status: 'completed' as const },
                agentName,
                phase: inferredPhase,
              }
            });
            processedCount++;
            break;

          case 'finding':
          case 'finding_new':
          case 'finding_verified':
            dispatch({
              type: 'ADD_LOG',
              payload: {
                type: 'finding',
                title: event.message || (event.metadata?.title as string) || '发现漏洞',
                severity: (event.metadata?.severity as string) || 'medium',
                agentName,
                phase: inferredPhase,
              }
            });
            processedCount++;
            break;

          case 'dispatch':
          case 'dispatch_complete':
          case 'phase_start':
          case 'phase_complete':
          case 'node_start':
          case 'node_complete':
            dispatch({
              type: 'ADD_LOG',
              payload: {
                type: 'dispatch',
                title: event.message || `事件: ${event.event_type}`,
                agentName,
                phase: inferredPhase,
              }
            });
            processedCount++;
            break;

          case 'task_complete':
            dispatch({
              type: 'ADD_LOG',
              payload: { type: 'info', title: event.message || '任务已完成', agentName, phase: 'reporting' }
            });
            processedCount++;
            break;

          case 'task_error':
            dispatch({
              type: 'ADD_LOG',
              payload: { type: 'error', title: event.message || '任务出错', agentName, phase: inferredPhase }
            });
            processedCount++;
            break;

          case 'task_cancel':
            dispatch({
              type: 'ADD_LOG',
              payload: { type: 'info', title: event.message || '任务已取消', agentName, phase: inferredPhase }
            });
            processedCount++;
            break;

          case 'progress':
            if (event.message) {
              const progressPatterns = [
                { pattern: /索引进度[:：]?\s*\d+\/\d+/, key: 'index_progress' },
                { pattern: /嵌入进度[:：]?\s*\d+\/\d+/, key: 'embed_progress' },
                { pattern: /克隆进度[:：]?\s*\d+%/, key: 'clone_progress' },
                { pattern: /下载进度[:：]?\s*\d+%/, key: 'download_progress' },
                { pattern: /上传进度[:：]?\s*\d+%/, key: 'upload_progress' },
                { pattern: /扫描进度[:：]?\s*\d+/, key: 'scan_progress' },
                { pattern: /分析进度[:：]?\s*\d+/, key: 'analyze_progress' },
              ];
              const matchedProgress = progressPatterns.find(p => p.pattern.test(event.message || ''));
              if (matchedProgress) {
                dispatch({
                  type: 'UPDATE_OR_ADD_PROGRESS_LOG',
                  payload: { progressKey: matchedProgress.key, title: event.message, agentName }
                });
              } else {
                dispatch({
                  type: 'ADD_LOG',
                  payload: { type: 'info', title: event.message, agentName, phase: inferredPhase }
                });
              }
              processedCount++;
            }
            break;

          case 'info':
          case 'complete':
          case 'error':
          case 'warning': {
            const message = event.message || `${event.event_type}`;
            const progressPatterns = [
              { pattern: /索引进度[:：]?\s*\d+\/\d+/, key: 'index_progress' },
              { pattern: /嵌入进度[:：]?\s*\d+\/\d+/, key: 'embed_progress' },
              { pattern: /克隆进度[:：]?\s*\d+%/, key: 'clone_progress' },
              { pattern: /下载进度[:：]?\s*\d+%/, key: 'download_progress' },
              { pattern: /上传进度[:：]?\s*\d+%/, key: 'upload_progress' },
              { pattern: /扫描进度[:：]?\s*\d+/, key: 'scan_progress' },
              { pattern: /分析进度[:：]?\s*\d+/, key: 'analyze_progress' },
            ];
            const matchedProgress = progressPatterns.find(p => p.pattern.test(message));
            if (matchedProgress) {
              dispatch({
                type: 'UPDATE_OR_ADD_PROGRESS_LOG',
                payload: { progressKey: matchedProgress.key, title: message, agentName }
              });
            } else {
              dispatch({
                type: 'ADD_LOG',
                payload: {
                  type: event.event_type === 'error' ? 'error' : 'info',
                  title: message,
                  agentName,
                  phase: inferredPhase,
                }
              });
            }
            processedCount++;
            break;
          }

          case 'thinking_token':
          case 'thinking_start':
          case 'thinking_end':
            break;

          default:
            if (event.message) {
              dispatch({
                type: 'ADD_LOG',
                payload: { type: 'info', title: event.message, agentName, phase: inferredPhase }
              });
              processedCount++;
            }
        }
      });

      setCurrentPhase(inferredPhase);
      setAfterSequence(lastEventSequenceRef.current);
      return events.length;
    } catch (err) {
      console.error('[AgentAudit] 加载历史事件失败:', err);
      return 0;
    }
  }, [taskId, dispatch, currentPhase, setCurrentPhase]);

  // ============ 流事件处理 ============

  const streamOptions = useMemo(() => ({
    includeThinking: true,
    includeToolCalls: true,
    afterSequence: afterSequence,
    onEvent: (event: { type: string; message?: string; metadata?: { agent_name?: string; agent?: string; phase?: string } }) => {
      if (event.metadata?.agent_name) {
        setCurrentAgentName(event.metadata.agent_name);
      }

      const newPhase = inferPhaseFromEvent(
        event.type,
        event.metadata?.phase || null,
        event.metadata as Record<string, unknown> | null,
        currentPhase
      );
      if (newPhase !== currentPhase) {
        setCurrentPhase(newPhase);
      }

      const dispatchEvents = ['dispatch', 'dispatch_complete', 'node_start', 'phase_start', 'phase_complete'];
      if (dispatchEvents.includes(event.type)) {
        dispatch({
          type: 'ADD_LOG',
          payload: {
            type: 'dispatch',
            title: event.message || `Agent 调度: ${event.metadata?.agent || '未知'}`,
            agentName: getCurrentAgentName() || undefined,
            phase: newPhase,
          }
        });
        debouncedLoadAgentTree();
        return;
      }

      const infoEvents = ['info', 'warning', 'error', 'progress'];
      if (infoEvents.includes(event.type)) {
        const message = event.message || event.type;
        const progressPatterns = [
          { pattern: /索引进度[:：]?\s*\d+\/\d+/, key: 'index_progress' },
          { pattern: /嵌入进度[:：]?\s*\d+\/\d+/, key: 'embed_progress' },
          { pattern: /克隆进度[:：]?\s*\d+%/, key: 'clone_progress' },
          { pattern: /下载进度[:：]?\s*\d+%/, key: 'download_progress' },
          { pattern: /上传进度[:：]?\s*\d+%/, key: 'upload_progress' },
          { pattern: /扫描进度[:：]?\s*\d+/, key: 'scan_progress' },
          { pattern: /分析进度[:：]?\s*\d+/, key: 'analyze_progress' },
        ];
        const matchedProgress = progressPatterns.find(p => p.pattern.test(message));
        if (matchedProgress) {
          dispatch({
            type: 'UPDATE_OR_ADD_PROGRESS_LOG',
            payload: { progressKey: matchedProgress.key, title: message, agentName: getCurrentAgentName() || undefined }
          });
        } else {
          dispatch({
            type: 'ADD_LOG',
            payload: {
              type: event.type === 'error' ? 'error' : 'info',
              title: message,
              agentName: getCurrentAgentName() || undefined,
              phase: newPhase,
            }
          });
        }
        return;
      }
    },
    onThinkingStart: () => {
      const currentId = getCurrentThinkingId();
      if (currentId) {
        updateLog(currentId, { isStreaming: false });
      }
      setCurrentThinkingId(null);
    },
    onThinkingToken: (_token: string, accumulated: string) => {
      if (!accumulated?.trim()) return;
      const cleanContent = cleanThinkingContent(accumulated);
      if (!cleanContent) return;

      const currentId = getCurrentThinkingId();
      if (!currentId) {
        const newLogId = `thinking-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        dispatch({
          type: 'ADD_LOG', payload: {
            id: newLogId,
            type: 'thinking',
            title: '思考...',
            content: cleanContent,
            isStreaming: true,
            agentName: getCurrentAgentName() || undefined,
            phase: currentPhase,
          }
        });
        setCurrentThinkingId(newLogId);
      } else {
        updateLog(currentId, { content: cleanContent });
      }
    },
    onThinkingEnd: (response: string) => {
      const cleanResponse = cleanThinkingContent(response || "");
      const currentId = getCurrentThinkingId();

      if (!cleanResponse) {
        if (currentId) {
          removeLog(currentId);
        }
        setCurrentThinkingId(null);
        return;
      }

      if (currentId) {
        updateLog(currentId, {
          title: cleanResponse.slice(0, 100) + (cleanResponse.length > 100 ? '...' : ''),
          content: cleanResponse,
          isStreaming: false
        });
        setCurrentThinkingId(null);
      }
    },
    onToolStart: (name: string, input: Record<string, unknown>) => {
      const currentId = getCurrentThinkingId();
      if (currentId) {
        updateLog(currentId, { isStreaming: false });
        setCurrentThinkingId(null);
      }
      dispatch({
        type: 'ADD_LOG',
        payload: {
          type: 'tool',
          title: `工具: ${name}`,
          content: `输入:\n${JSON.stringify(input, null, 2)}`,
          tool: { name, status: 'running' },
          agentName: getCurrentAgentName() || undefined,
          phase: currentPhase,
        }
      });
    },
    onToolEnd: (name: string, output: unknown, duration: number) => {
      const outputStr = typeof output === 'string' ? output : JSON.stringify(output, null, 2);
      dispatch({
        type: 'COMPLETE_TOOL_LOG',
        payload: { toolName: name, output: truncateOutput(outputStr), duration }
      });
    },
    onFinding: (finding: Record<string, unknown>) => {
      dispatch({
        type: 'ADD_LOG',
        payload: {
          type: 'finding',
          title: (finding.title as string) || '发现漏洞',
          severity: (finding.severity as string) || 'medium',
          agentName: getCurrentAgentName() || undefined,
          phase: currentPhase,
        }
      });
      dispatch({
        type: 'ADD_FINDING',
        payload: {
          id: (finding.id as string) || `finding-${Date.now()}`,
          title: (finding.title as string) || '发现漏洞',
          severity: (finding.severity as string) || 'medium',
          vulnerability_type: (finding.vulnerability_type as string) || '未知',
          file_path: finding.file_path as string,
          line_start: finding.line_start as number,
          description: finding.description as string,
          is_verified: (finding.is_verified as boolean) || false,
        }
      });
    },
    onComplete: () => {
      setCurrentPhase('reporting');
      dispatch({ type: 'ADD_LOG', payload: { type: 'info', title: '审计已完成', phase: 'reporting' } });
      loadTask();
      loadFindings();
      loadAgentTree();
    },
    onError: (err: string) => {
      dispatch({ type: 'ADD_LOG', payload: { type: 'error', title: `错误: ${err}`, phase: currentPhase } });
    },
  }), [afterSequence, dispatch, loadTask, loadFindings, loadAgentTree, debouncedLoadAgentTree,
    updateLog, removeLog, getCurrentAgentName, getCurrentThinkingId,
    setCurrentAgentName, setCurrentThinkingId, currentPhase, setCurrentPhase]);

  const { connect: connectStream, disconnect: disconnectStream, isConnected } = useAgentStream(taskId || null, streamOptions);

  useEffect(() => {
    disconnectStreamRef.current = disconnectStream;
  }, [disconnectStream]);

  // ============ Effects ============

  // 状态动画
  useEffect(() => {
    if (!isRunning) return;
    const dotTimer = setInterval(() => setStatusDots(d => (d + 1) % 4), 500);
    const verbTimer = setInterval(() => {
      setStatusVerb(ACTION_VERBS[Math.floor(Math.random() * ACTION_VERBS.length)]);
    }, 5000);
    return () => {
      clearInterval(dotTimer);
      clearInterval(verbTimer);
    };
  }, [isRunning]);

  // 初始加载
  useEffect(() => {
    if (!taskId) {
      setShowSplash(true);
      return;
    }
    setShowSplash(false);
    setLoading(true);
    setHistoricalEventsLoaded(false);

    const loadAllData = async () => {
      try {
        await Promise.all([loadTask(), loadFindings(), loadAgentTree()]);
        const eventsLoaded = await loadHistoricalEvents();
        setHistoricalEventsLoaded(true);
      } catch (error) {
        console.error('[AgentAudit] 加载数据失败:', error);
        setHistoricalEventsLoaded(true);
      } finally {
        setLoading(false);
      }
    };

    loadAllData();
  }, [taskId, loadTask, loadFindings, loadAgentTree, loadHistoricalEvents, setLoading]);

  // 流连接
  useEffect(() => {
    if (!taskId || !task?.status || task.status !== 'running') return;
    if (!historicalEventsLoaded) return;
    if (hasConnectedRef.current) return;

    hasConnectedRef.current = true;
    connectStream();
    dispatch({ type: 'ADD_LOG', payload: { type: 'info', title: '已连接到审计流', phase: currentPhase } });

    return () => {
      disconnectStream();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId, task?.status, historicalEventsLoaded, connectStream, disconnectStream, dispatch]);

  // 轮询
  useEffect(() => {
    if (!taskId || !isRunning) return;
    const interval = setInterval(loadAgentTree, POLLING_INTERVALS.AGENT_TREE);
    return () => clearInterval(interval);
  }, [taskId, isRunning, loadAgentTree]);

  useEffect(() => {
    if (!taskId || !isRunning) return;
    const interval = setInterval(loadTask, POLLING_INTERVALS.TASK_STATS);
    return () => clearInterval(interval);
  }, [taskId, isRunning, loadTask]);

  // ============ Handlers ============

  const handleAgentSelect = useCallback((agentId: string) => {
    if (selectedAgentId === agentId) {
      selectAgent(null);
    } else {
      selectAgent(agentId);
    }
  }, [selectedAgentId, selectAgent]);

  const handleCancel = async () => {
    if (!taskId || isCancelling) return;
    setIsCancelling(true);
    dispatch({ type: 'ADD_LOG', payload: { type: 'info', title: '请求终止任务...', phase: currentPhase } });

    try {
      await cancelAgentTask(taskId);
      toast.success("已请求终止任务");
      dispatch({ type: 'ADD_LOG', payload: { type: 'info', title: '任务终止已确认', phase: currentPhase } });
      await loadTask();
      disconnectStream();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      toast.error(`终止任务失败: ${errorMessage}`);
      dispatch({ type: 'ADD_LOG', payload: { type: 'error', title: `终止失败: ${errorMessage}`, phase: currentPhase } });
    } finally {
      setIsCancelling(false);
    }
  };

  const handleExportReport = () => {
    if (!task) return;
    setShowExportDialog(true);
  };

  // ============ Render ============

  if (showSplash && !taskId) {
    return (
      <>
        <SplashScreen onComplete={() => setShowCreateDialog(true)} />
        <CreateAgentTaskDialog open={showCreateDialog} onOpenChange={setShowCreateDialog} />
      </>
    );
  }

  if (isLoading && !task) {
    return (
      <div className="h-screen bg-white flex items-center justify-center font-sans">
        <div className="flex items-center gap-2 text-slate-400">
          <div className="loading-spinner" />
          <span className="text-sm">加载审计任务...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-white flex flex-col overflow-hidden font-sans">
      {/* 顶部信息栏 */}
      <Header
        task={task}
        isRunning={isRunning}
        isCancelling={isCancelling}
        onCancel={handleCancel}
      />

      {/* 阶段步骤条 + 统计 */}
      <div className="border-b border-slate-100 px-6 py-2.5 flex items-center justify-between">
        <PhaseTimeline
          currentPhase={currentPhase}
          completedPhases={completedPhases}
          isRunning={isRunning}
          isComplete={isComplete}
          phaseLogMap={phaseLogMap}
        />
        <StatsPanel task={task} findings={findings} />
      </div>

      {/* 主内容区 */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        {/* 日志流和代码分析 - 左右各占50% */}
        <div className="h-[40%] min-h-0 grid grid-cols-2 gap-4 overflow-hidden px-4 py-2">
          <LogStream
            currentPhase={currentPhase}
            completedPhases={completedPhases}
            isRunning={isRunning}
            isComplete={isComplete}
            phaseLogMap={phaseLogMap}
            expandedLogIds={expandedLogIds}
            onToggleLogExpanded={toggleLogExpanded}
            isAutoScroll={isAutoScroll}
            onToggleAutoScroll={() => setAutoScroll(!isAutoScroll)}
            scrollRef={phaseScrollRef}
          />
          <CodeAnalysisPanel taskId={taskId!} taskType="agent" />
        </div>

        {/* 分界线 */}
        <div className="h-1.5 bg-slate-200 mx-4 rounded-full" />

        {/* 问题列表 */}
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-700">问题列表</span>
              <span className="text-xs font-medium text-slate-600">{findings.length}</span>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <FindingsTable
              findings={findings}
              taskId={taskId}
              onViewDetail={handleViewFindingDetail}
              onStatusChange={handleFindingStatusChange}
            />
          </div>
        </div>
      </div>

      {/* 创建对话框 */}
      <CreateAgentTaskDialog open={showCreateDialog} onOpenChange={setShowCreateDialog} />

      {/* 导出对话框 */}
      <ReportExportDialog
        open={showExportDialog}
        onOpenChange={setShowExportDialog}
        task={task}
        findings={findings}
      />

      {/* 问题详情 Sheet */}
      <IssueDetailSheet
        open={detailOpen}
        onOpenChange={setDetailOpen}
        agentFinding={selectedFinding as any}
      />
    </div>
  );
}

// 错误边界包装
export default function AgentAuditPage() {
  const { taskId } = useParams<{ taskId: string }>();

  return (
    <AgentErrorBoundary
      taskId={taskId}
      onRetry={() => window.location.reload()}
    >
      <AgentAuditPageContent />
    </AgentErrorBoundary>
  );
}
