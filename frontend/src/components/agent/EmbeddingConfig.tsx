/**
 * 嵌入模型配置组件
 * Cyberpunk Terminal Aesthetic
 * 独立于 LLM 配置，专门用于 深度审计的 RAG 系统
 */

import { useState, useEffect } from "react";
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
  Loader2,
  CheckCircle2,
  AlertCircle,
  PlayCircle,
} from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "@/shared/api/serverClient";

interface EmbeddingProvider {
  id: string;
  name: string;
  description: string;
  models: string[];
  requires_api_key: boolean;
  default_model: string;
}

interface EmbeddingConfig {
  provider: string;
  model: string;
  api_key: string | null;
  base_url: string | null;
  dimensions: number;
  batch_size: number;
}

interface TestResult {
  success: boolean;
  message: string;
  dimensions?: number;
  sample_embedding?: number[];
  latency_ms?: number;
}

// 各服务商默认 API URL（完整端点地址，与官方文档一致）
const PROVIDER_DEFAULT_URLS: Record<string, string> = {
  openai: "https://api.openai.com/v1/embeddings",
  azure: "https://your-resource.openai.azure.com",
  ollama: "http://localhost:11434/api/embed",
  cohere: "https://api.cohere.com/v2/embed",
  huggingface: "https://router.huggingface.co",
  jina: "https://api.jina.ai/v1/embeddings",
  qwen: "https://dashscope.aliyuncs.com/api/v1/services/embeddings/text-embedding/text-embedding",
};

