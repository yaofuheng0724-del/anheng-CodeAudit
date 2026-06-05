/**
 * 本地文件存储工具
 * 通过后端 API 管理项目本地文件
 */

import { apiClient } from '@/shared/api/serverClient';

export interface ZipFileMeta {
  has_file: boolean;
  original_filename?: string;
  file_size?: number;
  uploaded_at?: string;
}

export type UploadProgressCallback = (progress: number) => void;

/**
 * 获取项目本地文件信息
 */
export async function getZipFileInfo(projectId: string): Promise<ZipFileMeta> {
  try {
    const response = await apiClient.get(`/projects/${projectId}/zip`);
    return response.data;
  } catch (error) {
    console.error('获取本地文件信息失败:', error);
    return { has_file: false };
  }
}

/**
 * 上传项目本地文件
 *
 * @param projectId 项目ID
 * @param file 要上传的文件
 * @param onProgress 上传进度回调 (0-100)
 * @throws 上传失败时抛出错误，由调用方处理
 */
export async function uploadZipFile(
  projectId: string,
  file: File,
  onProgress?: UploadProgressCallback,
): Promise<{
  success: boolean;
  message?: string;
  original_filename?: string;
  file_size?: number;
}> {
  const formData = new FormData();
  formData.append('file', file);

  try {
    const response = await apiClient.post(`/projects/${projectId}/zip`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      // 上传大文件需要更长的超时时间：基于文件大小动态计算
      // 假设最低上传速度 1MB/s，至少给 60 秒基础时间
      timeout: Math.max(60_000, (file.size / 1024 / 1024) * 1000) * 2,
      onUploadProgress: (progressEvent) => {
        if (progressEvent.total && onProgress) {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total,
          );
          onProgress(percentCompleted);
        }
      },
    });
    return {
      success: true,
      message: response.data.message,
      original_filename: response.data.original_filename,
      file_size: response.data.file_size,
    };
  } catch (error: any) {
    console.error('上传本地文件失败:', error);
    // 优先使用服务器返回的详细错误信息，否则根据错误类型生成提示
    const serverDetail = error.response?.data?.detail;
    const detail = serverDetail
      ? serverDetail
      : error.code === 'ECONNABORTED'
        ? '上传超时，请检查网络连接或尝试较小的文件'
        : '上传失败';
    // 向调用方抛出错误而非静默返回，确保 UI 能正确提示
    throw new Error(detail);
  }
}

/**
 * 删除项目本地文件
 */
export async function deleteZipFile(projectId: string): Promise<boolean> {
  try {
    await apiClient.delete(`/projects/${projectId}/zip`);
    return true;
  } catch (error) {
    console.error('删除本地文件失败:', error);
    return false;
  }
}

/**
 * 检查项目是否已有本地文件
 */
export async function hasZipFile(projectId: string): Promise<boolean> {
  const info = await getZipFileInfo(projectId);
  return info.has_file;
}

/**
 * 格式化文件大小
 */
export function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  } else if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(2)} KB`;
  }
  return `${bytes} B`;
}
