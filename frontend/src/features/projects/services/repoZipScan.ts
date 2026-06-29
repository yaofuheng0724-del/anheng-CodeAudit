import { apiClient } from "@/shared/api/serverClient";
import type { CompiledScanOptions, ProjectScanMode } from "@/shared/types";

const SUPPORTED_ARCHIVE_EXTENSIONS = [
  ".zip",
  ".rar",
  ".7z",
  ".tar",
  ".gz",
  ".tgz",
  ".tar.gz",
];

const SUPPORTED_COMPILED_EXTENSIONS = [
  ".apk", ".aab", ".dex",
  ".jar", ".war", ".ear", ".aar", ".class",
  ".so", ".dll", ".exe", ".elf",
  ".o", ".obj", ".a", ".lib", ".dylib",
];

export const SOURCE_UPLOAD_ACCEPT = SUPPORTED_ARCHIVE_EXTENSIONS.join(",");
export const COMPILED_UPLOAD_ACCEPT = [
  ...SUPPORTED_ARCHIVE_EXTENSIONS,
  ...SUPPORTED_COMPILED_EXTENSIONS,
].join(",");

/**
 * 上传本地文件并启动扫描
 */
export async function scanZipFile(params: {
  projectId: string;
  zipFile: File;
  taskName?: string;
  excludePatterns?: string[];
  createdBy?: string;
  filePaths?: string[];
  ruleSetId?: string;
  promptTemplateId?: string;
  functionWhitelist?: string[];
  vulnerabilityWhitelist?: string[];
  sanitizerFunctions?: string[];
  scanMode?: ProjectScanMode;
  compiledOptions?: CompiledScanOptions;
  taskType?: "repository" | "iac_scan";
}): Promise<string> {
  const formData = new FormData();
  formData.append("file", params.zipFile);
  formData.append("project_id", params.projectId);

  const scanConfig = {
    file_paths: params.filePaths,
    name: params.taskName?.trim() || undefined,
    full_scan: !params.filePaths || params.filePaths.length === 0,
    exclude_patterns: params.excludePatterns || [],
    rule_set_id: params.ruleSetId,
    prompt_template_id: params.promptTemplateId,
    functionWhitelist: params.functionWhitelist || [],
    vulnerabilityWhitelist: params.vulnerabilityWhitelist || [],
    sanitizerFunctions: params.sanitizerFunctions || [],
    scan_mode: params.scanMode || "source",
    compiled_options: params.compiledOptions || null,
    task_type: params.taskType || "repository",
  };
  formData.append("scan_config", JSON.stringify(scanConfig));

  const res = await apiClient.post(`/scan/upload-zip`, formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });

  return res.data.task_id;
}

/**
 * 使用已存储的ZIP文件启动扫描（无需重新上传）
 */
export async function scanStoredZipFile(params: {
  projectId: string;
  taskName?: string;
  excludePatterns?: string[];
  createdBy?: string;
  filePaths?: string[];
  ruleSetId?: string;
  promptTemplateId?: string;
  functionWhitelist?: string[];
  vulnerabilityWhitelist?: string[];
  sanitizerFunctions?: string[];
  scanMode?: ProjectScanMode;
  compiledOptions?: CompiledScanOptions;
  taskType?: "repository" | "iac_scan";
}): Promise<string> {
  const scanRequest = {
    file_paths: params.filePaths,
    name: params.taskName?.trim() || undefined,
    full_scan: !params.filePaths || params.filePaths.length === 0,
    exclude_patterns: params.excludePatterns || [],
    rule_set_id: params.ruleSetId,
    prompt_template_id: params.promptTemplateId,
    functionWhitelist: params.functionWhitelist || [],
    vulnerabilityWhitelist: params.vulnerabilityWhitelist || [],
    sanitizerFunctions: params.sanitizerFunctions || [],
    scan_mode: params.scanMode || "source",
    compiled_options: params.compiledOptions || null,
    task_type: params.taskType || "repository",
  };
  const res = await apiClient.post(`/scan/scan-stored-zip`, scanRequest, {
    params: { project_id: params.projectId },
  });

  return res.data.task_id;
}

export function validateZipFile(file: File, scanMode: ProjectScanMode = "source"): { valid: boolean; error?: string } {
  const normalizedName = file.name.toLowerCase();
  const supportedExtensions = scanMode === "compiled"
    ? [...SUPPORTED_ARCHIVE_EXTENSIONS, ...SUPPORTED_COMPILED_EXTENSIONS]
    : SUPPORTED_ARCHIVE_EXTENSIONS;
  const isSupported = supportedExtensions.some((ext) => normalizedName.endsWith(ext));
  if (!isSupported) {
    return {
      valid: false,
      error: scanMode === "compiled"
        ? '请上传 zip、rar、7z、tar、gz、tgz、tar.gz，或 jar、war、ear、aar、class、apk、aab、dex、so、dll、exe、elf 等编译后产物'
        : '请上传 zip、rar、7z、tar、gz、tgz、tar.gz 等本地文件',
    };
  }

  const maxSize = 2 * 1024 * 1024 * 1024;
  if (file.size > maxSize) {
    return { valid: false, error: '文件大小不能超过2GB' };
  }

  return { valid: true };
}
