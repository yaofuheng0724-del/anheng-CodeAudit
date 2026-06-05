/**
 * Projects Page
 * Cyberpunk Terminal Aesthetic
 */

import { useState, useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Progress } from "@/components/ui/progress";
import {
  Plus,
  Search,
  GitBranch,
  Eye,
  Upload,
  FileText,
  AlertCircle,
  Trash2,
  Edit,
  CheckCircle,
  Terminal,
  ChevronDown,
  X
} from "lucide-react";
import { api } from "@/shared/config/database";
import { validateZipFile } from "@/features/projects/services";
import type { Project, CreateProjectForm } from "@/shared/types";
import { uploadZipFile, getZipFileInfo, type ZipFileMeta } from "@/shared/utils/zipStorage";
import { safeJsonParseArray } from "@/shared/utils/utils";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import CreateTaskDialog from "@/components/audit/CreateTaskDialog";
import TerminalProgressDialog from "@/components/audit/TerminalProgressDialog";
import { SUPPORTED_LANGUAGES, REPOSITORY_PLATFORMS } from "@/shared/constants";

// Compiled-mode (二进制扫描) form defaults — keep in lockstep with backend.
const DEFAULT_COMPILED_OPTIONS = { enable_sca: true, max_binary_size_mb: 200 } as const;
const MAX_BINARY_MB_CAP = 2048;

