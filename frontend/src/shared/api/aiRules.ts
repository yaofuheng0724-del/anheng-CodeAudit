/**
 * AI 规则生成 API
 *
 * 用户输入自然语言描述，调用 LLM 生成结构化的代码审计规则。
 */

import { apiClient } from './serverClient';

export interface RuleGenerateRequest {
  /** 规则简述，如"检测 SQL 注入"、"检查硬编码密码"等 */
  description: string;
  /** 正样例描述（可选）- 应该被报告的情况 */
  positiveExample?: string;
  /** 反样例描述（可选）- 不应被报告的情况 */
  negativeExample?: string;
  /** 输出语言，默认中文 */
  language?: 'zh' | 'en';
}

export interface RuleGenerateResponse {
  success: boolean;
  /** 生成的规则文本 */
  rule?: string;
  /** 生成的规则文本（与 rule 相同，兼容字段） */
  content?: string;
  /** 错误信息 */
  error?: string;
  /** 执行耗时（秒） */
  execution_time?: number;
}

/**
 * 调用 AI 生成代码审计规则
 *
 * @param description 规则简述
 * @param positiveExample 正样例描述（可选）
 * @param negativeExample 反样例描述（可选）
 * @param language 输出语言，默认中文
 * @returns 生成的规则文本
 */
export async function generateAIRule(
  description: string,
  positiveExample?: string,
  negativeExample?: string,
  language: 'zh' | 'en' = 'zh',
): Promise<RuleGenerateResponse> {
  const response = await apiClient.post<RuleGenerateResponse>('/ai-rules/generate', {
    description,
    positive_example: positiveExample,
    negative_example: negativeExample,
    language,
  }, {
    timeout: 180_000, // AI 规则生成耗时较长（通常 30~90s），需要更长的超时时间
  });
  return response.data;
}
