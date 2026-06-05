/**
 * Audit Rules Management Page
 * Cyberpunk Terminal Aesthetic
 */

import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import PromptManager from './PromptManager';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { toast } from 'sonner';
import {
  Plus,
  Trash2,
  Edit,
  Eye,
  Power,
  Download,
  Upload,
  Shield,
  Bug,
  Zap,
  Code,
  Settings,
  ExternalLink,
  Activity,
  CheckCircle,
  Terminal,
  Search,
  Share2,
  ChevronLeft,
  ChevronRight,
  X,
} from 'lucide-react';
import {
  getRuleSets,
  createRuleSet,
  updateRuleSet,
  deleteRuleSet,
  exportRuleSet,
  importRuleSet,
  addRuleToSet,
  updateRule,
  deleteRule,
  toggleRule,
  type AuditRuleSet,
  type AuditRule,
  type AuditRuleSetCreate,
  type AuditRuleCreate,
} from '@/shared/api/rules';

const CATEGORIES = [
  { value: 'security', label: '安全', icon: Shield, color: 'text-destructive', bg: 'bg-destructive/12' },
  { value: 'performance', label: '性能', icon: Zap, color: 'text-warning', bg: 'bg-amber-500/20' },
  { value: 'quality', label: '代码质量', icon: Code, color: 'text-secondary', bg: 'bg-violet-500/20' },
];

const SEVERITIES = [
  { value: 'critical', label: '严重', color: 'severity-critical' },
  { value: 'high', label: '高', color: 'severity-high' },
  { value: 'medium', label: '中', color: 'severity-medium' },
  { value: 'low', label: '低', color: 'severity-low' },
];

const CATEGORY_ABBREV: Record<string, string> = {
  security: 'SEC',
  performance: 'PERF',
  quality: 'QLTY',
  iac: 'IAC',
};

const LANGUAGES = [
  { value: 'all', label: '所有语言' },
  { value: 'python', label: 'Python' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'java', label: 'Java' },
  { value: 'go', label: 'Go' },
];

const RULE_TYPES = [
  { value: 'security', label: '漏洞规则' },
  { value: 'quality', label: '质量规则' },
  { value: 'performance', label: '性能规则' },
  { value: 'iac', label: 'IaC规则' },
  { value: 'custom', label: '自定义规则' },
];

const PATTERN_LANGUAGES = [
  { value: 'python', label: 'Python' },
  { value: 'java', label: 'Java' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'go', label: 'Go' },
  { value: 'php', label: 'PHP' },
  { value: 'c', label: 'C' },
  { value: 'cpp', label: 'C++' },
  { value: 'ruby', label: 'Ruby' },
  { value: 'rust', label: 'Rust' },
  { value: 'csharp', label: 'C#' },
  { value: 'swift', label: 'Swift' },
  { value: 'kotlin', label: 'Kotlin' },
  { value: 'scala', label: 'Scala' },
];