export default function Projects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterLang, setFilterLang] = useState("all");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showCreateTaskDialog, setShowCreateTaskDialog] = useState(false);
  const [selectedProjectForTask, setSelectedProjectForTask] = useState<string>("");
  const [showTerminal, setShowTerminal] = useState(false);
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [projectToEdit, setProjectToEdit] = useState<Project | null>(null);
  const [editForm, setEditForm] = useState<CreateProjectForm>({
    name: "",
    description: "",
    source_type: "repository",
    scan_mode: "source",
    compiled_options: DEFAULT_COMPILED_OPTIONS,
    repository_url: "",
    repository_type: "github",
    default_branch: "main",
    programming_languages: []
  });
  const [createForm, setCreateForm] = useState<CreateProjectForm>({
    name: "",
    description: "",
    source_type: "repository",
    scan_mode: "source",
    compiled_options: DEFAULT_COMPILED_OPTIONS,
    repository_url: "",
    repository_type: "github",
    default_branch: "main",
    programming_languages: []
  });

  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // 编辑对话框中的本地文件状态
  const [editZipInfo, setEditZipInfo] = useState<ZipFileMeta | null>(null);
  const [editZipFile, setEditZipFile] = useState<File | null>(null);
  const [loadingEditZipInfo, setLoadingEditZipInfo] = useState(false);
  const editZipInputRef = useRef<HTMLInputElement>(null);

  // 将小写语言名转换为显示格式
  const formatLanguageName = (lang: string): string => {
    const nameMap: Record<string, string> = {
      'javascript': 'JavaScript',
      'typescript': 'TypeScript',
      'python': 'Python',
      'java': 'Java',
      'go': 'Go',
      'objective-c': 'Objective-C',
      'c': 'C',
      'rust': 'Rust',
      'cpp': 'C++',
      'csharp': 'C#',
      'php': 'PHP',
      'ruby': 'Ruby',
      'swift': 'Swift'
    };
    return nameMap[lang] || lang.charAt(0).toUpperCase() + lang.slice(1);
  };

  const supportedLanguages = SUPPORTED_LANGUAGES.map(formatLanguageName);

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      setLoading(true);
      const data = await api.getProjects();
      setProjects(data);
    } catch (error) {
      console.error('Failed to load projects:', error);
      toast.error("加载项目失败");
    } finally {
      setLoading(false);
    }
  };

  const handleFastScanStarted = (taskId: string) => {
    setCurrentTaskId(taskId);
    setShowTerminal(true);
  };

  const handleCreateProject = async () => {
    if (!createForm.name.trim()) {
      toast.error("请输入项目名称");
      return;
    }

    try {
      await api.createProject({
        ...createForm,
      } as any);

      import('@/shared/utils/logger').then(({ logger }) => {
        logger.logUserAction('创建项目', {
          projectName: createForm.name,
          repositoryType: createForm.repository_type,
          languages: createForm.programming_languages,
        });
      });

      toast.success("项目创建成功");
      setShowCreateDialog(false);
      resetCreateForm();
      loadProjects();
    } catch (error) {
      console.error('Failed to create project:', error);
      import('@/shared/utils/errorHandler').then(({ handleError }) => {
        handleError(error, '创建项目失败');
      });
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      toast.error(`创建项目失败: ${errorMessage}`);
    }
  };

  const resetCreateForm = () => {
    setCreateForm({
      name: "",
      description: "",
      source_type: "repository",
      scan_mode: "source",
      compiled_options: DEFAULT_COMPILED_OPTIONS,
      repository_url: "",
      repository_type: "github",
      default_branch: "main",
      programming_languages: []
    });
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const validation = validateZipFile(file);
    if (!validation.valid) {
      toast.error(validation.error);
      return;
    }

    setSelectedFile(file);
    event.target.value = '';
  };

  const handleUploadAndCreate = async () => {
    if (!selectedFile) {
      toast.error("请先选择本地文件");
      return;
    }

    if (!createForm.name.trim()) {
      toast.error("请先输入项目名称");
      return;
    }

    try {
      setUploading(true);
      setUploadProgress(0);

      // 第一步：创建项目记录
      const project = await api.createProject({
        ...createForm,
        source_type: "zip",
        repository_type: "other",
        repository_url: undefined
      } as any);

      // 第二步：上传本地文件（使用真实的上传进度）
      try {
        await uploadZipFile(project.id, selectedFile, (percent) => {
          setUploadProgress(percent);
        });

        import('@/shared/utils/logger').then(({ logger }) => {
          logger.logUserAction('上传本地文件创建项目', {
            projectName: project.name,
            fileName: selectedFile.name,
            fileSize: selectedFile.size,
          });
        });

        toast.success(`项目 "${project.name}" 已创建`, {
          description: '本地文件已保存，您可以启动代码审计',
          duration: 4000
        });
      } catch (uploadError: any) {
        // 上传失败但项目已创建，提示用户可以在编辑中重新上传
        console.error('上传本地文件失败:', uploadError);
        toast.warning(`项目 "${project.name}" 已创建，但本地文件上传失败`, {
          description: uploadError.message || '请在项目编辑中重新上传本地文件',
          duration: 6000
        });
      }

      setShowCreateDialog(false);
      resetCreateForm();
      loadProjects();

    } catch (error: any) {
      // 创建项目本身失败
      console.error('Create project failed:', error);
      import('@/shared/utils/errorHandler').then(({ handleError }) => {
        handleError(error, '创建项目失败');
      });
      const errorMessage = error?.message || '未知错误';
      toast.error(`创建项目失败: ${errorMessage}`);
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const filteredProjects = projects.filter(project => {
    if (searchTerm && !project.name.toLowerCase().includes(searchTerm.toLowerCase()) && !project.description?.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    if (filterLang !== 'all' && project.programming_languages) {
      const langs = safeJsonParseArray(project.programming_languages).map((l: string) => l.toLowerCase());
      if (!langs.includes(filterLang.toLowerCase())) return false;
    } else if (filterLang !== 'all' && !project.programming_languages) {
      return false;
    }
    return true;
  });

  const handleCreateTask = (projectId: string) => {
    setSelectedProjectForTask(projectId);
    setShowCreateTaskDialog(true);
  };

  const handleEditClick = async (project: Project) => {
    setProjectToEdit(project);
    setEditForm({
      name: project.name,
      description: project.description || "",
      source_type: project.source_type || "repository",
      scan_mode: project.scan_mode || 'source',
      compiled_options: project.compiled_options || DEFAULT_COMPILED_OPTIONS,
      repository_url: project.repository_url || "",
      repository_type: project.repository_type || "github",
      default_branch: project.default_branch || "main",
      programming_languages: safeJsonParseArray(project.programming_languages)
    });
    setEditZipFile(null);
    setEditZipInfo(null);
    setShowEditDialog(true);

    if (project.source_type === 'zip') {
      setLoadingEditZipInfo(true);
      try {
        const zipInfo = await getZipFileInfo(project.id);
        setEditZipInfo(zipInfo);
      } catch (error) {
        console.error('加载本地文件信息失败:', error);
      } finally {
        setLoadingEditZipInfo(false);
      }
    }
  };

  const handleSaveEdit = async () => {
    if (!projectToEdit) return;

    if (!editForm.name.trim()) {
      toast.error("项目名称不能为空");
      return;
    }

    try {
      await api.updateProject(projectToEdit.id, editForm);

      if (editZipFile && editForm.source_type === 'zip') {
        try {
          const result = await uploadZipFile(projectToEdit.id, editZipFile);
          if (result.success) {
            toast.success(`本地文件已更新: ${result.original_filename}`);
          }
        } catch (uploadError: any) {
          toast.error(`本地文件上传失败: ${uploadError.message || '未知错误'}`);
        }
      }

      toast.success(`项目 "${editForm.name}" 已更新`);
      setShowEditDialog(false);
      setProjectToEdit(null);
      setEditZipFile(null);
      setEditZipInfo(null);
      loadProjects();
    } catch (error) {
      console.error('Failed to update project:', error);
      toast.error("更新项目失败");
    }
  };

  const handleToggleLanguage = (lang: string) => {
    const currentLanguages = editForm.programming_languages || [];
    const newLanguages = currentLanguages.includes(lang)
      ? currentLanguages.filter(l => l !== lang)
      : [...currentLanguages, lang];

    setEditForm({ ...editForm, programming_languages: newLanguages });
  };

  const handleDeleteClick = (project: Project) => {
    setProjectToDelete(project);
    setShowDeleteDialog(true);
  };

  const handleConfirmDelete = async () => {
    if (!projectToDelete) return;

    try {
      await api.deleteProject(projectToDelete.id);

      import('@/shared/utils/logger').then(({ logger }) => {
        logger.logUserAction('删除项目', {
          projectId: projectToDelete.id,
          projectName: projectToDelete.name,
        });
      });

      toast.success(`项目 "${projectToDelete.name}" 已移到回收站`, {
        description: '您可以在回收站中恢复此项目',
        duration: 4000
      });
      setShowDeleteDialog(false);
      setProjectToDelete(null);
      loadProjects();
    } catch (error: any) {
      console.error('Failed to delete project:', error);
      const detail = error?.response?.data?.detail || error?.message || '未知错误';
      toast.error(`删除项目失败: ${detail}`);
      setShowDeleteDialog(false);
    }
  };

  const handleTaskCreated = () => {
    toast.success("审计任务已创建", {
      description: '因为网络和代码文件大小等因素，审计时长通常至少需要1分钟，请耐心等待...',
      duration: 5000
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4">
          <div className="loading-spinner mx-auto" />
          <p className="text-muted-foreground font-sans text-sm uppercase tracking-wider">加载项目数据...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 px-6 pt-1 pb-6 bg-background min-h-screen font-sans relative">
      {/* Grid background */}
      <div className="absolute inset-0 cyber-grid-subtle pointer-events-none" />

      {/* 创建项目抽屉 */}
      <Sheet open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <SheetContent side="right" className="!w-[min(90vw,600px)] sm:max-w-[600px] !sm:max-w-none flex flex-col p-0 gap-0 border-border">
          {/* Header */}
          <SheetHeader className="px-6 py-5 border-b border-border flex-shrink-0">
            <SheetTitle className="font-sans text-lg text-foreground tracking-wide">
              新建项目
            </SheetTitle>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto">
            {/* 基本信息区 */}
            <div className="px-6 py-5 space-y-4 border-b border-border">
              <h3 className="text-xs font-sans font-bold uppercase text-muted-foreground tracking-widest">基本信息</h3>
              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-sm text-foreground">项目名称 <span className="text-destructive">*</span></Label>
                <Input
                  id="name"
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  placeholder="输入项目名称"
                  className="cyber-input"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="description" className="text-sm text-foreground">描述</Label>
                <Textarea
                  id="description"
                  value={createForm.description}
                  onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                  placeholder="项目描述..."
                  rows={2}
                  className="cyber-input min-h-[60px]"
                />
              </div>
            </div>

            {/* 扫描类型区 */}
            <div className="px-6 py-5 space-y-4 border-b border-border">
              <h3 className="text-xs font-sans font-bold uppercase text-muted-foreground tracking-widest">扫描类型</h3>
              <div className="grid grid-cols-2 gap-0 border border-border rounded overflow-hidden">
                <button
                  type="button"
                  className={`flex flex-col items-center justify-center gap-1 py-3 text-sm font-sans transition-colors ${
                    createForm.scan_mode === 'source'
                      ? 'bg-primary text-foreground font-bold'
                      : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                  }`}
                  onClick={() => setCreateForm({ ...createForm, scan_mode: 'source' })}
                >
                  <FileText className="w-4 h-4" />
                  <span>源代码扫描</span>
                  <span className="text-[10px] opacity-70 font-normal normal-case">支持 Git 仓库 / 本地上传</span>
                </button>
                <button
                  type="button"
                  className={`flex flex-col items-center justify-center gap-1 py-3 text-sm font-sans transition-colors ${
                    createForm.scan_mode === 'compiled'
                      ? 'bg-primary text-foreground font-bold'
                      : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                  }`}
                  onClick={() => setCreateForm({
                    ...createForm,
                    scan_mode: 'compiled',
                    source_type: 'zip', // compiled 强制本地上传
                  })}
                >
                  <Upload className="w-4 h-4" />
                  <span>编译后产物扫描</span>
                  <span className="text-[10px] opacity-70 font-normal normal-case">仅支持本地上传</span>
                </button>
              </div>
            </div>

            {/* 项目位置区 */}
            <div className="px-6 py-5 space-y-4">
              <h3 className="text-xs font-sans font-bold uppercase text-muted-foreground tracking-widest">项目位置</h3>
              <div className="grid grid-cols-2 gap-0 border border-border rounded overflow-hidden">
                <button
                  type="button"
                  disabled={createForm.scan_mode === 'compiled'}
                  className={`flex items-center justify-center gap-2 py-2.5 text-sm font-sans transition-colors ${
                    createForm.scan_mode === 'compiled'
                      ? 'bg-muted/30 text-muted-foreground/50 cursor-not-allowed'
                      : createForm.source_type === 'repository'
                        ? 'bg-primary text-foreground font-bold'
                        : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                  }`}
                  onClick={() => setCreateForm({ ...createForm, source_type: 'repository' })}
                  title={createForm.scan_mode === 'compiled' ? '编译后产物扫描仅支持本地上传' : undefined}
                >
                  <GitBranch className="w-4 h-4" />
                  仓库地址
                </button>
                <button
                  type="button"
                  className={`flex items-center justify-center gap-2 py-2.5 text-sm font-sans transition-colors ${
                    createForm.source_type === 'zip'
                      ? 'bg-primary text-foreground font-bold'
                      : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                  }`}
                  onClick={() => setCreateForm({ ...createForm, source_type: 'zip' })}
                >
                  <Upload className="w-4 h-4" />
                  本地上传
                </button>
              </div>
            </div>

            {/* 仓库地址表单 */}
            {createForm.source_type === 'repository' && (
              <div className="px-6 py-5 space-y-4 border-b border-border">
                <h3 className="text-xs font-sans font-bold uppercase text-muted-foreground tracking-widest">仓库配置</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="repository_url" className="text-sm text-foreground">仓库地址</Label>
                    <Input
                      id="repository_url"
                      value={createForm.repository_url}
                      onChange={(e) => setCreateForm({ ...createForm, repository_url: e.target.value })}
                      placeholder={
                        createForm.repository_type === 'other'
                          ? "git@github.com:user/repo.git"
                          : "https://github.com/user/repo"
                      }
                      className="cyber-input"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="repository_type" className="text-sm text-foreground">仓库类型</Label>
                    <Select
                      value={createForm.repository_type}
                      onValueChange={(value: any) => setCreateForm({ ...createForm, repository_type: value })}
                    >
                      <SelectTrigger className="cyber-input">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="cyber-dialog border-border">
                        {REPOSITORY_PLATFORMS.map((platform) => (
                          <SelectItem key={platform.value} value={platform.value}>
                            {platform.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {createForm.repository_type === 'other' && (
                  <p className="text-xs text-muted-foreground">
                    SSH Key 认证请使用 git@ 格式的 SSH URL
                  </p>
                )}
                <div className="space-y-1.5">
                  <Label htmlFor="default_branch" className="text-sm text-foreground">默认分支</Label>
                  <Input
                    id="default_branch"
                    value={createForm.default_branch}
                    onChange={(e) => setCreateForm({ ...createForm, default_branch: e.target.value })}
                    placeholder="main"
                    className="cyber-input"
                  />
                </div>
              </div>
            )}

            {/* 本地上传表单 */}
            {createForm.source_type === 'zip' && (
              <div className="px-6 py-5 space-y-4 border-b border-border">
                <h3 className="text-xs font-sans font-bold uppercase text-muted-foreground tracking-widest">上传源码</h3>

                {!selectedFile ? (
                  <div
                    className="border border-dashed border-border rounded-md p-8 text-center hover:border-primary/50 hover:bg-primary/5 transition-colors cursor-pointer"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">点击选择文件，最大支持4GB</p>
                    <p className="text-xs text-muted-foreground/50 mt-1">.zip .rar .7z .tar .gz .tgz .tar.gz</p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".zip,.rar,.7z,.tar,.gz,.tgz,.tar.gz"
                      onChange={handleFileSelect}
                      className="hidden"
                      disabled={uploading}
                    />
                  </div>
                ) : (
                  <div className="border border-border rounded-md p-3 flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 bg-primary/10 border border-primary/20 rounded flex items-center justify-center flex-shrink-0">
                        <FileText className="w-4 h-4 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{selectedFile.name}</p>
                        <p className="text-xs text-muted-foreground">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setSelectedFile(null)}
                      disabled={uploading}
                      className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive flex-shrink-0"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                )}

                {uploading && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{uploadProgress >= 100 ? '上传完成，处理中...' : '上传中...'}</span>
                      <span className="text-primary font-bold">{uploadProgress}%</span>
                    </div>
                    <Progress value={uploadProgress} className="h-1.5 bg-muted [&>div]:bg-primary" />
                  </div>
                )}
              </div>
            )}

            {/* Compiled Options - 仅 scan_mode='compiled' */}
            {createForm.scan_mode === 'compiled' && (
              <div className="px-6 py-5 space-y-4 border-b border-border">
                <h3 className="text-xs font-sans font-bold uppercase text-muted-foreground tracking-widest">编译产物扫描配置</h3>
                <div className="space-y-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={createForm.compiled_options?.enable_sca ?? true}
                      onChange={(e) => setCreateForm({
                        ...createForm,
                        compiled_options: {
                          ...(createForm.compiled_options ?? DEFAULT_COMPILED_OPTIONS),
                          enable_sca: e.target.checked,
                        },
                      })}
                      className="rounded border-border"
                    />
                    <span className="text-sm text-foreground">启用 SCA（已知 CVE 依赖检测）</span>
                  </label>
                  <div className="space-y-1.5">
                    <Label htmlFor="max-binary-size" className="text-sm text-foreground">单文件最大字节数 (MB)</Label>
                    <Input
                      id="max-binary-size"
                      type="number"
                      min={1}
                      max={MAX_BINARY_MB_CAP}
                      value={createForm.compiled_options?.max_binary_size_mb ?? 200}
                      onChange={(e) => setCreateForm({
                        ...createForm,
                        compiled_options: {
                          ...(createForm.compiled_options ?? DEFAULT_COMPILED_OPTIONS),
                          max_binary_size_mb: Math.max(1, Math.min(MAX_BINARY_MB_CAP, Number(e.target.value) || 200)),
                        },
                      })}
                      className="cyber-input"
                    />
                    <p className="text-xs text-muted-foreground">压缩包内支持的扩展名: .apk .aab .dex .so .dll .exe .elf — 其他文件将被忽略。</p>
                  </div>
                </div>
              </div>
            )}

            {/* 技术栈区 - 公共 */}
            <div className="px-6 py-5 space-y-4">
              <h3 className="text-xs font-sans font-bold uppercase text-muted-foreground tracking-widest">技术栈</h3>
              <Popover>
                <PopoverTrigger asChild>
                  <div className="cyber-input flex items-center justify-between cursor-pointer min-h-[36px] px-3 py-1.5 gap-1">
                    <div className="flex items-center gap-1 flex-wrap flex-1 min-w-0">
                      {createForm.programming_languages.length === 0 ? (
                        <span className="text-sm text-muted-foreground">选择技术栈</span>
                      ) : (
                        createForm.programming_languages.map((lang) => (
                          <Badge
                            key={lang}
                            className="bg-primary/10 text-primary border border-primary/20 px-1.5 py-0 text-xs font-sans leading-5 hover:bg-primary/20 cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation();
                              setCreateForm({
                                ...createForm,
                                programming_languages: createForm.programming_languages.filter(l => l !== lang)
                              });
                            }}
                          >
                            {lang}
                            <X className="w-3 h-3 ml-0.5" />
                          </Badge>
                        ))
                      )}
                    </div>
                    <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  </div>
                </PopoverTrigger>
                <PopoverContent className="w-[260px] p-1 cyber-dialog border-border" align="start">
                  {createForm.programming_languages.length > 0 && (
                    <button
                      className="w-full text-left px-3 py-1.5 text-xs text-destructive hover:bg-destructive/10 rounded font-sans"
                      onClick={() => setCreateForm({ ...createForm, programming_languages: [] })}
                    >
                      清除全部
                    </button>
                  )}
                  {supportedLanguages.map((lang) => {
                    const isSelected = createForm.programming_languages.includes(lang);
                    return (
                      <div
                        key={lang}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded cursor-pointer text-sm ${
                          isSelected
                            ? 'bg-primary/10 text-primary'
                            : 'hover:bg-muted text-foreground'
                        }`}
                        onClick={() => {
                          if (isSelected) {
                            setCreateForm({
                              ...createForm,
                              programming_languages: createForm.programming_languages.filter(l => l !== lang)
                            });
                          } else {
                            setCreateForm({
                              ...createForm,
                              programming_languages: [...createForm.programming_languages, lang]
                            });
                          }
                        }}
                      >
                        <div className={`w-3.5 h-3.5 border rounded-sm flex items-center justify-center flex-shrink-0 ${
                          isSelected ? 'bg-primary border-primary' : 'border-border'
                        }`}>
                          {isSelected && <CheckCircle className="w-3 h-3 text-foreground" />}
                        </div>
                        <span className="font-sans text-xs">{lang}</span>
                      </div>
                    );
                  })}
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Footer */}
          <div className="flex-shrink-0 flex justify-end gap-3 px-6 py-4 border-t border-border bg-background">
            <Button variant="outline" onClick={() => setShowCreateDialog(false)} disabled={uploading} className="cyber-btn-outline">
              取消
            </Button>
            <Button
              onClick={createForm.source_type === 'zip' ? handleUploadAndCreate : handleCreateProject}
              className="cyber-btn-primary"
              disabled={createForm.source_type === 'zip' ? (!selectedFile || uploading) : false}
            >
              {uploading ? '上传中...' : '执行创建'}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Project Table */}
      <div className="relative z-10">
        <div className="cyber-card p-0">
          {/* Toolbar */}
          <div className="p-4 flex items-center gap-3 border-b border-border flex-wrap">
            <div className="relative flex-1 min-w-[180px] max-w-[240px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <Input
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="搜索项目名称"
                className="h-8 text-sm !pl-9"
              />
            </div>
            <Select value={filterLang} onValueChange={setFilterLang}>
              <SelectTrigger className="cyber-input h-8 w-[140px] text-sm">
                <SelectValue placeholder="开发语言" />
                </SelectTrigger>
                <SelectContent className="cyber-dialog border-border">
                  <SelectItem value="all">全部语言</SelectItem>
                  {supportedLanguages.map(lang => (
                    <SelectItem key={lang.toLowerCase()} value={lang.toLowerCase()}>{lang}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="ml-auto flex gap-2">
                <Button className="cyber-btn-primary h-8" onClick={() => setShowCreateDialog(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  新建项目
                </Button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="text-left py-2 px-6 font-medium">项目名称</th>
                    <th className="text-left py-2 px-3 font-medium">项目描述</th>
                    <th className="text-left py-2 px-3 font-medium">扫描类型</th>
                    <th className="text-left py-2 px-3 font-medium">开发语言</th>
                    <th className="text-left py-2 px-3 font-medium">项目负责人</th>
                    <th className="text-left py-2 px-3 font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProjects.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-muted-foreground">
                        {searchTerm || filterLang !== 'all' ? '未找到匹配项' : '当前无项目'}
                      </td>
                    </tr>
                  ) : (
                    filteredProjects.map((project) => (
                      <tr key={project.id} className="border-b border-border/50 hover:bg-muted/50 transition-colors">
                        <td className="py-2.5 px-6">
                          <span className="font-medium text-foreground">{project.name}</span>
                        </td>
                        <td className="py-2.5 px-3 text-muted-foreground max-w-md truncate">{project.description || '-'}</td>
                        <td className="py-2.5 px-3">
                          <Badge className={project.scan_mode === 'compiled' ? 'cyber-badge-warning' : 'cyber-badge-info'}>
                            {project.scan_mode === 'compiled' ? '编译后产物' : '源代码'}
                          </Badge>
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="flex flex-wrap gap-1">
                            {project.programming_languages ? (
                              safeJsonParseArray(project.programming_languages).slice(0, 3).map((lang: string) => (
                                <span key={lang} className="text-xs font-sans font-bold border border-primary/30 px-1.5 py-0.5 bg-primary/10 text-primary rounded">
                                  {lang.toUpperCase()}
                                </span>
                              ))
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                            {project.programming_languages && safeJsonParseArray(project.programming_languages).length > 3 && (
                              <span className="text-xs font-sans font-bold border border-border px-1.5 py-0.5 bg-muted text-muted-foreground rounded">
                                +{safeJsonParseArray(project.programming_languages).length - 3}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-muted-foreground">
                          {project.owner?.full_name || '-'}
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-1">
                            <Link to={`/projects/${project.id}`}>
                              <Button variant="ghost" size="icon" className="cyber-btn-ghost h-7 w-7" title="查看详情">
                                <Eye className="w-3.5 h-3.5" />
                              </Button>
                            </Link>
                            <Button variant="ghost" size="icon" onClick={() => handleEditClick(project)} className="cyber-btn-ghost h-7 w-7">
                              <Edit className="w-3.5 h-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDeleteClick(project)} className="h-7 w-7 hover:bg-destructive/12 hover:text-destructive">
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

      {/* Create Task Dialog */}
      <CreateTaskDialog
        open={showCreateTaskDialog}
        onOpenChange={setShowCreateTaskDialog}
        onTaskCreated={handleTaskCreated}
        onFastScanStarted={handleFastScanStarted}
        preselectedProjectId={selectedProjectForTask}
      />

      {/* Terminal Progress Dialog for Fast Scan */}
      <TerminalProgressDialog
        open={showTerminal}
        onOpenChange={setShowTerminal}
        taskId={currentTaskId}
        taskType="repository"
      />

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="!w-[min(90vw,700px)] !max-w-none max-h-[85vh] flex flex-col p-0 gap-0 cyber-dialog border border-border rounded-lg">
          {/* Terminal Header */}
          <div className="flex items-center gap-2 px-4 py-3 cyber-bg-elevated border-b border-border flex-shrink-0">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-500/80" />
              <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
              <div className="w-3 h-3 rounded-full bg-green-500/80" />
            </div>
            <span className="ml-2 font-sans text-xs text-muted-foreground tracking-wider">
              edit_project@dbapp
            </span>
          </div>

          <DialogHeader className="px-6 pt-4 flex-shrink-0">
            <DialogTitle className="font-sans text-lg uppercase tracking-wider flex items-center gap-2 text-foreground">
              <Edit className="w-5 h-5 text-primary" />
              编辑项目配置
              {projectToEdit && (
                <Badge className={`ml-2 ${editForm.source_type === 'repository' ? 'cyber-badge-info' : 'cyber-badge-warning'}`}>
                  {editForm.source_type === 'repository' ? '远程仓库' : '本地上传'}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* 基本信息 */}
            <div className="space-y-4">
              <h3 className="font-sans font-bold uppercase text-sm text-muted-foreground border-b border-border pb-2">基本信息</h3>
              <div>
                <Label htmlFor="edit-name" className="font-sans font-bold uppercase text-xs text-muted-foreground">项目名称 *</Label>
                <Input
                  id="edit-name"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="cyber-input mt-1"
                />
              </div>
              <div>
                <Label htmlFor="edit-description" className="font-sans font-bold uppercase text-xs text-muted-foreground">描述</Label>
                <Textarea
                  id="edit-description"
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  rows={3}
                  className="cyber-input mt-1"
                />
              </div>
            </div>

            {/* 扫描配置（只读） */}
            <div className="space-y-4">
              <h3 className="font-sans font-bold uppercase text-sm text-muted-foreground border-b border-border pb-2">扫描配置</h3>
              <div className="flex items-center gap-3">
                <Label className="font-sans font-bold uppercase text-xs text-muted-foreground">扫描类型</Label>
                <Badge className={editForm.scan_mode === 'compiled' ? 'cyber-badge-warning' : 'cyber-badge-info'}>
                  {editForm.scan_mode === 'compiled' ? '编译后产物' : '源代码'}
                </Badge>
                <span className="text-xs text-muted-foreground">创建后不可修改</span>
              </div>
            </div>

            {/* 仓库信息 - 仅远程仓库类型显示 */}
            {editForm.source_type === 'repository' && (
              <div className="space-y-4">
                <h3 className="font-sans font-bold uppercase text-sm text-muted-foreground border-b border-border pb-2 flex items-center gap-2">
                  <GitBranch className="w-4 h-4" />
                  仓库信息
                </h3>

                <div>
                  <Label htmlFor="edit-repo-url" className="font-sans font-bold uppercase text-xs text-muted-foreground">仓库地址</Label>
                  <Input
                    id="edit-repo-url"
                    value={editForm.repository_url}
                    onChange={(e) => setEditForm({ ...editForm, repository_url: e.target.value })}
                    placeholder={
                      editForm.repository_type === 'other'
                        ? "git@github.com:user/repo.git"
                        : "https://github.com/user/repo"
                    }
                    className="cyber-input mt-1"
                  />
                  {editForm.repository_type === 'other' && (
                    <p className="text-xs text-muted-foreground font-sans mt-1">
                      💡 SSH Key认证请使用 git@ 格式的SSH URL
                    </p>
                  )}
                  {editForm.repository_type !== 'other' && editForm.repository_type !== 'svn' && (
                    <p className="text-xs text-muted-foreground font-sans mt-1">
                      💡 Token认证请使用 https:// 格式的URL
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="edit-repo-type" className="font-sans font-bold uppercase text-xs text-muted-foreground">认证类型</Label>
                    <Select
                      value={editForm.repository_type}
                      onValueChange={(value: any) => setEditForm({ ...editForm, repository_type: value })}
                    >
                      <SelectTrigger id="edit-repo-type" className="cyber-input mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="cyber-dialog border-border">
                        {REPOSITORY_PLATFORMS.map((platform) => (
                          <SelectItem key={platform.value} value={platform.value}>
                            {platform.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="edit-default-branch" className="font-sans font-bold uppercase text-xs text-muted-foreground">默认分支</Label>
                    <Input
                      id="edit-default-branch"
                      value={editForm.default_branch}
                      onChange={(e) => setEditForm({ ...editForm, default_branch: e.target.value })}
                      placeholder="main"
                      className="cyber-input mt-1"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* 归档项目文件管理 */}
            {editForm.source_type === 'zip' && (
              <div className="space-y-4">
                <h3 className="font-sans font-bold uppercase text-sm text-muted-foreground border-b border-border pb-2 flex items-center gap-2">
                  <Upload className="w-4 h-4" />
                  本地文件管理
                </h3>

                {loadingEditZipInfo ? (
                  <div className="flex items-center space-x-3 p-4 bg-secondary/8 border border-secondary/25 rounded">
                    <div className="loading-spinner w-5 h-5"></div>
                    <p className="text-sm text-secondary font-bold font-sans">正在加载本地文件信息...</p>
                  </div>
                ) : editZipInfo?.has_file ? (
                  <div className="bg-primary/10 border border-primary/25 p-4 rounded">
                    <div className="flex items-start space-x-3">
                      <FileText className="w-5 h-5 text-primary mt-0.5" />
                      <div className="flex-1 text-sm font-sans">
                        <p className="font-bold text-emerald-300 mb-1 uppercase">当前存储的本地文件</p>
                        <p className="text-primary/80 text-xs">
                          文件名: {editZipInfo.original_filename}
                          {editZipInfo.file_size && (
                            <> ({editZipInfo.file_size >= 1024 * 1024
                              ? `${(editZipInfo.file_size / 1024 / 1024).toFixed(2)} MB`
                              : `${(editZipInfo.file_size / 1024).toFixed(2)} KB`
                            })</>
                          )}
                        </p>
                        {editZipInfo.uploaded_at && (
                          <p className="text-primary/60 text-xs mt-0.5">
                            上传时间: {new Date(editZipInfo.uploaded_at).toLocaleString('zh-CN')}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-warning/8 border border-warning/25 p-4 rounded">
                    <div className="flex items-start space-x-3">
                      <AlertCircle className="w-5 h-5 text-warning mt-0.5" />
                      <div className="text-sm font-sans">
                        <p className="font-bold text-warning mb-1 uppercase">暂无本地文件</p>
                        <p className="text-warning/80 text-xs">
                          此项目还没有上传本地文件，请上传文件以便进行代码审计。
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* 上传新文件 */}
                <div className="space-y-2">
                  <Label className="font-sans font-bold uppercase text-xs text-muted-foreground">
                    {editZipInfo?.has_file ? '更新本地文件' : '上传本地文件'}
                  </Label>
                  <input
                    ref={editZipInputRef}
                    type="file"
                    accept=".zip,.rar,.7z,.tar,.gz,.tgz,.tar.gz"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const validation = validateZipFile(file);
                        if (!validation.valid) {
                          toast.error(validation.error || "文件无效");
                          e.target.value = '';
                          return;
                        }
                        setEditZipFile(file);
                        toast.success(`已选择文件: ${file.name}`);
                      }
                    }}
                  />

                  {editZipFile ? (
                    <div className="flex items-center justify-between p-3 bg-secondary/8 border border-secondary/25 rounded">
                      <div className="flex items-center space-x-2">
                        <FileText className="w-4 h-4 text-secondary" />
                        <span className="text-sm font-sans font-bold text-secondary">{editZipFile.name}</span>
                        <span className="text-xs text-muted-foreground">
                          ({(editZipFile.size / 1024 / 1024).toFixed(2)} MB)
                        </span>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setEditZipFile(null)}
                        className="cyber-btn-ghost h-7 text-xs"
                      >
                        取消
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      onClick={() => editZipInputRef.current?.click()}
                      className="cyber-btn-outline w-full"
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      {editZipInfo?.has_file ? '选择新文件替换' : '选择本地文件'}
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* 技术栈 */}
            <div className="space-y-4">
              <h3 className="font-sans font-bold uppercase text-sm text-muted-foreground border-b border-border pb-2">技术栈</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {supportedLanguages.map((lang) => (
                  <div
                    key={lang}
                    className={`flex items-center space-x-2 p-2 border cursor-pointer transition-all rounded ${editForm.programming_languages?.includes(lang)
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border hover:border-border text-muted-foreground'
                      }`}
                    onClick={() => handleToggleLanguage(lang)}
                  >
                    <div
                      className={`w-4 h-4 border-2 rounded-sm flex items-center justify-center ${editForm.programming_languages?.includes(lang)
                        ? 'bg-primary border-primary'
                        : 'border-border'
                        }`}
                    >
                      {editForm.programming_languages?.includes(lang) && (
                        <CheckCircle className="w-3 h-3 text-foreground" />
                      )}
                    </div>
                    <span className="text-sm font-sans font-bold uppercase">{lang}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex-shrink-0 flex justify-end gap-3 px-6 py-4 bg-muted border-t border-border">
            <Button variant="outline" onClick={() => setShowEditDialog(false)} className="cyber-btn-outline">
              取消
            </Button>
            <Button onClick={handleSaveEdit} className="cyber-btn-primary">
              保存更改
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="cyber-card border-border cyber-dialog p-0 !fixed">
          {/* Terminal Header */}
          <div className="flex items-center gap-2 px-4 py-3 bg-destructive/8 border-b border-destructive/25">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-500/80" />
              <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
              <div className="w-3 h-3 rounded-full bg-green-500/80" />
            </div>
            <span className="ml-2 font-sans text-xs text-destructive tracking-wider">
              confirm_delete@dbapp
            </span>
          </div>

          <AlertDialogHeader className="p-6">
            <AlertDialogTitle className="font-sans text-lg uppercase tracking-wider flex items-center gap-2 text-foreground">
              <Trash2 className="w-5 h-5 text-destructive" />
              确认删除
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground font-sans">
              您确定要移动 <span className="font-bold text-destructive">"{projectToDelete?.name}"</span> 到回收站吗？
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="px-6 pb-6">
            <div className="bg-secondary/8 border border-secondary/25 p-4 rounded">
              <p className="text-secondary font-bold mb-2 font-sans uppercase text-sm">系统通知:</p>
              <ul className="list-none text-secondary/80 space-y-1 text-xs font-sans">
                <li className="flex items-center gap-2"><span className="text-secondary">&gt;</span> 项目移至回收站</li>
                <li className="flex items-center gap-2"><span className="text-secondary">&gt;</span> 可恢复</li>
                <li className="flex items-center gap-2"><span className="text-secondary">&gt;</span> 审计数据保留</li>
                <li className="flex items-center gap-2"><span className="text-secondary">&gt;</span> 在回收站中永久删除</li>
              </ul>
            </div>
          </div>

          <AlertDialogFooter className="p-4 border-t border-border bg-muted/50">
            <AlertDialogCancel className="cyber-btn-outline">取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="cyber-btn bg-destructive/90 border-destructive/40 text-foreground hover:bg-destructive"
            >
              确认删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
