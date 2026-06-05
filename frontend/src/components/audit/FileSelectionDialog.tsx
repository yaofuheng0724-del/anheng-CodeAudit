/**
 * File Selection Dialog
 * Simplified list-style display
 */

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Search,
    File,
    Loader2,
} from "lucide-react";
import { api } from "@/shared/config/database";
import { toast } from "sonner";

interface FileSelectionDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    projectId: string;
    branch?: string;
    excludePatterns?: string[];
    onConfirm: (selectedFiles: string[]) => void;
}

export default function FileSelectionDialog({
    open,
    onOpenChange,
    projectId,
    branch,
    excludePatterns,
    onConfirm,
}: FileSelectionDialogProps) {
    const [files, setFiles] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
    const [searchTerm, setSearchTerm] = useState("");

    useEffect(() => {
        if (open && projectId) {
            loadFiles();
        } else {
            setFiles([]);
            setSelectedFiles(new Set());
            setSearchTerm("");
        }
    }, [open, projectId, branch, excludePatterns]);

    const loadFiles = async () => {
        try {
            setLoading(true);
            const data = await api.getProjectFiles(projectId, branch, excludePatterns);
            const paths = data.map((f: { path: string }) => f.path);
            setFiles(paths);
            setSelectedFiles(new Set(paths));
        } catch (error) {
            console.error("Failed to load files:", error);
            toast.error("加载文件列表失败");
        } finally {
            setLoading(false);
        }
    };

    const filteredFiles = useMemo(() => {
        if (!searchTerm) return files;
        const term = searchTerm.toLowerCase();
        return files.filter((f) => f.toLowerCase().includes(term));
    }, [files, searchTerm]);

    const handleToggleFile = useCallback((path: string) => {
        setSelectedFiles((prev) => {
            const newSelected = new Set(prev);
            if (newSelected.has(path)) {
                newSelected.delete(path);
            } else {
                newSelected.add(path);
            }
            return newSelected;
        });
    }, []);

    const handleSelectAll = () => {
        setSelectedFiles(new Set(filteredFiles));
    };

    const handleDeselectAll = () => {
        setSelectedFiles(new Set());
    };

    const handleConfirm = () => {
        if (selectedFiles.size === 0) {
            toast.error("请至少选择一个文件");
            return;
        }
        onConfirm(Array.from(selectedFiles));
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="!max-w-[480px] !w-[95vw] max-h-[80vh] z-[60] flex flex-col p-0 rounded-sm">
                <DialogHeader className="px-4 py-3 flex-shrink-0 border-b border-border">
                    <DialogTitle className="text-sm">选择文件</DialogTitle>
                </DialogHeader>

                <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                    {/* 搜索 + 全选/清空 */}
                    <div className="px-4 py-2 flex items-center gap-2 border-b border-border">
                        <div className="relative flex-1">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                            <Input
                                placeholder="搜索文件..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-8 h-8 text-xs rounded-sm"
                            />
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleSelectAll}
                            className="h-8 text-xs rounded-sm"
                        >
                            全选
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleDeselectAll}
                            className="h-8 text-xs rounded-sm"
                        >
                            清空
                        </Button>
                    </div>

                    {/* 文件列表 */}
                    <div className="flex-1 overflow-y-auto px-2 py-1">
                        {loading ? (
                            <div className="flex items-center justify-center h-full">
                                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                            </div>
                        ) : filteredFiles.length > 0 ? (
                            filteredFiles.map((path) => (
                                <div
                                    key={path}
                                    className="flex items-center gap-2 px-2 py-1.5 hover:bg-muted/50 cursor-pointer rounded-sm transition-colors"
                                    onClick={() => handleToggleFile(path)}
                                >
                                    <Checkbox
                                        checked={selectedFiles.has(path)}
                                        onCheckedChange={() => handleToggleFile(path)}
                                        className="h-3.5 w-3.5 border-border data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                                    />
                                    <File className="w-3.5 h-3.5 text-muted-foreground" />
                                    <span className="text-xs truncate flex-1 min-w-0" title={path}>
                                        {path}
                                    </span>
                                </div>
                            ))
                        ) : (
                            <div className="flex items-center justify-center h-full text-muted-foreground text-xs">
                                {searchTerm ? "没有匹配的文件" : "没有找到文件"}
                            </div>
                        )}
                    </div>
                </div>

                {/* 底部：已选数量 + 确认/取消 */}
                <div className="px-4 py-3 border-t border-border flex items-center justify-between flex-shrink-0">
                    <span className="text-xs text-muted-foreground">
                        已选 <strong className="text-foreground">{selectedFiles.size}</strong> / {files.length} 个文件
                    </span>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            className="h-8 text-xs rounded-sm"
                        >
                            取消
                        </Button>
                        <Button
                            onClick={handleConfirm}
                            disabled={selectedFiles.size === 0}
                            className="h-8 text-xs rounded-sm"
                        >
                            确认选择 ({selectedFiles.size})
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}