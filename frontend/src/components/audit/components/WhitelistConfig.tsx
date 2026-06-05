/**
 * WhitelistConfig - 白名单与过滤配置组件
 * 支持函数白名单、缺陷白名单、特有过滤函数的自定义配置
 */

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown, FunctionSquare, ShieldAlert, Filter } from "lucide-react";

// 预定义漏洞类型选项
export const VULNERABILITY_OPTIONS = [
  { value: "sql_injection", label: "SQL 注入" },
  { value: "nosql_injection", label: "NoSQL 注入" },
  { value: "xss", label: "XSS 跨站脚本" },
  { value: "command_injection", label: "命令注入" },
  { value: "code_injection", label: "代码注入" },
  { value: "path_traversal", label: "路径穿越" },
  { value: "ssrf", label: "SSRF 服务端请求伪造" },
  { value: "xxe", label: "XXE 外部实体" },
  { value: "deserialization", label: "反序列化" },
  { value: "auth_bypass", label: "认证绕过" },
  { value: "idor", label: "IDOR 不安全直接对象引用" },
  { value: "sensitive_data_exposure", label: "敏感数据泄露" },
  { value: "hardcoded_secret", label: "硬编码密钥" },
  { value: "weak_crypto", label: "弱加密" },
  { value: "race_condition", label: "竞态条件" },
  { value: "business_logic", label: "业务逻辑漏洞" },
  { value: "memory_corruption", label: "内存损坏" },
];

interface WhitelistConfigProps {
  functionWhitelist: string[];
  vulnerabilityWhitelist: string[];
  sanitizerFunctions: string[];
  onChange: (
    field: "functionWhitelist" | "vulnerabilityWhitelist" | "sanitizerFunctions",
    values: string[]
  ) => void;
}

export default function WhitelistConfig({
  functionWhitelist,
  vulnerabilityWhitelist,
  sanitizerFunctions,
  onChange,
}: WhitelistConfigProps) {
  return (
    <div className="space-y-2">
      <Label className="text-xs text-muted-foreground">过滤与白名单</Label>

      <div className="space-y-1.5">
        {/* 函数白名单 */}
        <TagListSection
          icon={<FunctionSquare className="w-3.5 h-3.5" />}
          title="函数白名单"
          items={functionWhitelist}
          placeholder="输入函数名，如：sanitize_input"
          onChange={(values) => onChange("functionWhitelist", values)}
        />

        {/* 缺陷白名单 */}
        <VulnerabilitySection
          icon={<ShieldAlert className="w-3.5 h-3.5" />}
          title="缺陷白名单"
          items={vulnerabilityWhitelist}
          onChange={(values) => onChange("vulnerabilityWhitelist", values)}
        />

        {/* 特有过滤函数 */}
        <TagListSection
          icon={<Filter className="w-3.5 h-3.5" />}
          title="特有过滤函数"
          items={sanitizerFunctions}
          placeholder="输入过滤函数名，如：htmlspecialchars"
          onChange={(values) => onChange("sanitizerFunctions", values)}
        />
      </div>
    </div>
  );
}

// =================== 通用标签列表组件 ===================