/** 代码检测模式编辑器 */
function CodePatternsEditor({ value, onChange }: { value: Record<string, string[]>; onChange: (v: Record<string, string[]>) => void }) {
  const [newLang, setNewLang] = useState('');
  const [newPatternInputs, setNewPatternInputs] = useState<Record<string, string>>({});

  const addLanguage = () => {
    if (newLang && !value[newLang]) {
      onChange({ ...value, [newLang]: [] });
      setNewLang('');
    }
  };

  const addPattern = (lang: string) => {
    const input = newPatternInputs[lang]?.trim();
    if (input) {
      onChange({ ...value, [lang]: [...(value[lang] || []), input] });
      setNewPatternInputs({ ...newPatternInputs, [lang]: '' });
    }
  };

  const removePattern = (lang: string, idx: number) => {
    const updated = { ...value, [lang]: value[lang].filter((_, i) => i !== idx) };
    if (updated[lang].length === 0) delete updated[lang];
    onChange(updated);
  };

  const removeLanguage = (lang: string) => {
    const updated = { ...value };
    delete updated[lang];
    onChange(updated);
  };

  const availableLangs = PATTERN_LANGUAGES.filter(l => !value[l.value]);

  return (
    <div className="space-y-3">
      {Object.entries(value).map(([lang, patterns]) => (
        <div key={lang} className="border border-border rounded p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {PATTERN_LANGUAGES.find(l => l.value === lang)?.label || lang}
            </span>
            <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:bg-destructive/12" onClick={() => removeLanguage(lang)}>
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>
          {patterns.map((pattern, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <code className="bg-muted/50 border border-border/50 rounded px-2 py-1 font-mono text-sm text-primary flex-1 break-all">
                {pattern}
              </code>
              <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:bg-destructive/12 shrink-0" onClick={() => removePattern(lang, idx)}>
                <X className="w-3 h-3" />
              </Button>
            </div>
          ))}
          <div className="flex items-center gap-2">
            <Input
              value={newPatternInputs[lang] || ''}
              onChange={e => setNewPatternInputs({ ...newPatternInputs, [lang]: e.target.value })}
              placeholder="输入新模式..."
              className="cyber-input h-8 text-sm font-mono"
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addPattern(lang); } }}
            />
            <Button variant="ghost" size="sm" className="h-8 text-primary shrink-0" onClick={() => addPattern(lang)}>
              <Plus className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      ))}
      {availableLangs.length > 0 && (
        <div className="flex items-center gap-2">
          <Select value={newLang} onValueChange={setNewLang}>
            <SelectTrigger className="cyber-input h-8 w-[140px] text-sm">
              <SelectValue placeholder="添加语言" />
            </SelectTrigger>
            <SelectContent className="cyber-dialog border-border">
              {availableLangs.map(l => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button className="cyber-btn-primary h-8" onClick={addLanguage} disabled={!newLang}>
            <Plus className="w-3.5 h-3.5 mr-1" />添加
          </Button>
        </div>
      )}
    </div>
  );
}

