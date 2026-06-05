/**
 * System Config Component
 * Cyberpunk Terminal Aesthetic
 */

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import {
  Settings, Save, RotateCcw, CheckCircle2, AlertCircle,
  Info, MessageSquare, Globe, PlayCircle, VectorSquare, Key, Copy, Trash2, Terminal, ServerCrash
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/shared/api/database";
import EmbeddingConfig from "@/components/agent/EmbeddingConfig";
import { generateSSHKey, getSSHKey, deleteSSHKey, testSSHKey, clearKnownHosts } from "@/shared/api/sshKeys";

// LLM Providers - 2025
const LLM_PROVIDERS = [
  { value: 'openai', label: 'OpenAI GPT', icon: '🟢', category: 'litellm', hint: 'gpt-5, gpt-5-mini, o3 等', defaultBaseUrl: 'https://api.openai.com/v1' },
  { value: 'claude', label: 'Anthropic Claude', icon: '🟣', category: 'litellm', hint: 'claude-sonnet-4.5, claude-opus-4 等', defaultBaseUrl: 'https://api.anthropic.com' },
  { value: 'gemini', label: 'Google Gemini', icon: '🔵', category: 'litellm', hint: 'gemini-3-pro, gemini-3-flash 等', defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1beta' },
  { value: 'deepseek', label: 'DeepSeek', icon: '🔷', category: 'litellm', hint: 'deepseek-v3.1-terminus, deepseek-v3 等', defaultBaseUrl: 'https://api.deepseek.com' },
  { value: 'qwen', label: '通义千问', icon: '🟠', category: 'litellm', hint: 'qwen3-max-instruct, qwen3-plus 等', defaultBaseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1' },
  { value: 'zhipu', label: '智谱AI', icon: '🔴', category: 'litellm', hint: 'glm-4.6, glm-4.5-flash 等', defaultBaseUrl: 'https://open.bigmodel.cn/api/paas/v4' },
  { value: 'moonshot', label: 'Moonshot', icon: '🌙', category: 'litellm', hint: 'kimi-k2, kimi-k1.5 等', defaultBaseUrl: 'https://api.moonshot.cn/v1' },
  { value: 'ollama', label: 'Ollama 本地', icon: '🖥️', category: 'litellm', hint: 'llama3.3-70b, qwen3-8b 等', defaultBaseUrl: 'http://localhost:11434' },
  { value: 'baidu', label: '百度文心', icon: '📘', category: 'native', hint: 'ernie-4.5 (需要 API_KEY:SECRET_KEY)', defaultBaseUrl: 'https://aip.baidubce.com' },
  { value: 'minimax', label: 'MiniMax', icon: '⚡', category: 'native', hint: 'minimax-m2, minimax-m1 等', defaultBaseUrl: 'https://api.minimax.chat/v1' },
  { value: 'doubao', label: '字节豆包', icon: '🎯', category: 'native', hint: 'doubao-1.6-pro, doubao-1.5-pro 等', defaultBaseUrl: 'https://ark.cn-beijing.volces.com/api/v3' },
];

const DEFAULT_MODELS: Record<string, string> = {
  openai: 'gpt-5', claude: 'claude-sonnet-4.5', gemini: 'gemini-3-pro',
  deepseek: 'deepseek-v3.1-terminus', qwen: 'qwen3-max-instruct', zhipu: 'glm-4.6', moonshot: 'kimi-k2',
  ollama: 'llama3.3-70b', baidu: 'ernie-4.5', minimax: 'minimax-m2', doubao: 'doubao-1.6-pro',
};

interface SystemConfigData {
  llmProvider: string; llmApiKey: string; llmModel: string; llmBaseUrl: string;
  llmTimeout: number; llmTemperature: number; llmMaxTokens: number;
  // Agent超时配置
  llmFirstTokenTimeout: number; llmStreamTimeout: number;
  agentTimeout: number; subAgentTimeout: number; toolTimeout: number;
  githubToken: string; gitlabToken: string; giteaToken: string;
  maxAnalyzeFiles: number; llmConcurrency: number; llmGapMs: number; outputLanguage: string;
}

export function SystemConfig() {
  const [config, setConfig] = useState<SystemConfigData | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasChanges, setHasChanges] = useState(false);
  const [testingLLM, setTestingLLM] = useState(false);
  const [llmTestResult, setLlmTestResult] = useState<{ success: boolean; message: string; debug?: Record<string, unknown> } | null>(null);
  const [showDebugInfo, setShowDebugInfo] = useState(true);

  // 仓库类型选择
  const [selectedRepoType, setSelectedRepoType] = useState<string>("");

  // SSH Key states
  const [sshKey, setSSHKey] = useState<{ has_key: boolean; public_key?: string; fingerprint?: string }>({ has_key: false });
  const [generatingKey, setGeneratingKey] = useState(false);
  const [deletingKey, setDeletingKey] = useState(false);
  const [clearingKnownHosts, setClearingKnownHosts] = useState(false);
  const [testingKey, setTestingKey] = useState(false);
  const [testRepoUrl, setTestRepoUrl] = useState("");
  const [showDeleteKeyDialog, setShowDeleteKeyDialog] = useState(false);

  useEffect(() => { loadConfig(); loadSSHKey(); }, []);

  const loadConfig = async () => {
    try {
      setLoading(true);
      console.log('[SystemConfig] 开始加载配置...');

      const backendConfig = await api.getUserConfig();

      console.log('[SystemConfig] 后端返回的原始数据:', JSON.stringify(backendConfig, null, 2));

      if (backendConfig) {
        const llmConfig = backendConfig.llmConfig || {};
        const otherConfig = backendConfig.otherConfig || {};

        const newConfig = {
          llmProvider: llmConfig.llmProvider || '',
          llmApiKey: llmConfig.llmApiKey || '',
          llmModel: llmConfig.llmModel || (llmConfig.llmProvider ? DEFAULT_MODELS[llmConfig.llmProvider] || '' : ''),
          llmBaseUrl: llmConfig.llmBaseUrl || (llmConfig.llmProvider ? LLM_PROVIDERS.find(p => p.value === llmConfig.llmProvider)?.defaultBaseUrl || '' : ''),
          llmTimeout: llmConfig.llmTimeout || 150000,
          llmTemperature: llmConfig.llmTemperature ?? 0.1,
          llmMaxTokens: llmConfig.llmMaxTokens || 4096,
          // Agent超时配置
          llmFirstTokenTimeout: llmConfig.llmFirstTokenTimeout || 30,
          llmStreamTimeout: llmConfig.llmStreamTimeout || 60,
          agentTimeout: llmConfig.agentTimeout || 1800,
          subAgentTimeout: llmConfig.subAgentTimeout || 600,
          toolTimeout: llmConfig.toolTimeout || 60,
          githubToken: otherConfig.githubToken || '',
          gitlabToken: otherConfig.gitlabToken || '',
          giteaToken: otherConfig.giteaToken || '',
          maxAnalyzeFiles: otherConfig.maxAnalyzeFiles ?? 0,
          llmConcurrency: otherConfig.llmConcurrency || 3,
          llmGapMs: otherConfig.llmGapMs || 2000,
          outputLanguage: otherConfig.outputLanguage || 'zh-CN',
        };

        console.log('[SystemConfig] 解析后的配置:', newConfig);
        setConfig(newConfig);

        // 根据已保存的 token 自动设置仓库类型
        if (newConfig.giteaToken) {
          setSelectedRepoType('gitea');
        } else if (newConfig.gitlabToken) {
          setSelectedRepoType('gitlab');
        } else if (newConfig.githubToken) {
          setSelectedRepoType('github');
        }

        console.log('✓ 配置已加载:', {
          provider: llmConfig.llmProvider,
          hasApiKey: !!llmConfig.llmApiKey,
          model: llmConfig.llmModel,
        });
      } else {
        console.warn('[SystemConfig] 后端返回空数据，使用默认配置');
        setConfig({
          llmProvider: '', llmApiKey: '', llmModel: '', llmBaseUrl: '',
          llmTimeout: 150000, llmTemperature: 0.1, llmMaxTokens: 4096,
          llmFirstTokenTimeout: 30, llmStreamTimeout: 60,
          agentTimeout: 1800, subAgentTimeout: 600, toolTimeout: 60,
          githubToken: '', gitlabToken: '', giteaToken: '',
          maxAnalyzeFiles: 0, llmConcurrency: 3, llmGapMs: 2000, outputLanguage: 'zh-CN',
        });
      }
    } catch (error) {
      console.error('Failed to load config:', error);
      setConfig({
        llmProvider: '', llmApiKey: '', llmModel: '', llmBaseUrl: '',
        llmTimeout: 150000, llmTemperature: 0.1, llmMaxTokens: 4096,
        llmFirstTokenTimeout: 30, llmStreamTimeout: 60,
        agentTimeout: 1800, subAgentTimeout: 600, toolTimeout: 60,
        githubToken: '', gitlabToken: '', giteaToken: '',
        maxAnalyzeFiles: 0, llmConcurrency: 3, llmGapMs: 2000, outputLanguage: 'zh-CN',
      });
    } finally {
      setLoading(false);
    }
  };

  // SSH Key functions
  const loadSSHKey = async () => {
    try {
      const data = await getSSHKey();
      setSSHKey(data);
    } catch (error) {
      console.error('Failed to load SSH key:', error);
    }
  };

  const handleGenerateSSHKey = async () => {
    try {
      setGeneratingKey(true);
      const data = await generateSSHKey();
      setSSHKey({ has_key: true, public_key: data.public_key, fingerprint: data.fingerprint });
      toast.success(data.message);
    } catch (error: any) {
      console.error('Failed to generate SSH key:', error);
      toast.error(error.response?.data?.detail || "生成SSH密钥失败");
    } finally {
      setGeneratingKey(false);
    }
  };

  const handleDeleteSSHKey = async () => {
    try {
      setDeletingKey(true);
      await deleteSSHKey();
      setSSHKey({ has_key: false });
      toast.success("SSH密钥已删除");
      setShowDeleteKeyDialog(false);
    } catch (error: any) {
      console.error('Failed to delete SSH key:', error);
      toast.error(error.response?.data?.detail || "删除SSH密钥失败");
    } finally {
      setDeletingKey(false);
    }
  };

  const handleTestSSHKey = async () => {
    if (!testRepoUrl) {
      toast.error("请输入仓库URL");
      return;
    }
    try {
      setTestingKey(true);
      const result = await testSSHKey(testRepoUrl);
      if (result.success) {
        toast.success("SSH连接测试成功");
        if (result.output) {
          console.log("SSH测试输出:", result.output);
        }
      } else {
        toast.error(result.message || "SSH连接测试失败", {
          description: result.output || undefined,
          duration: 8000,
        });
        if (result.output) {
          console.error("SSH测试失败:", result.output);
        }
      }
    } catch (error: any) {
      console.error('Failed to test SSH key:', error);
      toast.error(error.response?.data?.detail || "测试SSH密钥失败");
    } finally {
      setTestingKey(false);
    }
  };

  const handleClearKnownHosts = async () => {
    try {
      setClearingKnownHosts(true);
      const result = await clearKnownHosts();
      if (result.success) {
        toast.success(result.message || "known_hosts已清理");
      } else {
        toast.error("清理known_hosts失败");
      }
    } catch (error: any) {
      console.error('Failed to clear known_hosts:', error);
      toast.error(error.response?.data?.detail || "清理known_hosts失败");
    } finally {
      setClearingKnownHosts(false);
    }
  };

  const handleCopyPublicKey = () => {
    if (sshKey.public_key) {
      navigator.clipboard.writeText(sshKey.public_key);
      toast.success("公钥已复制到剪贴板");
    }
  };

  const saveConfig = async () => {
    if (!config) return;
    try {
      const savedConfig = await api.updateUserConfig({
        llmConfig: {
          llmProvider: config.llmProvider, llmApiKey: config.llmApiKey,
          llmModel: config.llmModel, llmBaseUrl: config.llmBaseUrl,
          llmTimeout: config.llmTimeout, llmTemperature: config.llmTemperature,
          llmMaxTokens: config.llmMaxTokens,
          // Agent超时配置
          llmFirstTokenTimeout: config.llmFirstTokenTimeout,
          llmStreamTimeout: config.llmStreamTimeout,
          agentTimeout: config.agentTimeout,
          subAgentTimeout: config.subAgentTimeout,
          toolTimeout: config.toolTimeout,
        },
        otherConfig: {
          githubToken: config.githubToken, gitlabToken: config.gitlabToken, giteaToken: config.giteaToken,
          maxAnalyzeFiles: config.maxAnalyzeFiles, llmConcurrency: config.llmConcurrency,
          llmGapMs: config.llmGapMs, outputLanguage: config.outputLanguage,
        },
      });

      if (savedConfig) {
        const llmConfig = savedConfig.llmConfig || {};
        const otherConfig = savedConfig.otherConfig || {};
        const newConfig = {
          llmProvider: llmConfig.llmProvider || config.llmProvider,
          llmApiKey: llmConfig.llmApiKey || '',
          llmModel: llmConfig.llmModel || '',
          llmBaseUrl: llmConfig.llmBaseUrl || '',
          llmTimeout: llmConfig.llmTimeout || 150000,
          llmTemperature: llmConfig.llmTemperature ?? 0.1,
          llmMaxTokens: llmConfig.llmMaxTokens || 4096,
          // Agent超时配置
          llmFirstTokenTimeout: llmConfig.llmFirstTokenTimeout || 30,
          llmStreamTimeout: llmConfig.llmStreamTimeout || 60,
          agentTimeout: llmConfig.agentTimeout || 1800,
          subAgentTimeout: llmConfig.subAgentTimeout || 600,
          toolTimeout: llmConfig.toolTimeout || 60,
          githubToken: otherConfig.githubToken || '',
          gitlabToken: otherConfig.gitlabToken || '',
          giteaToken: otherConfig.giteaToken || '',
          maxAnalyzeFiles: otherConfig.maxAnalyzeFiles ?? 0,
          llmConcurrency: otherConfig.llmConcurrency || 3,
          llmGapMs: otherConfig.llmGapMs || 2000,
          outputLanguage: otherConfig.outputLanguage || 'zh-CN',
        };
        setConfig(newConfig);

        // 保存后也根据返回的 token 恢复仓库类型选择
        if (newConfig.giteaToken) {
          setSelectedRepoType('gitea');
        } else if (newConfig.gitlabToken) {
          setSelectedRepoType('gitlab');
        } else if (newConfig.githubToken) {
          setSelectedRepoType('github');
        }
      }

      setHasChanges(false);
      toast.success("配置已保存！");
    } catch (error) {
      toast.error(`保存失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  const resetConfig = async () => {
    if (!window.confirm("确定要重置为默认配置吗？")) return;
    try {
      await api.deleteUserConfig();
      await loadConfig();
      setHasChanges(false);
      toast.success("已重置为默认配置");
    } catch (error) {
      toast.error(`重置失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  const updateConfig = (key: keyof SystemConfigData, value: string | number) => {
    if (!config) return;
    setConfig(prev => prev ? { ...prev, [key]: value } : null);
    setHasChanges(true);
  };

  const testLLMConnection = async () => {
    if (!config) return;
    if (!config.llmProvider) {
      toast.error('请先选择模型服务商');
      return;
    }
    if (!config.llmApiKey && config.llmProvider !== 'ollama') {
      toast.error('请先配置 API 密钥');
      return;
    }
    setTestingLLM(true);
    setLlmTestResult(null);
    try {
      const result = await api.testLLMConnection({
        provider: config.llmProvider,
        apiKey: config.llmApiKey,
        model: config.llmModel || undefined,
        baseUrl: config.llmBaseUrl || undefined,
      });
      setLlmTestResult(result);
      if (result.success) toast.success(`连接成功！模型: ${result.model}`);
      else toast.error(`连接失败: ${result.message}`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : '未知错误';
      setLlmTestResult({ success: false, message: msg });
      toast.error(`测试失败: ${msg}`);
    } finally {
      setTestingLLM(false);
    }
  };

  if (loading || !config) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <div className="loading-spinner mx-auto" />
          <p className="text-muted-foreground font-sans text-sm uppercase tracking-wider">加载配置中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 添加LLM模型 */}
        <div className="cyber-card p-6 space-y-6">
          <div className="flex items-center gap-2 mb-2">
            <MessageSquare className="w-4 h-4 text-primary" />
            <h3 className="text-lg font-semibold text-foreground uppercase tracking-wider">添加LLM模型</h3>
          </div>

          {/* 1. 服务商 */}
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground uppercase">服务商</Label>
            <Select value={config.llmProvider} onValueChange={(v) => {
	              const provider = LLM_PROVIDERS.find(p => p.value === v);
	              // 切换服务商时自动填充默认 Base URL 和默认模型
	              updateConfig('llmProvider', v);
	              if (provider?.defaultBaseUrl) updateConfig('llmBaseUrl', provider.defaultBaseUrl);
	              if (DEFAULT_MODELS[v]) updateConfig('llmModel', DEFAULT_MODELS[v]);
	            }}>
              <SelectTrigger className="h-10 cyber-input">
                <SelectValue placeholder="请选择服务商" />
              </SelectTrigger>
              <SelectContent className="cyber-dialog border-border">
                {[...LLM_PROVIDERS].sort((a, b) => a.label.localeCompare(b.label)).map(p => (
                  <SelectItem key={p.value} value={p.value} className="font-sans">
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 2. 模型名称 */}
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground uppercase">模型名称</Label>
            <Input
              value={config.llmModel}
              onChange={(e) => updateConfig('llmModel', e.target.value)}
              placeholder={DEFAULT_MODELS[config.llmProvider] || '请填写模型名称'}
              className="h-10 cyber-input"
            />
          </div>

          {/* 3. API URL */}
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground uppercase">API URL</Label>
            <Input
              value={config.llmBaseUrl}
              onChange={(e) => updateConfig('llmBaseUrl', e.target.value)}
              placeholder={LLM_PROVIDERS.find(p => p.value === config.llmProvider)?.defaultBaseUrl || '请填写API URL'}
              className="h-10 cyber-input"
            />
          </div>

          {/* 4. API密钥 */}
          {config.llmProvider !== 'ollama' && (
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground uppercase">API密钥</Label>
              <Input
                type="text"
                value={config.llmApiKey}
                onChange={(e) => updateConfig('llmApiKey', e.target.value)}
                placeholder="请填写API密钥"
                className="h-10 cyber-input"
              />
            </div>
          )}

          {/* 随机性 */}
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground uppercase">随机性</Label>
            <Input
              type="number"
              step="0.1"
              min="0"
              max="2"
              value={config.llmTemperature}
              onChange={(e) => updateConfig('llmTemperature', Number(e.target.value))}
              className="h-10 cyber-input"
            />
          </div>

          {/* Test Connection */}
          <div className="pt-4 border-t border-border border-dashed flex justify-end">
            <Button
              onClick={testLLMConnection}
              disabled={testingLLM || (!config.llmApiKey && config.llmProvider !== 'ollama')}
              className="cyber-btn-primary h-10"
            >
              {testingLLM ? (
                <>
                  <div className="loading-spinner w-4 h-4 mr-2" />
                  测试中...
                </>
              ) : (
                <>
                  <PlayCircle className="w-4 h-4 mr-2" />
                  测试连接
                </>
              )}
            </Button>
          </div>
          {llmTestResult && (
            <div className={`p-3 rounded-lg ${llmTestResult.success ? 'bg-primary/10 border border-primary/25' : 'bg-destructive/8 border border-destructive/25'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm">
                  {llmTestResult.success ? (
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-destructive" />
                  )}
                  <span className={llmTestResult.success ? 'text-emerald-300/80' : 'text-rose-300/80'}>
                    {llmTestResult.message}
                  </span>
                </div>
                {llmTestResult.debug && (
                  <button
                    onClick={() => setShowDebugInfo(!showDebugInfo)}
                    className="text-xs text-muted-foreground hover:text-foreground underline"
                  >
                    {showDebugInfo ? '隐藏调试信息' : '显示调试信息'}
                  </button>
                )}
              </div>
              {showDebugInfo && llmTestResult.debug && (
                <div className="mt-3 pt-3 border-t border-border/50">
                  <div className="text-xs font-sans space-y-1 text-muted-foreground">
                    <div className="font-bold text-foreground mb-2">连接信息:</div>
                    <div>Provider: <span className="text-foreground">{String(llmTestResult.debug.provider)}</span></div>
                    <div>Model: <span className="text-foreground">{String(llmTestResult.debug.model_used || llmTestResult.debug.model_requested || 'N/A')}</span></div>
                    <div>Base URL: <span className="text-foreground">{String(llmTestResult.debug.base_url_used || llmTestResult.debug.base_url_requested || '(default)')}</span></div>
                    <div>Adapter: <span className="text-foreground">{String(llmTestResult.debug.adapter_type || 'N/A')}</span></div>
                    <div>API Key: <span className="text-foreground">{String(llmTestResult.debug.api_key_prefix)} (长度: {String(llmTestResult.debug.api_key_length)})</span></div>
                    <div>耗时: <span className="text-foreground">{String(llmTestResult.debug.elapsed_time_ms || 'N/A')} ms</span></div>

                    {llmTestResult.debug.saved_config && (
                      <div className="mt-3 pt-2 border-t border-border/30">
                        <div className="font-bold text-secondary mb-2">已保存的配置参数:</div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                          <div>温度: <span className="text-foreground">{String((llmTestResult.debug.saved_config as Record<string, unknown>).temperature ?? 'N/A')}</span></div>
                          <div>最大Tokens: <span className="text-foreground">{String((llmTestResult.debug.saved_config as Record<string, unknown>).max_tokens ?? 'N/A')}</span></div>
                          <div>超时: <span className="text-foreground">{String((llmTestResult.debug.saved_config as Record<string, unknown>).timeout_ms ?? 'N/A')} ms</span></div>
                          <div>请求间隔: <span className="text-foreground">{String((llmTestResult.debug.saved_config as Record<string, unknown>).gap_ms ?? 'N/A')} ms</span></div>
                          <div>并发数: <span className="text-foreground">{String((llmTestResult.debug.saved_config as Record<string, unknown>).concurrency ?? 'N/A')}</span></div>
                          <div>最大文件数: <span className="text-foreground">{String((llmTestResult.debug.saved_config as Record<string, unknown>).max_analyze_files ?? 'N/A')}</span></div>
                          <div>输出语言: <span className="text-foreground">{String((llmTestResult.debug.saved_config as Record<string, unknown>).output_language ?? 'N/A')}</span></div>
                        </div>
                      </div>
                    )}

                    {llmTestResult.debug.test_params && (
                      <div className="mt-2 pt-2 border-t border-border/30">
                        <div className="font-bold text-primary mb-2">测试时使用的参数:</div>
                        <div className="grid grid-cols-3 gap-x-4">
                          <div>温度: <span className="text-foreground">{String((llmTestResult.debug.test_params as Record<string, unknown>).temperature ?? 'N/A')}</span></div>
                          <div>超时: <span className="text-foreground">{String((llmTestResult.debug.test_params as Record<string, unknown>).timeout ?? 'N/A')}s</span></div>
                          <div>MaxTokens: <span className="text-foreground">{String((llmTestResult.debug.test_params as Record<string, unknown>).max_tokens ?? 'N/A')}</span></div>
                        </div>
                      </div>
                    )}

                    {llmTestResult.debug.error_category && (
                      <div className="mt-2">错误类型: <span className="text-destructive">{String(llmTestResult.debug.error_category)}</span></div>
                    )}
                    {llmTestResult.debug.error_type && (
                      <div>异常类型: <span className="text-destructive">{String(llmTestResult.debug.error_type)}</span></div>
                    )}
                    {llmTestResult.debug.status_code && (
                      <div>HTTP 状态码: <span className="text-destructive">{String(llmTestResult.debug.status_code)}</span></div>
                    )}
                    {llmTestResult.debug.api_response && (
                      <div className="mt-2">
                        <div className="font-bold text-warning">API 服务器返回:</div>
                        <pre className="mt-1 p-2 bg-warning/8 border border-warning/25 rounded text-xs overflow-x-auto">
                          {String(llmTestResult.debug.api_response)}
                        </pre>
                      </div>
                    )}
                    {llmTestResult.debug.error_message && (
                      <div className="mt-2">
                        <div className="font-bold text-foreground">完整错误信息:</div>
                        <pre className="mt-1 p-2 bg-background/50 rounded text-xs overflow-x-auto max-h-32 overflow-y-auto">
                          {String(llmTestResult.debug.error_message)}
                        </pre>
                      </div>
                    )}
                    {llmTestResult.debug.traceback && (
                      <details className="mt-2">
                        <summary className="cursor-pointer text-muted-foreground hover:text-foreground">完整堆栈跟踪</summary>
                        <pre className="mt-1 p-2 bg-background/50 rounded text-xs overflow-x-auto max-h-48 overflow-y-auto whitespace-pre-wrap">
                          {String(llmTestResult.debug.traceback)}
                        </pre>
                      </details>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="cyber-card p-6 space-y-6">
          <div className="flex items-center gap-2 mb-2">
            <VectorSquare className="w-4 h-4 text-primary" />
            <h3 className="text-lg font-semibold text-foreground uppercase tracking-wider">添加embedding模型</h3>
          </div>
          <EmbeddingConfig />
        </div>

        {/* 并发配置 */}
        <div className="cyber-card p-6 space-y-6">
          <div className="flex items-center gap-2 mb-2">
            <Settings className="w-4 h-4 text-primary" />
            <h3 className="text-lg font-semibold text-foreground uppercase tracking-wider">并发配置</h3>
          </div>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground uppercase">并发文件数</Label>
              <Input
                type="number"
                value={config.maxAnalyzeFiles}
                onChange={(e) => updateConfig('maxAnalyzeFiles', Number(e.target.value))}
                className="h-10 cyber-input"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground uppercase">模型并发数</Label>
              <Input
                type="number"
                value={config.llmConcurrency}
                onChange={(e) => updateConfig('llmConcurrency', Number(e.target.value))}
                className="h-10 cyber-input"
              />
            </div>
          </div>
        </div>

        {/* 仓库配置 */}
        <div className="cyber-card p-6 space-y-6">
          <div className="flex items-center gap-2 mb-2">
            <Globe className="w-4 h-4 text-primary" />
            <h3 className="text-lg font-semibold text-foreground uppercase tracking-wider">仓库配置</h3>
          </div>
          <div className="space-y-4">
            {/* 仓库类型选择 */}
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground uppercase">仓库类型</Label>
              <Select value={selectedRepoType} onValueChange={setSelectedRepoType}>
                <SelectTrigger className="h-10 cyber-input">
                  <SelectValue placeholder="请选择仓库类型" />
                </SelectTrigger>
                <SelectContent className="cyber-dialog border-border">
                  <SelectItem value="github" className="font-sans">GitHub</SelectItem>
                  <SelectItem value="gitlab" className="font-sans">GitLab</SelectItem>
                  <SelectItem value="gitea" className="font-sans">Gitea</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 根据选择显示对应的 Token 配置 */}
            {selectedRepoType === 'github' && (
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground uppercase">Token</Label>
                <div className="flex gap-2">
                  <Input
                    type="password"
                    value={config.githubToken === '__CLEAR__' ? '' : config.githubToken}
                    onChange={(e) => updateConfig('githubToken', e.target.value)}
                    placeholder="请填写仓库token"
                    className="h-10 cyber-input"
                  />
                  {config.githubToken && config.githubToken !== '__CLEAR__' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => updateConfig('githubToken', '__CLEAR__')}
                      className="cyber-btn-outline h-10 whitespace-nowrap"
                      title="清除Token"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            )}
            {selectedRepoType === 'gitlab' && (
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground uppercase">Token</Label>
                <div className="flex gap-2">
                  <Input
                    type="password"
                    value={config.gitlabToken === '__CLEAR__' ? '' : config.gitlabToken}
                    onChange={(e) => updateConfig('gitlabToken', e.target.value)}
                    placeholder="请填写仓库token"
                    className="h-10 cyber-input"
                  />
                  {config.gitlabToken && config.gitlabToken !== '__CLEAR__' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => updateConfig('gitlabToken', '__CLEAR__')}
                      className="cyber-btn-outline h-10 whitespace-nowrap"
                      title="清除Token"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            )}
            {selectedRepoType === 'gitea' && (
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground uppercase">Token</Label>
                <div className="flex gap-2">
                  <Input
                    type="password"
                    value={config.giteaToken === '__CLEAR__' ? '' : config.giteaToken}
                    onChange={(e) => updateConfig('giteaToken', e.target.value)}
                    placeholder="请填写仓库token"
                    className="h-10 cyber-input"
                  />
                  {config.giteaToken && config.giteaToken !== '__CLEAR__' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => updateConfig('giteaToken', '__CLEAR__')}
                      className="cyber-btn-outline h-10 whitespace-nowrap"
                      title="清除Token"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* SSH Key Management */}
          <div className="pt-4 border-t border-border border-dashed space-y-4">
            <div className="flex items-center gap-3">
              <Key className="w-4 h-4 text-primary" />
              <h4 className="text-base font-medium uppercase tracking-wider text-foreground">SSH 密钥管理</h4>
            </div>

            {!sshKey.has_key ? (
              <div className="text-center py-6">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-muted/50 mb-3">
                  <Key className="w-6 h-6 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground mb-3">尚未生成 SSH 密钥</p>
                <Button
                  onClick={handleGenerateSSHKey}
                  disabled={generatingKey}
                  className="cyber-btn-primary h-10"
                >
                  {generatingKey ? (
                    <>
                      <div className="loading-spinner w-4 h-4 mr-2" />
                      生成中...
                    </>
                  ) : (
                    <>
                      <Key className="w-4 h-4 mr-2" />
                      生成 SSH 密钥
                    </>
                  )}
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Public Key Display */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-medium text-muted-foreground uppercase flex items-center gap-2">
                      <CheckCircle2 className="w-3 h-3 text-primary" />
                      SSH 公钥
                    </Label>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleCopyPublicKey}
                      className="h-8 text-xs"
                    >
                      <Copy className="w-3 h-3 mr-1" />
                      复制
                    </Button>
                  </div>
                  <Textarea
                    value={sshKey.public_key || ""}
                    readOnly
                    className="cyber-input font-sans text-xs h-24 resize-none"
                  />

                  {sshKey.fingerprint && (
                    <div className="p-2 bg-muted/50 rounded border border-border">
                      <Label className="text-xs font-medium text-muted-foreground uppercase mb-1 block">
                        公钥指纹 (SHA256)
                      </Label>
                      <code className="text-xs text-primary font-mono break-all">
                        {sshKey.fingerprint}
                      </code>
                    </div>
                  )}

                  <p className="text-xs text-muted-foreground">
                    请将此公钥添加到 <a href="https://github.com/settings/keys" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">GitHub</a> 或 <a href="https://gitlab.com/-/profile/keys" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">GitLab</a> 账户
                  </p>
                </div>

                {/* Test SSH Connection */}
                <div className="space-y-2 pt-4 border-t border-border">
                  <Label className="text-xs font-medium text-muted-foreground uppercase">
                    测试 SSH 连接
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="git@github.com:username/repo.git"
                      value={testRepoUrl}
                      onChange={(e) => setTestRepoUrl(e.target.value)}
                      className="cyber-input font-sans text-xs"
                    />
                    <Button
                      onClick={handleTestSSHKey}
                      disabled={testingKey}
                      className="cyber-btn-outline whitespace-nowrap"
                    >
                      {testingKey ? (
                        <>
                          <div className="loading-spinner w-4 h-4 mr-2" />
                          测试中...
                        </>
                      ) : (
                        <>
                          <Terminal className="w-4 h-4 mr-2" />
                          测试连接
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                {/* Delete Key and Clear Known Hosts */}
                <div className="flex justify-end gap-2 pt-4 border-t border-border">
                  <Button
                    variant="outline"
                    onClick={handleClearKnownHosts}
                    disabled={clearingKnownHosts}
                    className="cyber-btn-outline h-10"
                  >
                    {clearingKnownHosts ? (
                      <>
                        <div className="loading-spinner w-4 h-4 mr-2" />
                        清理中...
                      </>
                    ) : (
                      <>
                        <ServerCrash className="w-4 h-4 mr-2" />
                        清理 known_hosts
                      </>
                    )}
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => setShowDeleteKeyDialog(true)}
                    className="bg-destructive/12 hover:bg-destructive/20 text-destructive border border-destructive/25 h-10"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    删除密钥
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Floating Save Button */}
      {hasChanges && (
        <div className="fixed bottom-6 right-6 cyber-card p-4 z-50">
          <Button onClick={saveConfig} className="cyber-btn-primary h-12">
            <Save className="w-4 h-4 mr-2" /> 保存所有更改
          </Button>
        </div>
      )}

      {/* Delete SSH Key Confirmation Dialog */}
      <AlertDialog open={showDeleteKeyDialog} onOpenChange={setShowDeleteKeyDialog}>
        <AlertDialogContent className="cyber-card border-destructive/25 cyber-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg font-semibold uppercase text-foreground flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-destructive" />
              确认删除 SSH 密钥？
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              删除后将无法使用 SSH 方式访问 Git 仓库，需要重新生成密钥。此操作不可恢复。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cyber-btn-outline" disabled={deletingKey}>
              取消
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSSHKey}
              disabled={deletingKey}
              className="bg-destructive/12 hover:bg-destructive/20 text-destructive border border-destructive/25"
            >
              {deletingKey ? (
                <>
                  <div className="loading-spinner w-4 h-4 mr-2" />
                  删除中...
                </>
              ) : (
                "确认删除"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