function TagListSection({
  icon,
  title,
  items,
  placeholder,
  onChange,
}: {
  icon: React.ReactNode;
  title: string;
  items: string[];
  placeholder: string;
  onChange: (values: string[]) => void;
}) {
  const [open, setOpen] = useState(items.length > 0);
  const [inputValue, setInputValue] = useState("");

  const handleAdd = () => {
    const trimmed = inputValue.trim();
    if (trimmed && !items.includes(trimmed)) {
      onChange([...items, trimmed]);
      setInputValue("");
    }
  };

  const handleRemove = (item: string) => {
    onChange(items.filter((i) => i !== item));
  };

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="border border-border rounded-sm bg-muted/20">
        <CollapsibleTrigger className="flex items-center justify-between w-full px-3 py-2 hover:bg-muted/40 transition-colors">
          <div className="flex items-center gap-2">
            {icon}
            <span className="text-xs font-medium">{title}</span>
            {items.length > 0 && (
              <Badge variant="secondary" className="text-xs px-1.5 py-0 h-4">
                {items.length}
              </Badge>
            )}
          </div>
          <ChevronDown
            className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
          />
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="px-3 pb-2 space-y-2">
            {/* 已添加的标签 */}
            {items.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {items.map((item) => (
                  <Badge
                    key={item}
                    variant="outline"
                    className="text-xs px-1.5 py-0 cursor-pointer hover:bg-destructive/10 hover:text-destructive transition-colors"
                    onClick={() => handleRemove(item)}
                  >
                    {item} ×
                  </Badge>
                ))}
              </div>
            )}

            {/* 输入框 */}
            <div className="flex gap-2">
              <Input
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAdd();
                  }
                }}
                placeholder={placeholder}
                className="h-8 text-xs rounded-sm"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={handleAdd}
                disabled={!inputValue.trim() || items.includes(inputValue.trim())}
                className="h-8 text-xs rounded-sm px-3"
              >
                添加
              </Button>
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

// =================== 缺陷白名单（含预定义选项） ===================

function VulnerabilitySection({
  icon,
  title,
  items,
  onChange,
}: {
  icon: React.ReactNode;
  title: string;
  items: string[];
  onChange: (values: string[]) => void;
}) {
  const [open, setOpen] = useState(items.length > 0);
  const [customInput, setCustomInput] = useState("");

  const handleToggle = (value: string) => {
    if (items.includes(value)) {
      onChange(items.filter((i) => i !== value));
    } else {
      onChange([...items, value]);
    }
  };

  const handleAddCustom = () => {
    const trimmed = customInput.trim();
    if (trimmed && !items.includes(trimmed)) {
      onChange([...items, trimmed]);
      setCustomInput("");
    }
  };

  const handleRemove = (item: string) => {
    onChange(items.filter((i) => i !== item));
  };

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="border border-border rounded-sm bg-muted/20">
        <CollapsibleTrigger className="flex items-center justify-between w-full px-3 py-2 hover:bg-muted/40 transition-colors">
          <div className="flex items-center gap-2">
            {icon}
            <span className="text-xs font-medium">{title}</span>
            {items.length > 0 && (
              <Badge variant="secondary" className="text-xs px-1.5 py-0 h-4">
                {items.length}
              </Badge>
            )}
          </div>
          <ChevronDown
            className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
          />
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="px-3 pb-2 space-y-2">
            {/* 已选择的项目 */}
            {items.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {items.map((item) => (
                  <Badge
                    key={item}
                    variant="outline"
                    className="text-xs px-1.5 py-0 cursor-pointer hover:bg-destructive/10 hover:text-destructive transition-colors"
                    onClick={() => handleRemove(item)}
                  >
                    {item} ×
                  </Badge>
                ))}
              </div>
            )}

            {/* 预定义漏洞类型选项 */}
            <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
              {VULNERABILITY_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className="flex items-center gap-2 text-xs cursor-pointer hover:bg-muted/40 px-1.5 py-1 rounded-sm transition-colors"
                >
                  <Checkbox
                    checked={items.includes(opt.value)}
                    onCheckedChange={() => handleToggle(opt.value)}
                    className="h-3.5 w-3.5 rounded-sm"
                  />
                  <span className="truncate">{opt.label}</span>
                </label>
              ))}
            </div>

            {/* 自定义输入 */}
            <div className="flex gap-2">
              <Input
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddCustom();
                  }
                }}
                placeholder="自定义漏洞类型或关键词"
                className="h-8 text-xs rounded-sm"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={handleAddCustom}
                disabled={!customInput.trim() || items.includes(customInput.trim())}
                className="h-8 text-xs rounded-sm px-3"
              >
                添加
              </Button>
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}