export default function AuditRules() {
  const [searchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") === "ai" ? "ai" : "static";
  const [ruleSets, setRuleSets] = useState<AuditRuleSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showRuleDialog, setShowRuleDialog] = useState(false);
  const [showViewRuleSheet, setShowViewRuleSheet] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [selectedRuleSet, setSelectedRuleSet] = useState<AuditRuleSet | null>(null);
  const [selectedRule, setSelectedRule] = useState<AuditRule | null>(null);
  const [filterName, setFilterName] = useState('');
  const [filterRuleSet, setFilterRuleSet] = useState('all');
  const [filterEnabled, setFilterEnabled] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  // 篩选变化时回到第 1 页
  const handleFilterNameChange = (v: string) => { setFilterName(v); setCurrentPage(1); };
  const handleFilterRuleSetChange = (v: string) => { setFilterRuleSet(v); setCurrentPage(1); };
  const handleFilterEnabledChange = (v: string) => { setFilterEnabled(v); setCurrentPage(1); };

  const [ruleSetForm, setRuleSetForm] = useState<AuditRuleSetCreate>({
    name: '', description: '', language: 'all', rule_type: 'custom',
  });
  const [ruleForm, setRuleForm] = useState<AuditRuleCreate>({
    rule_code: '', name: '', description: '', category: 'security',
    severity: 'medium', custom_prompt: '', fix_suggestion: '', reference_url: '', enabled: true,
  });
  const [importJson, setImportJson] = useState('');

  useEffect(() => { loadRuleSets(); }, []);

  const loadRuleSets = async () => {
    try {
      setLoading(true);
      const response = await getRuleSets();
      setRuleSets(response.items);
    } catch (error) {
      toast.error('加载规则集失败');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRuleSet = async () => {
    try {
      await createRuleSet(ruleSetForm);
      toast.success('规则集已创建');
      setShowCreateDialog(false);
      setRuleSetForm({ name: '', description: '', language: 'all', rule_type: 'custom' });
      loadRuleSets();
    } catch (error) { toast.error('创建失败'); }
  };

  const handleUpdateRuleSet = async () => {
    if (!selectedRuleSet) return;
    try {
      await updateRuleSet(selectedRuleSet.id, ruleSetForm);
      toast.success('更新成功');
      setShowEditDialog(false);
      loadRuleSets();
    } catch (error) { toast.error('更新失败'); }
  };

  const handleDeleteRuleSet = async (id: string) => {
    if (!confirm('确定要删除此规则集吗？')) return;
    try {
      await deleteRuleSet(id);
      toast.success('删除成功');
      loadRuleSets();
    } catch (error: any) { toast.error(error.message || '删除失败'); }
  };

  const handleExport = async (ruleSet: AuditRuleSet) => {
    try {
      const blob = await exportRuleSet(ruleSet.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `${ruleSet.name}.json`; a.click();
      URL.revokeObjectURL(url);
      toast.success('导出成功');
    } catch (error) { toast.error('导出失败'); }
  };

  const handleImport = async () => {
    try {
      const data = JSON.parse(importJson);
      await importRuleSet(data);
      toast.success('导入成功');
      setShowImportDialog(false);
      setImportJson('');
      loadRuleSets();
    } catch (error: any) { toast.error(error.message || '导入失败'); }
  };

  const handleAddRule = async () => {
    if (!selectedRuleSet) return;
    try {
      await addRuleToSet(selectedRuleSet.id, ruleForm);
      toast.success('添加成功');
      setShowRuleDialog(false);
      setRuleForm({ rule_code: '', name: '', description: '', category: 'security', severity: 'medium', custom_prompt: '', fix_suggestion: '', reference_url: '', enabled: true });
      loadRuleSets();
    } catch (error) { toast.error('添加失败'); }
  };

  const handleUpdateRule = async () => {
    if (!selectedRuleSet || !selectedRule) return;
    try {
      await updateRule(selectedRuleSet.id, selectedRule.id, ruleForm);
      toast.success('更新成功');
      setShowRuleDialog(false);
      loadRuleSets();
    } catch (error) { toast.error('更新失败'); }
  };

  const handleDeleteRule = async (ruleSetId: string, ruleId: string) => {
    if (!confirm('确定要删除此规则吗？')) return;
    try {
      await deleteRule(ruleSetId, ruleId);
      toast.success('删除成功');
      loadRuleSets();
    } catch (error) { toast.error('删除失败'); }
  };

  const handleToggleRule = async (ruleSetId: string, ruleId: string) => {
    try {
      const result = await toggleRule(ruleSetId, ruleId);
      toast.success(result.message);
      loadRuleSets();
    } catch (error) { toast.error('操作失败'); }
  };

  const openEditRuleSetDialog = (ruleSet: AuditRuleSet) => {
    setSelectedRuleSet(ruleSet);
    setRuleSetForm({ name: ruleSet.name, description: ruleSet.description || '', language: ruleSet.language, rule_type: ruleSet.rule_type });
    setShowEditDialog(true);
  };

  const openAddRuleDialog = (ruleSet?: AuditRuleSet) => {
    const targetRuleSet = ruleSet || ruleSets.find(rs => !rs.is_system) || ruleSets[0] || null;
    setSelectedRuleSet(targetRuleSet);
    setSelectedRule(null);
    const initialCategory = 'security';
    setRuleForm({ rule_code: generateRuleCode(initialCategory), name: '', description: '', category: initialCategory, severity: 'medium', custom_prompt: '', fix_suggestion: '', reference_url: '', enabled: true });
    setShowRuleDialog(true);
  };

  const openEditRuleDialog = (ruleSet: AuditRuleSet, rule: AuditRule) => {
    setSelectedRuleSet(ruleSet);
    setSelectedRule(rule);
    setRuleForm({ rule_code: rule.rule_code, name: rule.name, description: rule.description || '', category: rule.category, severity: rule.severity, custom_prompt: rule.custom_prompt || '', code_patterns: rule.code_patterns || undefined, fix_suggestion: rule.fix_suggestion || '', reference_url: rule.reference_url || '', enabled: rule.enabled });
    setShowRuleDialog(true);
  };

  const openViewRuleDialog = (ruleSet: AuditRuleSet, rule: AuditRule) => {
    setSelectedRuleSet(ruleSet);
    setSelectedRule(rule);
    setShowViewRuleSheet(true);
  };

  const getCategoryInfo = (category: string) => CATEGORIES.find(c => c.value === category) || CATEGORIES[0];
  const getSeverityInfo = (severity: string) => SEVERITIES.find(s => s.value === severity) || SEVERITIES[2];

  const generateRuleCode = (category: string) => {
    const abbrev = CATEGORY_ABBREV[category] || 'RULE';
    const now = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    const existingCount = ruleSets.flatMap(rs => rs.rules).filter(r => r.category === category).length;
    const seq = String(existingCount + 1).padStart(4, '0');
    return `${abbrev}-${dateStr}-${seq}`;
  };

  const filteredRules = ruleSets.flatMap(ruleSet =>
    ruleSet.rules.map(rule => ({ ruleSet, rule }))
      .filter(({ rule, ruleSet: rs }) => {
        if (filterName && !rule.name.toLowerCase().includes(filterName.toLowerCase())) return false;
        if (filterRuleSet !== 'all' && rs.id !== filterRuleSet) return false;
        if (filterEnabled === 'enabled' && !rule.enabled) return false;
        if (filterEnabled === 'disabled' && rule.enabled) return false;
        return true;
      })
  );

  const totalCount = filteredRules.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  // 确保当前页不超出范围
  const safePage = Math.min(currentPage, totalPages);
  if (safePage !== currentPage) setCurrentPage(safePage);
  const startIndex = (safePage - 1) * pageSize;
  const paginatedRules = filteredRules.slice(startIndex, startIndex + pageSize);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen cyber-bg-elevated">
        <div className="text-center space-y-4">
          <div className="loading-spinner mx-auto" />
          <p className="text-muted-foreground font-sans text-sm uppercase tracking-wider">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 px-6 pt-1 pb-6 cyber-bg-elevated min-h-screen font-sans relative">
      {/* Grid background */}
      <div className="absolute inset-0 cyber-grid-subtle pointer-events-none" />

      {activeTab === "ai" ? (
        <PromptManager />
      ) : (
      <>

      {/* Merged Rules Table */}
      <div className="relative z-10">
        {ruleSets.length === 0 ? (
          <div className="cyber-card p-16">
            <div className="empty-state">
              <Shield className="empty-state-icon" />
              <p className="empty-state-title">暂无规则集</p>
              <p className="empty-state-description">点击"新建规则"创建自定义审计规则</p>
              <Button className="cyber-btn-primary h-12 px-8 mt-6" onClick={() => setShowCreateDialog(true)}>
                <Plus className="w-5 h-5 mr-2" />
                创建规则集
              </Button>
            </div>
          </div>
        ) : (
          <div className="cyber-card p-0">
            {/* Toolbar: filters + actions */}
            <div className="p-4 flex items-center gap-3 border-b border-border flex-wrap">
              <div className="relative flex-1 min-w-[180px] max-w-[240px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <Input
                  value={filterName}
                  onChange={e => handleFilterNameChange(e.target.value)}
                  placeholder="搜索规则名称"
                  className="h-8 text-sm !pl-9"
                />
              </div>
              <Select value={filterRuleSet} onValueChange={handleFilterRuleSetChange}>
                <SelectTrigger className="cyber-input h-8 w-[160px] text-sm">
                  <SelectValue placeholder="所属集合" />
                </SelectTrigger>
                <SelectContent className="cyber-dialog border-border">
                  <SelectItem value="all">全部集合</SelectItem>
                  {ruleSets.map(rs => <SelectItem key={rs.id} value={rs.id}>{rs.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filterEnabled} onValueChange={handleFilterEnabledChange}>
                <SelectTrigger className="cyber-input h-8 w-[120px] text-sm">
                  <SelectValue placeholder="启用状态" />
                </SelectTrigger>
                <SelectContent className="cyber-dialog border-border">
                  <SelectItem value="all">全部状态</SelectItem>
                  <SelectItem value="enabled">已启用</SelectItem>
                  <SelectItem value="disabled">已禁用</SelectItem>
                </SelectContent>
              </Select>
              <div className="ml-auto flex gap-2">
                <Button onClick={() => openAddRuleDialog()} className="cyber-btn-primary h-8">
                  <Plus className="w-4 h-4 mr-2" />
                  新建规则
                </Button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="text-left py-2 px-6 font-medium">规则名称</th>
                    <th className="text-left py-2 px-3 font-medium">简介</th>
                    <th className="text-left py-2 px-3 font-medium">所属集合</th>
                    <th className="text-left py-2 px-3 font-medium">规则类型</th>
	                    <th className="text-left py-2 px-3 font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {totalCount === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-muted-foreground">
                        无匹配规则
                      </td>
                    </tr>
                  ) : (
                    paginatedRules.map(({ ruleSet, rule }) => (
                      <tr key={`${ruleSet.id}-${rule.id}`} className="border-b border-border/50 hover:bg-muted/50 transition-colors">
                        <td className="py-2.5 px-6">
                          <span className="font-medium text-foreground">{rule.name}</span>
                        </td>
                        <td className="py-2.5 px-3 text-muted-foreground max-w-xs truncate">{rule.description || '-'}</td>
                        <td className="py-2.5 px-3">
                          <span className="text-muted-foreground">{ruleSet.name}</span>
                        </td>
                        <td className="py-2.5 px-3">
                          <Badge className="cyber-badge-muted">{RULE_TYPES.find(t => t.value === ruleSet.rule_type)?.label || ruleSet.rule_type}</Badge>
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" onClick={() => handleToggleRule(ruleSet.id, rule.id)} className={`h-7 w-7 ${rule.enabled ? 'bg-primary/12 text-primary' : 'hover:bg-primary/12 hover:text-primary'}`}>
                              <Power className="w-3.5 h-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => openViewRuleDialog(ruleSet, rule)} className="h-7 w-7 hover:bg-primary/12 hover:text-primary">
                              <Eye className="w-3.5 h-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => openEditRuleDialog(ruleSet, rule)} className="h-7 w-7 hover:bg-primary/12 hover:text-primary">
                              <Edit className="w-3.5 h-3.5" />
                            </Button>
                            {!ruleSet.is_system && (
                              <Button variant="ghost" size="icon" onClick={() => handleDeleteRule(ruleSet.id, rule.id)} className="h-7 w-7 hover:bg-destructive/12 hover:text-destructive">
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {/* Pagination */}
            {totalCount > 0 && (
              <div className="flex items-center justify-between px-6 py-3 border-t border-border">
                <span className="text-xs text-muted-foreground">
                  共 {totalCount} 条规则，第 {safePage}/{totalPages} 页
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    disabled={safePage <= 1}
                    onClick={() => setCurrentPage(safePage - 1)}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter(page => {
                      // 显示首页、末页及当前页附近的页码
                      if (totalPages <= 7) return true;
                      if (page === 1 || page === totalPages) return true;
                      if (Math.abs(page - safePage) <= 1) return true;
                      return false;
                    })
                    .reduce<(number | 'ellipsis')[]>((acc, page, idx, arr) => {
                      if (idx > 0 && page - arr[idx - 1] > 1) {
                        acc.push('ellipsis');
                      }
                      acc.push(page);
                      return acc;
                    }, [])
                    .map((item, idx) =>
                      item === 'ellipsis' ? (
                        <span key={`ellipsis-${idx}`} className="w-7 h-7 flex items-center justify-center text-muted-foreground text-xs">…</span>
                      ) : (
                        <Button
                          key={item}
                          variant={item === safePage ? 'outline' : 'ghost'}
                          size="icon"
                          className={`h-7 w-7 text-xs ${item === safePage ? 'bg-primary/12 text-primary font-semibold' : ''}`}
                          onClick={() => setCurrentPage(item as number)}
                        >
                          {item}
                        </Button>
                      )
                    )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    disabled={safePage >= totalPages}
                    onClick={() => setCurrentPage(safePage + 1)}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      {/* View Rule Sheet */}
      <Sheet open={showViewRuleSheet} onOpenChange={setShowViewRuleSheet}>
        <SheetContent side="right" className="!w-[min(90vw,500px)] sm:max-w-[500px] !sm:max-w-none flex flex-col p-0 gap-0 border-border overflow-y-auto">
          <SheetHeader className="px-6 py-4 border-b border-border flex-shrink-0 bg-muted">
            <SheetTitle className="flex items-center gap-3 font-sans text-foreground">
              <div className="p-2 bg-primary/20 rounded border border-primary/30">
                <Eye className="w-5 h-5 text-primary" />
              </div>
              <span className="text-lg font-semibold uppercase tracking-wider">查看规则</span>
            </SheetTitle>
          </SheetHeader>
          {selectedRule && selectedRuleSet && (
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground uppercase">规则代码</Label>
                <p className="text-sm text-primary font-semibold">{selectedRule.rule_code}</p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground uppercase">规则名称</Label>
                <p className="text-sm text-foreground">{selectedRule.name}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground uppercase">类别</Label>
                  <p className="text-sm text-foreground">{CATEGORIES.find(c => c.value === selectedRule.category)?.label || selectedRule.category}</p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground uppercase">严重程度</Label>
                  <p className="text-sm text-foreground">{SEVERITIES.find(s => s.value === selectedRule.severity)?.label || selectedRule.severity}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground uppercase">所属集合</Label>
                  <p className="text-sm text-foreground">{selectedRuleSet.name}</p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground uppercase">规则类型</Label>
                  <Badge className="cyber-badge-muted">{RULE_TYPES.find(t => t.value === selectedRuleSet.rule_type)?.label || selectedRuleSet.rule_type}</Badge>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground uppercase">描述</Label>
                <p className="text-sm text-foreground whitespace-pre-wrap">{selectedRule.description || '-'}</p>
              </div>
              {selectedRule.custom_prompt && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground uppercase">检测规则</Label>
                  <p className="text-sm text-foreground whitespace-pre-wrap">{selectedRule.custom_prompt}</p>
                </div>
              )}
              {selectedRule.code_patterns && Object.keys(selectedRule.code_patterns).length > 0 && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground uppercase">代码检测模式</Label>
                  <Accordion type="multiple" className="w-full">
                    {Object.entries(selectedRule.code_patterns).map(([lang, patterns]) => (
                      <AccordionItem key={lang} value={lang}>
                        <AccordionTrigger className="text-sm font-medium py-2 hover:no-underline">
                          <div className="flex items-center gap-2">
                            <span className="uppercase tracking-wider">{PATTERN_LANGUAGES.find(l => l.value === lang)?.label || lang}</span>
                            <Badge className="cyber-badge-muted">{patterns.length}</Badge>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="space-y-1.5 pt-1">
                            {patterns.map((pattern, idx) => (
                              <div key={idx} className="bg-muted/50 border border-border/50 rounded px-3 py-1.5 font-mono text-sm text-primary break-all">
                                {pattern}
                              </div>
                            ))}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </div>
              )}
              {selectedRule.fix_suggestion && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground uppercase">修复建议</Label>
                  <p className="text-sm text-foreground whitespace-pre-wrap">{selectedRule.fix_suggestion}</p>
                </div>
              )}
              {selectedRule.reference_url && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground uppercase">参考链接</Label>
                  <a href={selectedRule.reference_url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline">{selectedRule.reference_url}</a>
                </div>
              )}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground uppercase">启用状态</Label>
                <Badge className={selectedRule.enabled ? "cyber-badge-success" : "cyber-badge-danger"}>{selectedRule.enabled ? '已启用' : '已禁用'}</Badge>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Create Rule Set Sheet */}
      <Sheet open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <SheetContent side="right" className="!w-[min(90vw,500px)] sm:max-w-[500px] !sm:max-w-none flex flex-col p-0 gap-0 border-border overflow-y-auto">
          <SheetHeader className="px-6 py-4 border-b border-border flex-shrink-0 bg-muted">
            <SheetTitle className="flex items-center gap-3 font-sans text-foreground">
              <div className="p-2 bg-primary/20 rounded border border-primary/30">
                <Terminal className="w-5 h-5 text-primary" />
              </div>
              <span className="text-lg font-semibold uppercase tracking-wider">新建规则</span>
            </SheetTitle>
            <SheetDescription className="text-xs text-muted-foreground font-normal">
              创建新的规则集
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground uppercase">名称 *</Label>
              <Input value={ruleSetForm.name} onChange={e => setRuleSetForm({ ...ruleSetForm, name: e.target.value })} placeholder="规则集名称" className="cyber-input" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground uppercase">描述</Label>
              <Textarea value={ruleSetForm.description} onChange={e => setRuleSetForm({ ...ruleSetForm, description: e.target.value })} placeholder="规则集描述" className="cyber-input" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground uppercase">适用语言</Label>
                <Select value={ruleSetForm.language} onValueChange={v => setRuleSetForm({ ...ruleSetForm, language: v })}>
                  <SelectTrigger className="cyber-input"><SelectValue /></SelectTrigger>
                  <SelectContent className="cyber-dialog border-border">
                    {LANGUAGES.map(l => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground uppercase">规则类型</Label>
                <Select value={ruleSetForm.rule_type} onValueChange={v => setRuleSetForm({ ...ruleSetForm, rule_type: v })}>
                  <SelectTrigger className="cyber-input"><SelectValue /></SelectTrigger>
                  <SelectContent className="cyber-dialog border-border">
                    {RULE_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <div className="flex-shrink-0 flex justify-end gap-3 px-6 py-4 bg-muted border-t border-border">
            <Button variant="outline" onClick={() => setShowCreateDialog(false)} className="cyber-btn-outline">取消</Button>
            <Button onClick={handleCreateRuleSet} className="cyber-btn-primary">创建</Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Edit Rule Set Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="!w-[min(90vw,500px)] !max-w-none max-h-[85vh] flex flex-col p-0 gap-0 cyber-dialog border border-border rounded-lg">
          <DialogHeader className="px-6 py-4 border-b border-border flex-shrink-0 bg-muted">
            <DialogTitle className="flex items-center gap-3 font-sans text-foreground">
              <div className="p-2 bg-primary/20 rounded border border-primary/30">
                <Edit className="w-5 h-5 text-primary" />
              </div>
              <span className="text-lg font-semibold uppercase tracking-wider">编辑规则集</span>
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground uppercase">名称</Label>
              <Input value={ruleSetForm.name} onChange={e => setRuleSetForm({ ...ruleSetForm, name: e.target.value })} className="cyber-input" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground uppercase">描述</Label>
              <Textarea value={ruleSetForm.description} onChange={e => setRuleSetForm({ ...ruleSetForm, description: e.target.value })} className="cyber-input" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground uppercase">适用语言</Label>
                <Select value={ruleSetForm.language} onValueChange={v => setRuleSetForm({ ...ruleSetForm, language: v })}>
                  <SelectTrigger className="cyber-input"><SelectValue /></SelectTrigger>
                  <SelectContent className="cyber-dialog border-border">{LANGUAGES.map(l => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground uppercase">规则类型</Label>
                <Select value={ruleSetForm.rule_type} onValueChange={v => setRuleSetForm({ ...ruleSetForm, rule_type: v })}>
                  <SelectTrigger className="cyber-input"><SelectValue /></SelectTrigger>
                  <SelectContent className="cyber-dialog border-border">{RULE_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter className="flex-shrink-0 flex justify-end gap-3 px-6 py-4 bg-muted border-t border-border">
            <Button variant="outline" onClick={() => setShowEditDialog(false)} className="cyber-btn-outline">取消</Button>
            <Button onClick={handleUpdateRuleSet} className="cyber-btn-primary">保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rule Edit Sheet */}
      <Sheet open={showRuleDialog} onOpenChange={setShowRuleDialog}>
        <SheetContent side="right" className="!w-[min(90vw,500px)] sm:max-w-[500px] !sm:max-w-none flex flex-col p-0 gap-0 border-border overflow-y-auto">
          <SheetHeader className="px-6 py-4 border-b border-border flex-shrink-0 bg-muted">
            <SheetTitle className="flex items-center gap-3 font-sans text-foreground">
              <div className="p-2 bg-primary/20 rounded border border-primary/30">
                <Code className="w-5 h-5 text-primary" />
              </div>
              <span className="text-lg font-semibold uppercase tracking-wider">{selectedRule ? '编辑规则' : '新建规则'}</span>
            </SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {/* 1. 规则名称 */}
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground uppercase">规则名称 *</Label>
              <Input value={ruleForm.name} onChange={e => setRuleForm({ ...ruleForm, name: e.target.value })} placeholder="规则名称" className="h-10 cyber-input" />
            </div>
            {/* 2. 类别 */}
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground uppercase">类别</Label>
              <Select value={ruleForm.category} onValueChange={v => {
                setRuleForm({ ...ruleForm, category: v, rule_code: selectedRule ? ruleForm.rule_code : generateRuleCode(v) });
              }}>
                <SelectTrigger className="h-10 cyber-input"><SelectValue /></SelectTrigger>
                <SelectContent className="cyber-dialog border-border">{CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {/* 3. 严重程度 */}
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground uppercase">严重程度</Label>
              <Select value={ruleForm.severity} onValueChange={v => setRuleForm({ ...ruleForm, severity: v })}>
                <SelectTrigger className="h-10 cyber-input"><SelectValue /></SelectTrigger>
                <SelectContent className="cyber-dialog border-border">{SEVERITIES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {/* 4. 所属集合 */}
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground uppercase">所属集合 *</Label>
              <Select value={selectedRuleSet?.id || ''} onValueChange={v => {
                const rs = ruleSets.find(r => r.id === v);
                if (rs) setSelectedRuleSet(rs);
              }} disabled={!!selectedRule}>
                <SelectTrigger className="h-10 cyber-input"><SelectValue placeholder="选择规则集" /></SelectTrigger>
                <SelectContent className="cyber-dialog border-border">
                  {ruleSets.filter(rs => !rs.is_system).map(rs => <SelectItem key={rs.id} value={rs.id}>{rs.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {/* 5. 描述 */}
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground uppercase">描述</Label>
              <Textarea value={ruleForm.description} onChange={e => setRuleForm({ ...ruleForm, description: e.target.value })} placeholder="规则描述" className="cyber-input" />
            </div>
            {/* 6. 检测规则 */}
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground uppercase">检测规则</Label>
              <Textarea value={ruleForm.custom_prompt} onChange={e => setRuleForm({ ...ruleForm, custom_prompt: e.target.value })} placeholder={"如：检测SQL拼接模式：execute(f\"...{INPUT}...\")、cursor.execute(\"...\" + input)"} rows={3} className="cyber-input" />
            </div>
            {/* 6b. 代码检测模式 */}
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground uppercase">代码检测模式</Label>
              <p className="text-xs text-muted-foreground">按语言添加 Semgrep 风格或正则表达式模式，用于静态扫描引擎匹配</p>
              <CodePatternsEditor
                value={ruleForm.code_patterns || {}}
                onChange={v => setRuleForm({ ...ruleForm, code_patterns: Object.keys(v).length > 0 ? v : undefined })}
              />
            </div>
            {/* 7. 修复建议 */}
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground uppercase">修复建议</Label>
              <Textarea value={ruleForm.fix_suggestion} onChange={e => setRuleForm({ ...ruleForm, fix_suggestion: e.target.value })} placeholder="修复建议模板" rows={2} className="cyber-input" />
            </div>
          </div>
          <div className="flex-shrink-0 flex justify-end gap-3 px-6 py-4 bg-muted border-t border-border">
            <Button variant="outline" onClick={() => setShowRuleDialog(false)} className="cyber-btn-outline">取消</Button>
            <Button onClick={selectedRule ? handleUpdateRule : handleAddRule} className="cyber-btn-primary">{selectedRule ? '保存' : '添加'}</Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Import Dialog */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="!w-[min(90vw,700px)] !max-w-none max-h-[85vh] flex flex-col p-0 gap-0 cyber-dialog border border-border rounded-lg">
          <DialogHeader className="px-6 py-4 border-b border-border flex-shrink-0 bg-muted">
            <DialogTitle className="flex items-center gap-3 font-sans text-foreground">
              <div className="p-2 bg-primary/20 rounded border border-primary/30">
                <Upload className="w-5 h-5 text-primary" />
              </div>
              <div>
                <span className="text-lg font-semibold uppercase tracking-wider">导入规则</span>
                <p className="text-xs text-muted-foreground font-normal mt-0.5">粘贴导出的 JSON 内容</p>
              </div>
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto p-6">
            <Textarea value={importJson} onChange={e => setImportJson(e.target.value)} placeholder='{"name": "...", "rules": [...]}' rows={15} className="cyber-input font-sans text-sm text-primary" />
          </div>
          <DialogFooter className="flex-shrink-0 flex justify-end gap-3 px-6 py-4 bg-muted border-t border-border">
            <Button variant="outline" onClick={() => setShowImportDialog(false)} className="cyber-btn-outline">取消</Button>
            <Button onClick={handleImport} className="cyber-btn-primary">导入</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </>
      )}
    </div>
  );
}