export default function EmbeddingConfigPanel() {
  const [providers, setProviders] = useState<EmbeddingProvider[]>([]);
  const [currentConfig, setCurrentConfig] = useState<EmbeddingConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);

  // 表单状态
  const [selectedProvider, setSelectedProvider] = useState("");
  const [selectedModel, setSelectedModel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [customDimension, setCustomDimension] = useState<number | null>(null);
  const [batchSize, setBatchSize] = useState(100);

  // 加载数据
  useEffect(() => {
    loadData();
  }, []);

  // 用户手动切换 provider 时重置模型和 URL 为默认值
  const handleProviderChange = (newProvider: string) => {
    setSelectedProvider(newProvider);
    const provider = providers.find((p) => p.id === newProvider);
    if (provider) {
      setSelectedModel(provider.default_model);
    }
    setBaseUrl(PROVIDER_DEFAULT_URLS[newProvider] || "");
    setApiKey("");
    setTestResult(null);
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [providersRes, configRes] = await Promise.all([
        apiClient.get("/embedding/providers"),
        apiClient.get("/embedding/config"),
      ]);

      setProviders(providersRes.data);
      setCurrentConfig(configRes.data);

      // 设置表单默认值
      if (configRes.data) {
        setSelectedProvider(configRes.data.provider);
        setSelectedModel(configRes.data.model);
        setApiKey(configRes.data.api_key || "");
        setBaseUrl(configRes.data.base_url || "");
        setCustomDimension(configRes.data.dimensions || null);
        setBatchSize(configRes.data.batch_size);
      }
    } catch (error) {
      toast.error("加载配置失败");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!selectedProvider || !selectedModel) {
      toast.error("请选择服务商和模型");
      return;
    }

    const provider = providers.find((p) => p.id === selectedProvider);
    if (provider?.requires_api_key && !apiKey) {
      toast.error(`${provider.name} 需要 API 密钥`);
      return;
    }

    try {
      setSaving(true);
      await apiClient.put("/embedding/config", {
        provider: selectedProvider,
        model: selectedModel,
        api_key: apiKey || undefined,
        base_url: baseUrl || undefined,
        dimensions: customDimension || undefined,
        batch_size: batchSize,
      });

      toast.success("配置已保存");
      await loadData();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!selectedProvider || !selectedModel) {
      toast.error("请选择服务商和模型");
      return;
    }

    try {
      setTesting(true);
      setTestResult(null);

      const response = await apiClient.post("/embedding/test", {
        provider: selectedProvider,
        model: selectedModel,
        api_key: apiKey || undefined,
        base_url: baseUrl || undefined,
        dimension: customDimension || undefined,
      });

      setTestResult(response.data);

      if (response.data.success) {
        toast.success("测试成功");
      } else {
        toast.error("测试失败");
      }
    } catch (error: any) {
      setTestResult({
        success: false,
        message: error.response?.data?.detail || "测试失败",
      });
      toast.error("测试失败");
    } finally {
      setTesting(false);
    }
  };

  const selectedProviderInfo = providers.find((p) => p.id === selectedProvider);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="text-center space-y-4">
          <div className="loading-spinner mx-auto" />
          <p className="text-muted-foreground font-sans text-sm uppercase tracking-wider">加载配置中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 配置表单 */}
      <div className="space-y-6">
        {/* 1. 服务商 */}
        <div className="space-y-2">
          <Label className="text-xs font-medium text-muted-foreground uppercase">服务商</Label>
          <Select value={selectedProvider} onValueChange={handleProviderChange}>
            <SelectTrigger className="h-10 cyber-input">
              <SelectValue placeholder="请选择服务商" />
            </SelectTrigger>
            <SelectContent className="cyber-dialog border-border">
              {providers.map((provider) => (
                <SelectItem key={provider.id} value={provider.id} className="font-sans">
                  {provider.name.replace(/\s*[(（].+?[)）]/g, '')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* 2. 模型名称 */}
        {selectedProviderInfo && (
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground uppercase">模型名称</Label>
            <Input
              type="text"
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              placeholder={selectedProviderInfo.default_model || "请填写模型名称"}
              className="h-10 cyber-input"
            />
          </div>
        )}

        {/* 3. API URL */}
        <div className="space-y-2">
          <Label className="text-xs font-medium text-muted-foreground uppercase">API URL</Label>
          <Input
            type="url"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder={PROVIDER_DEFAULT_URLS[selectedProvider] || "请填写API URL"}
            className="h-10 cyber-input"
          />
        </div>

        {/* 4. API密钥 */}
        {selectedProviderInfo?.requires_api_key && (
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground uppercase">
              API密钥
              <span className="text-destructive ml-1">*</span>
            </Label>
            <Input
              type="text"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="请填写API密钥"
              className="h-10 cyber-input"
            />
          </div>
        )}

        {/* 5. 向量维度 + 批处理大小 */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground uppercase">向量维度</Label>
            <Input
              type="number"
              value={customDimension || ""}
              onChange={(e) => setCustomDimension(e.target.value ? parseInt(e.target.value) : null)}
              placeholder="请填写向量维度"
              min={64}
              max={8192}
              className="h-10 cyber-input"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground uppercase">批处理大小</Label>
            <Input
              type="number"
              value={batchSize}
              onChange={(e) => setBatchSize(parseInt(e.target.value) || 100)}
              min={1}
              max={500}
              className="h-10 cyber-input"
            />
          </div>
        </div>

        {/* 测试结果 */}
        {testResult && (
          <div
            className={`p-4 rounded-lg ${
              testResult.success
                ? "bg-primary/10 border border-primary/25"
                : "bg-destructive/8 border border-destructive/25"
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              {testResult.success ? (
                <CheckCircle2 className="w-5 h-5 text-primary" />
              ) : (
                <AlertCircle className="w-5 h-5 text-destructive" />
              )}
              <span
                className={`font-bold ${
                  testResult.success ? "text-primary" : "text-destructive"
                }`}
              >
                {testResult.success ? "测试成功" : "测试失败"}
              </span>
            </div>
            {testResult.success ? (
              <p className="text-sm text-muted-foreground">{testResult.message}</p>
            ) : (
              <pre className="text-sm text-destructive/80 whitespace-pre-wrap break-words font-mono leading-relaxed bg-destructive/5 p-3 rounded border border-destructive/15">{testResult.message}</pre>
            )}
            {testResult.success && (
              <div className="mt-3 pt-3 border-t border-border text-xs text-muted-foreground space-y-1 font-sans">
                <div>向量维度: <span className="text-foreground">{testResult.dimensions}</span></div>
                <div>延迟: <span className="text-foreground">{testResult.latency_ms}ms</span></div>
                {testResult.sample_embedding && (
                  <div className="truncate">
                    示例向量: <span className="text-muted-foreground">[{testResult.sample_embedding.slice(0, 5).map((v) => v.toFixed(4)).join(", ")}...]</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* 操作按钮 - 测试连接自动保存 */}
        <div className="pt-4 border-t border-border border-dashed flex justify-end">
          <Button
            onClick={async () => { await handleSave(); await handleTest(); }}
            disabled={(saving || testing) || !selectedProvider || !selectedModel || (selectedProviderInfo?.requires_api_key && !apiKey)}
            className="cyber-btn-primary h-10"
          >
            {(saving || testing) ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <PlayCircle className="w-4 h-4 mr-2" />
            )}
            {saving ? '保存中...' : testing ? '测试中...' : '测试连接'}
          </Button>
        </div>
      </div>

          </div>
  );
}
