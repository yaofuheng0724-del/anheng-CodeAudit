from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from pydantic import BaseModel, field_validator
from datetime import datetime, timezone
from pathlib import Path
import shutil
import os
import tempfile
import uuid
import json
import logging

logger = logging.getLogger(__name__)

from app.api import deps
from app.db.session import get_db, AsyncSessionLocal
from app.models.project import Project
from app.models.user import User
from app.models.user_config import UserConfig
from app.models.audit import AuditTask, AuditIssue
from app.models.agent_task import AgentTask, AgentTaskStatus, AgentFinding
from app.services.ai_investigation import (
    execute_batch_investigation,
    get_batch_progress,
    set_batch_progress,
)
from app.core.config import settings
from app.services.archive_utils import extract_archive_recursive, is_supported_archive
from app.services.quick_scan import collect_source_files
from app.services.scanner import (
    get_github_branches,
    get_gitlab_branches,
    get_gitea_branches,
    materialize_repository_workspace,
    parse_compiled_options,
    scan_repo_task,
    scan_iac_task,
)
from app.services.zip_storage import (
    save_project_zip, load_project_zip, get_project_zip_meta,
    delete_project_zip, has_project_zip
)

router = APIRouter()

# Schemas
class ProjectCreate(BaseModel):
    name: str
    source_type: Optional[str] = "repository"  # 'repository' 或 'zip'
    repository_url: Optional[str] = None
    repository_type: Optional[str] = "other"  # github, gitlab, other
    description: Optional[str] = None
    default_branch: Optional[str] = "main"
    programming_languages: Optional[List[str]] = None
    scan_mode: Optional[str] = "source"
    compiled_options: Optional[Dict[str, Any]] = None

class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    source_type: Optional[str] = None
    repository_url: Optional[str] = None
    repository_type: Optional[str] = None
    description: Optional[str] = None
    default_branch: Optional[str] = None
    programming_languages: Optional[List[str]] = None

class OwnerSchema(BaseModel):
    id: str
    email: Optional[str] = None
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None
    role: Optional[str] = None

    class Config:
        from_attributes = True

class ProjectResponse(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    source_type: Optional[str] = "repository"  # 'repository' 或 'zip'
    repository_url: Optional[str] = None
    repository_type: Optional[str] = None  # github, gitlab, other
    default_branch: Optional[str] = None
    programming_languages: Optional[str] = None
    owner_id: str
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime] = None
    owner: Optional[OwnerSchema] = None
    scan_mode: Optional[str] = "source"
    compiled_options: Optional[Dict[str, Any]] = None

    @field_validator("compiled_options", mode="before")
    @classmethod
    def _parse_compiled_options(cls, v):
        if v is None or v == "":
            return None
        if isinstance(v, dict):
            return v
        if isinstance(v, str):
            try:
                return json.loads(v)
            except Exception:
                return None
        return v

    class Config:
        from_attributes = True

class StatsResponse(BaseModel):
    total_projects: int
    active_projects: int
    total_tasks: int
    completed_tasks: int
    total_issues: int
    resolved_issues: int
    avg_quality_score: float = 0.0

@router.post("/", response_model=ProjectResponse)
async def create_project(
    *,
    db: AsyncSession = Depends(get_db),
    project_in: ProjectCreate,
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """
    Create new project.
    """
    import json
    # 根据 source_type 设置默认值
    source_type = project_in.source_type or "repository"

    scan_mode = project_in.scan_mode or "source"
    if scan_mode == "compiled" and source_type != "zip":
        raise HTTPException(
            status_code=400,
            detail="编译后产物扫描仅支持本地上传，请将代码来源设置为 zip。",
        )

    project = Project(
        name=project_in.name,
        source_type=source_type,
        repository_url=project_in.repository_url if source_type == "repository" else None,
        repository_type=project_in.repository_type or "other" if source_type == "repository" else "other",
        description=project_in.description,
        default_branch=project_in.default_branch or "main",
        programming_languages=json.dumps(project_in.programming_languages or []),
        owner_id=current_user.id,
        scan_mode=scan_mode,
        compiled_options=json.dumps(project_in.compiled_options) if project_in.compiled_options else None,
    )
    db.add(project)
    await db.commit()
    await db.refresh(project)
    return project

@router.get("/", response_model=List[ProjectResponse])
async def read_projects(
    db: AsyncSession = Depends(get_db),
    skip: int = 0,
    limit: int = 100,
    include_deleted: bool = False,
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """
    Retrieve projects for current user.
    """
    query = select(Project).options(selectinload(Project.owner))
    # 只返回当前用户的项目
    query = query.where(Project.owner_id == current_user.id)
    if not include_deleted:
        query = query.where(Project.is_active == True)
    query = query.order_by(Project.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()

@router.get("/deleted", response_model=List[ProjectResponse])
async def read_deleted_projects(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """
    Retrieve deleted (soft-deleted) projects for current user.
    """
    result = await db.execute(
        select(Project)
        .options(selectinload(Project.owner))
        .where(Project.owner_id == current_user.id)
        .where(Project.is_active == False)
        .order_by(Project.updated_at.desc())
    )
    return result.scalars().all()

@router.get("/stats", response_model=StatsResponse)
async def get_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """
    Get statistics for current user.
    """
    # 只统计当前用户的项目
    projects_result = await db.execute(
        select(Project).where(Project.owner_id == current_user.id)
    )
    projects = projects_result.scalars().all()
    project_ids = [p.id for p in projects]

    # 统计旧的 AuditTask
    tasks_result = await db.execute(
        select(AuditTask).where(AuditTask.project_id.in_(project_ids)) if project_ids else select(AuditTask).where(False)
    )
    tasks = tasks_result.scalars().all()
    task_ids = [t.id for t in tasks]

    # 统计旧的 AuditIssue
    issues_result = await db.execute(
        select(AuditIssue).where(AuditIssue.task_id.in_(task_ids)) if task_ids else select(AuditIssue).where(False)
    )
    issues = issues_result.scalars().all()

    # 🔥 同时统计新的 AgentTask
    agent_tasks_result = await db.execute(
        select(AgentTask).where(AgentTask.project_id.in_(project_ids)) if project_ids else select(AgentTask).where(False)
    )
    agent_tasks = agent_tasks_result.scalars().all()
    agent_task_ids = [t.id for t in agent_tasks]

    # 🔥 统计 AgentFinding
    agent_findings_result = await db.execute(
        select(AgentFinding).where(AgentFinding.task_id.in_(agent_task_ids)) if agent_task_ids else select(AgentFinding).where(False)
    )
    agent_findings = agent_findings_result.scalars().all()

    # 合并统计（旧任务 + 新 Agent 任务）
    total_tasks = len(tasks) + len(agent_tasks)
    completed_tasks = (
        len([t for t in tasks if t.status == "completed"]) +
        len([t for t in agent_tasks if t.status == AgentTaskStatus.COMPLETED])
    )
    total_issues = len(issues) + len(agent_findings)
    resolved_issues = (
        len([i for i in issues if i.status == "fixed"]) +
        len([f for f in agent_findings if f.status == "fixed"])
    )

    # 计算平均质量分（只统计已完成且有质量分的任务）
    quality_scores = (
        [t.quality_score for t in tasks if t.status == "completed" and t.quality_score and t.quality_score > 0] +
        [t.quality_score for t in agent_tasks if t.status == AgentTaskStatus.COMPLETED and t.quality_score and t.quality_score > 0]
    )
    avg_quality_score = sum(quality_scores) / len(quality_scores) if quality_scores else 0.0

    return {
        "total_projects": len(projects),
        "active_projects": len([p for p in projects if p.is_active]),
        "total_tasks": total_tasks,
        "completed_tasks": completed_tasks,
        "total_issues": total_issues,
        "resolved_issues": resolved_issues,
        "avg_quality_score": avg_quality_score,
    }

@router.get("/{id}", response_model=ProjectResponse)
async def read_project(
    id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """
    Get project by ID.
    """
    result = await db.execute(
        select(Project)
        .options(selectinload(Project.owner))
        .where(Project.id == id)
    )
    project = result.scalars().first()
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    
    # 检查权限：只有项目所有者可以查看
    if project.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="无权查看此项目")
    
    return project

@router.put("/{id}", response_model=ProjectResponse)
async def update_project(
    id: str,
    *,
    db: AsyncSession = Depends(get_db),
    project_in: ProjectUpdate,
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """
    Update project.
    """
    import json
    result = await db.execute(select(Project).where(Project.id == id))
    project = result.scalars().first()
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    
    # 检查权限：只有项目所有者可以更新
    if project.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="无权更新此项目")
    
    update_data = project_in.model_dump(exclude_unset=True)
    if "programming_languages" in update_data and update_data["programming_languages"] is not None:
        update_data["programming_languages"] = json.dumps(update_data["programming_languages"])
    
    for field, value in update_data.items():
        setattr(project, field, value)
    
    project.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(project)
    return project

@router.delete("/{id}")
async def delete_project(
    id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """
    Soft delete project.
    """
    result = await db.execute(select(Project).where(Project.id == id))
    project = result.scalars().first()
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    
    # 检查权限：只有项目所有者可以删除
    if project.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="无权删除此项目")
    
    project.is_active = False
    project.updated_at = datetime.now(timezone.utc)

    # 取消该项目的运行中任务
    running_tasks = await db.execute(
        select(AuditTask).where(
            AuditTask.project_id == id,
            AuditTask.status.in_(["pending", "running"])
        )
    )
    for task in running_tasks.scalars().all():
        task.status = "cancelled"
        task.updated_at = datetime.now(timezone.utc)

    running_agent_tasks = await db.execute(
        select(AgentTask).where(
            AgentTask.project_id == id,
            AgentTask.status.in_(["pending", "running"])
        )
    )
    for atask in running_agent_tasks.scalars().all():
        atask.status = AgentTaskStatus.CANCELLED
        atask.updated_at = datetime.now(timezone.utc)

    await db.commit()
    return {"message": "项目已删除"}

@router.post("/{id}/restore")
async def restore_project(
    id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """
    Restore soft-deleted project.
    """
    result = await db.execute(select(Project).where(Project.id == id))
    project = result.scalars().first()
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    
    # 检查权限：只有项目所有者可以恢复
    if project.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="无权恢复此项目")
    
    project.is_active = True
    project.updated_at = datetime.now(timezone.utc)
    await db.commit()
    return {"message": "项目已恢复"}

@router.delete("/{id}/permanent")
async def permanently_delete_project(
    id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """
    Permanently delete project and all associated records.
    """
    result = await db.execute(select(Project).where(Project.id == id))
    project = result.scalars().first()
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")

    # 检查权限：只有项目所有者可以永久删除
    if project.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="无权永久删除此项目")

    # 删除关联的审计任务及其问题
    task_result = await db.execute(select(AuditTask).where(AuditTask.project_id == id))
    tasks = task_result.scalars().all()
    for task in tasks:
        # 删除关联的审计问题
        issue_result = await db.execute(select(AuditIssue).where(AuditIssue.task_id == task.id))
        issues = issue_result.scalars().all()
        for issue in issues:
            await db.delete(issue)
        await db.delete(task)

    # 删除关联的Agent任务及其发现
    agent_task_result = await db.execute(select(AgentTask).where(AgentTask.project_id == id))
    agent_tasks = agent_task_result.scalars().all()
    for agent_task in agent_tasks:
        finding_result = await db.execute(select(AgentFinding).where(AgentFinding.task_id == agent_task.id))
        findings = finding_result.scalars().all()
        for finding in findings:
            await db.delete(finding)
        await db.delete(agent_task)

    # 删除关联的项目成员
    from app.models.project import ProjectMember
    member_result = await db.execute(select(ProjectMember).where(ProjectMember.project_id == id))
    members = member_result.scalars().all()
    for member in members:
        await db.delete(member)

    # 删除关联的定时扫描
    from app.models.scheduled_scan import ScheduledScan
    scan_result = await db.execute(select(ScheduledScan).where(ScheduledScan.project_id == id))
    scans = scan_result.scalars().all()
    for scan in scans:
        await db.delete(scan)

    # 如果是归档类型项目，删除关联文件和元数据
    if project.source_type == "zip":
        try:
            await delete_project_zip(id)
            print(f"[Project] 已删除项目 {id} 的本地文件")
        except Exception as e:
            print(f"[Warning] 删除本地文件失败: {e}")

    await db.delete(project)
    await db.commit()
    return {"message": "项目已永久删除"}


@router.get("/{id}/files")
async def get_project_files(
    id: str,
    branch: Optional[str] = None,
    exclude_patterns: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """
    Get list of files in the project.
    可选参数:
    - branch: 指定仓库分支（仅对仓库类型项目有效）
    - exclude_patterns: JSON 格式的排除模式数组，如 ["node_modules/**", "*.log"]
    """
    project = await db.get(Project, id)
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    
    # Check permissions
    if project.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="无权查看此项目")
    
    # 解析排除模式
    parsed_exclude_patterns = []
    if exclude_patterns:
        try:
            parsed_exclude_patterns = json.loads(exclude_patterns)
        except json.JSONDecodeError:
            pass
    
    files = []
    
    if project.source_type == "zip":
        zip_path = await load_project_zip(id)
        if not zip_path or not os.path.exists(zip_path):
            return []

        extract_dir = tempfile.mkdtemp(prefix=f"deepaudit_project_{id}_")
        try:
            extract_archive_recursive(zip_path, extract_dir)
            files = [
                {"path": item["path"], "size": item["size"]}
                for item in collect_source_files(
                    extract_dir,
                    exclude_patterns=parsed_exclude_patterns,
                    max_file_size=settings.MAX_FILE_SIZE_BYTES,
                )
            ]
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"无法读取项目本地文件: {str(e)}")
        finally:
            shutil.rmtree(extract_dir, ignore_errors=True)
            
    elif project.source_type == "repository":
        if not project.repository_url:
            return []

        from sqlalchemy.future import select
        from app.core.encryption import decrypt_sensitive_data

        SENSITIVE_OTHER_FIELDS = [
            'githubToken', 'gitlabToken', 'giteaToken', 'sshPrivateKey',
            'svnUsername', 'svnPassword'
        ]

        result = await db.execute(
            select(UserConfig).where(UserConfig.user_id == current_user.id)
        )
        config = result.scalar_one_or_none()

        other_config = {}

        if config and config.other_config:
            encrypted_other_config = json.loads(config.other_config)
            for field in SENSITIVE_OTHER_FIELDS:
                if field in encrypted_other_config and encrypted_other_config[field]:
                    other_config[field] = decrypt_sensitive_data(encrypted_other_config[field])
        target_branch = branch or project.default_branch or "main"

        workspace_dir = None
        try:
            workspace_dir = await materialize_repository_workspace(
                project,
                target_branch,
                user_config={"otherConfig": other_config},
                exclude_patterns=parsed_exclude_patterns,
            )
            files = [
                {"path": item["path"], "size": item["size"]}
                for item in collect_source_files(
                    workspace_dir,
                    exclude_patterns=parsed_exclude_patterns,
                    max_file_size=settings.MAX_FILE_SIZE_BYTES,
                )
            ]
        except HTTPException:
            raise
        except Exception as e:
             raise HTTPException(status_code=500, detail=f"无法获取仓库文件: {str(e)}")
        finally:
            if workspace_dir:
                shutil.rmtree(workspace_dir, ignore_errors=True)

    return files

class ScanRequest(BaseModel):
    file_paths: Optional[List[str]] = None
    full_scan: bool = True
    exclude_patterns: Optional[List[str]] = None
    branch_name: Optional[str] = None
    rule_set_id: Optional[str] = None
    prompt_template_id: Optional[str] = None
    functionWhitelist: Optional[List[str]] = None
    vulnerabilityWhitelist: Optional[List[str]] = None
    sanitizerFunctions: Optional[List[str]] = None
    task_type: Optional[str] = "repository"  # "repository" | "iac_scan"
    # --- compiled-artifact mode ---
    scan_mode: Optional[str] = "source"           # "source" | "compiled"
    compiled_options: Optional[Dict[str, Any]] = None


@router.post("/{id}/scan")
async def scan_project(
    id: str,
    background_tasks: BackgroundTasks,
    scan_request: Optional[ScanRequest] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """
    Start a scan task.
    """
    project = await db.get(Project, id)
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")

    # 从项目读取 scan_mode 作为回退；如果请求显式传了，必须与项目一致
    project_scan_mode = (project.scan_mode or "source")
    if scan_request and scan_request.scan_mode and scan_request.scan_mode != project_scan_mode:
        raise HTTPException(
            status_code=400,
            detail=f"扫描类型与项目不一致：项目 scan_mode={project_scan_mode}，请求 scan_mode={scan_request.scan_mode}",
        )
    effective_scan_mode = (scan_request.scan_mode if scan_request and scan_request.scan_mode else project_scan_mode)

    if effective_scan_mode == "compiled":
        raise HTTPException(
            status_code=400,
            detail="编译后产物扫描仅支持通过压缩包上传方式，不支持 Git 仓库。",
        )

    # 获取分支和排除模式
    branch_name = scan_request.branch_name if scan_request else None
    exclude_patterns = scan_request.exclude_patterns if scan_request else None

    # Create Task Record
    task = AuditTask(
        project_id=project.id,
        created_by=current_user.id,
        task_type=(
            scan_request.task_type
            if scan_request and scan_request.task_type in {"repository", "iac_scan"}
            else "repository"
        ),
        status="pending",
        branch_name=branch_name or project.default_branch or "main",
        exclude_patterns=json.dumps(exclude_patterns or []),
        scan_config=json.dumps(scan_request.dict()) if scan_request else "{}"
    )
    db.add(task)
    await db.commit()
    await db.refresh(task)

    # 获取用户配置（包含解密敏感字段）
    from app.core.encryption import decrypt_sensitive_data

    # 需要解密的敏感字段列表
    SENSITIVE_LLM_FIELDS = [
        'llmApiKey', 'geminiApiKey', 'openaiApiKey', 'claudeApiKey',
        'qwenApiKey', 'deepseekApiKey', 'zhipuApiKey', 'moonshotApiKey',
        'baiduApiKey', 'minimaxApiKey', 'doubaoApiKey'
    ]
    SENSITIVE_OTHER_FIELDS = [
        'githubToken', 'gitlabToken', 'giteaToken', 'sshPrivateKey',
        'svnUsername', 'svnPassword'
    ]

    def decrypt_config(config_dict: dict, sensitive_fields: list) -> dict:
        """解密配置中的敏感字段"""
        decrypted = config_dict.copy()
        for field in sensitive_fields:
            if field in decrypted and decrypted[field]:
                decrypted[field] = decrypt_sensitive_data(decrypted[field])
        return decrypted

    result = await db.execute(
        select(UserConfig).where(UserConfig.user_id == current_user.id)
    )
    config = result.scalar_one_or_none()
    user_config = {}
    if config:
        llm_config = json.loads(config.llm_config) if config.llm_config else {}
        other_config = json.loads(config.other_config) if config.other_config else {}
        # 解密敏感字段
        llm_config = decrypt_config(llm_config, SENSITIVE_LLM_FIELDS)
        other_config = decrypt_config(other_config, SENSITIVE_OTHER_FIELDS)
        user_config = {
            'llmConfig': llm_config,
            'otherConfig': other_config,
        }

    # 将扫描配置注入到 user_config 中，以便 scan_repo_task 使用
    if scan_request:
        # compiled_options fallback：请求未带则从项目读取
        effective_compiled_options = (
            scan_request.compiled_options
            if scan_request.compiled_options is not None
            else parse_compiled_options(project.compiled_options)
        )

        user_config['scan_config'] = {
            'file_paths': scan_request.file_paths or [],
            'exclude_patterns': scan_request.exclude_patterns or [],
            'rule_set_id': scan_request.rule_set_id,
            'prompt_template_id': scan_request.prompt_template_id,
            'functionWhitelist': scan_request.functionWhitelist or [],
            'vulnerabilityWhitelist': scan_request.vulnerabilityWhitelist or [],
            'sanitizerFunctions': scan_request.sanitizerFunctions or [],
            'scan_mode': effective_scan_mode,
            'compiled_options': effective_compiled_options,
        }
    else:
        # No scan_request body — still hydrate scan_config from project defaults
        effective_compiled_options = parse_compiled_options(project.compiled_options)
        user_config['scan_config'] = {
            'scan_mode': effective_scan_mode,
            'compiled_options': effective_compiled_options,
        }

    # Trigger Background Task
    if task.task_type == "iac_scan":
        background_tasks.add_task(scan_iac_task, task.id, AsyncSessionLocal, user_config)
    else:
        background_tasks.add_task(scan_repo_task, task.id, AsyncSessionLocal, user_config)

    return {"task_id": task.id, "status": "started"}


# ============ 本地文件管理端点 ============

class ZipFileMetaResponse(BaseModel):
    has_file: bool
    original_filename: Optional[str] = None
    file_size: Optional[int] = None
    uploaded_at: Optional[str] = None


@router.get("/{id}/zip", response_model=ZipFileMetaResponse)
async def get_project_zip_info(
    id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """
    获取项目本地文件信息
    """
    project = await db.get(Project, id)
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    
    # 检查是否有本地文件
    has_file = await has_project_zip(id)
    if not has_file:
        return {"has_file": False}
    
    # 获取元数据
    meta = await get_project_zip_meta(id)
    if meta:
        return {
            "has_file": True,
            "original_filename": meta.get("original_filename"),
            "file_size": meta.get("file_size"),
            "uploaded_at": meta.get("uploaded_at")
        }
    
    return {"has_file": True}


@router.post("/{id}/zip")
async def upload_project_zip(
    id: str,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """
    上传或更新项目本地文件
    """
    project = await db.get(Project, id)
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    
    # 检查权限
    if project.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="无权操作此项目")
    
    # 检查项目类型
    if project.source_type != "zip":
        raise HTTPException(status_code=400, detail="仅本地文件类型项目可以上传源代码文件")
    
    if not file.filename or not is_supported_archive(file.filename):
        raise HTTPException(status_code=400, detail="请上传 zip、rar、7z、tar、gz、tar.gz 等本地文件")
    
    # 保存到临时文件
    temp_file_id = str(uuid.uuid4())
    temp_file_path = f"/tmp/{temp_file_id}{Path(file.filename).suffix or '.zip'}"
    
    try:
        total_size = 0
        with open(temp_file_path, "wb") as buffer:
            while True:
                chunk = file.file.read(1024 * 1024)
                if not chunk:
                    break
                total_size += len(chunk)
                if total_size > settings.UPLOAD_MAX_SIZE_BYTES:
                    raise HTTPException(status_code=400, detail="文件大小不能超过2GB")
                buffer.write(chunk)
        
        # 保存到持久化存储
        meta = await save_project_zip(id, temp_file_path, file.filename)
        
        return {
            "message": "本地文件上传成功",
            "original_filename": meta["original_filename"],
            "file_size": meta["file_size"],
            "uploaded_at": meta["uploaded_at"]
        }
    finally:
        # 清理临时文件
        if os.path.exists(temp_file_path):
            os.remove(temp_file_path)


@router.delete("/{id}/zip")
async def delete_project_zip_file(
    id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """
    删除项目本地文件
    """
    project = await db.get(Project, id)
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    
    # 检查权限
    if project.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="无权操作此项目")
    
    deleted = await delete_project_zip(id)
    
    if deleted:
        return {"message": "本地文件已删除"}
    else:
        return {"message": "没有找到本地文件"}


# ============ 分支管理端点 ============

@router.get("/{id}/branches")
async def get_project_branches(
    id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """
    获取项目仓库的分支列表
    """
    project = await db.get(Project, id)
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    
    # 检查是否为仓库类型项目
    if project.source_type != "repository":
        raise HTTPException(status_code=400, detail="仅仓库类型项目支持获取分支")
    
    if not project.repository_url:
        raise HTTPException(status_code=400, detail="项目未配置仓库地址")
    
    # 获取用户配置的 Token
    from app.core.config import settings
    from app.core.encryption import decrypt_sensitive_data
    
    config = await db.execute(
        select(UserConfig).where(UserConfig.user_id == current_user.id)
    )
    config = config.scalar_one_or_none()
    
    github_token = settings.GITHUB_TOKEN
    gitea_token = settings.GITEA_TOKEN
    gitlab_token = settings.GITLAB_TOKEN

    SENSITIVE_OTHER_FIELDS = ['githubToken', 'gitlabToken', 'giteaToken']
    
    if config and config.other_config:
        import json
        other_config = json.loads(config.other_config)
        for field in SENSITIVE_OTHER_FIELDS:
            if field in other_config and other_config[field]:
                decrypted_val = decrypt_sensitive_data(other_config[field])
                if field == 'githubToken':
                    github_token = decrypted_val
                elif field == 'gitlabToken':
                    gitlab_token = decrypted_val
                elif field == 'giteaToken':
                    gitea_token = decrypted_val
    
    repo_type = project.repository_type or "other"
    
    # 详细日志
    print(f"[Branch] 项目: {project.name}, 类型: {repo_type}, URL: {project.repository_url}")
    
    try:
        if repo_type == "github":
            if not github_token:
                print("[Branch] 警告: GitHub Token 未配置，可能会遇到 API 限制")
            branches = await get_github_branches(project.repository_url, github_token)
        elif repo_type == "gitlab":
            if not gitlab_token:
                print("[Branch] 警告: GitLab Token 未配置，可能无法访问私有仓库")
            branches = await get_gitlab_branches(project.repository_url, gitlab_token)
        elif repo_type == "gitea":
            if not gitea_token:
                print("[Branch] 警告: Gitea Token 未配置，可能无法访问私有仓库")
            branches = await get_gitea_branches(project.repository_url, gitea_token)
        elif repo_type == "svn":
            branches = ["trunk"]
        else:
            # 对于其他类型，返回默认分支
            print(f"[Branch] 仓库类型 '{repo_type}' 不支持获取分支，返回默认分支")
            branches = [project.default_branch or "main"]
        
        print(f"[Branch] 成功获取 {len(branches)} 个分支")
        
        # 将默认分支放在第一位
        default_branch = project.default_branch or "main"
        if default_branch in branches:
            branches.remove(default_branch)
            branches.insert(0, default_branch)
        
        return {"branches": branches, "default_branch": default_branch}
    
    except Exception as e:
        error_msg = str(e)
        print(f"[Branch] 获取分支列表失败: {error_msg}")
        # 返回默认分支作为后备
        return {
            "branches": [project.default_branch or "main"],
            "default_branch": project.default_branch or "main",
            "error": str(e)
        }


# ============ 项目级批量AI排查 ============

async def _get_user_config(db: AsyncSession, user_id: str) -> Optional[dict]:
    """获取用户 LLM 配置"""
    if not user_id:
        return None
    try:
        from app.api.v1.endpoints.config import decrypt_config, SENSITIVE_LLM_FIELDS, SENSITIVE_OTHER_FIELDS
        result = await db.execute(select(UserConfig).where(UserConfig.user_id == user_id))
        config = result.scalar_one_or_none()
        if config and config.llm_config:
            user_llm_config = json.loads(config.llm_config) if config.llm_config else {}
            user_other_config = json.loads(config.other_config) if config.other_config else {}
            user_llm_config = decrypt_config(user_llm_config, SENSITIVE_LLM_FIELDS)
            user_other_config = decrypt_config(user_other_config, SENSITIVE_OTHER_FIELDS)
            return {"llmConfig": user_llm_config, "otherConfig": user_other_config}
    except Exception as e:
        logger.warning(f"获取用户配置失败: {e}")
    return None


@router.post("/{project_id}/issues/ai-investigate-batch")
async def ai_investigate_project_batch(
    project_id: str,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """
    对项目下所有未排查的问题进行批量 AI 排查（包含 audit + agent 问题）
    """
    # 验证项目和权限
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    if project.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="无权操作")

    # 获取项目所有已完成任务的 AuditIssue（未排查）
    audit_tasks_result = await db.execute(
        select(AuditTask.id).where(
            AuditTask.project_id == project_id,
            AuditTask.status == "completed"
        )
    )
    audit_task_ids = [t.id for t in audit_tasks_result.all()]

    audit_issues_result = await db.execute(
        select(AuditIssue).where(
            AuditIssue.task_id.in_(audit_task_ids),
            (AuditIssue.ai_suggestion == None) | (AuditIssue.ai_suggestion == "")
        )
    )
    audit_issues = audit_issues_result.scalars().all()

    # 获取项目所有已完成 AgentFinding（未排查）
    agent_tasks_result = await db.execute(
        select(AgentTask.id).where(
            AgentTask.project_id == project_id,
            AgentTask.status == AgentTaskStatus.COMPLETED
        )
    )
    agent_task_ids = [t.id for t in agent_tasks_result.all()]

    agent_findings_result = await db.execute(
        select(AgentFinding).where(
            AgentFinding.task_id.in_(agent_task_ids),
            (AgentFinding.ai_suggestion == None) | (AgentFinding.ai_suggestion == "")
        )
    )
    agent_findings = agent_findings_result.scalars().all()

    # 合并所有未排查问题
    issue_ids = [i.id for i in audit_issues] + [f.id for f in agent_findings]
    issue_types = ["audit"] * len(audit_issues) + ["agent"] * len(agent_findings)

    total = len(issue_ids)
    if total == 0:
        return {"message": "没有需要排查的问题", "batch_id": None, "total": 0}

    # 标记所有为排查中
    for issue in audit_issues:
        issue.ai_suggestion = json.dumps({
            "verdict": "analyzing",
            "analyzed_at": datetime.now(timezone.utc).isoformat(),
        }, ensure_ascii=False)
    for finding in agent_findings:
        finding.ai_suggestion = json.dumps({
            "verdict": "analyzing",
            "analyzed_at": datetime.now(timezone.utc).isoformat(),
        }, ensure_ascii=False)
    await db.commit()

    batch_id = str(uuid.uuid4())[:8]
    set_batch_progress(batch_id, {
        "total": total,
        "completed": 0,
        "current_issue": "",
        "status": "running",
    })

    user_config = await _get_user_config(db, current_user.id)

    background_tasks.add_task(
        execute_batch_investigation,
        batch_id,
        issue_ids,
        issue_types,
        user_config,
    )

    return {
        "message": "批量AI排查已启动",
        "batch_id": batch_id,
        "total": total,
    }


@router.get("/{project_id}/issues/ai-investigate-batch/{batch_id}/status")
async def get_project_batch_status(
    project_id: str,
    batch_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """查询项目级批量 AI 排查进度"""
    progress = get_batch_progress(batch_id)
    if not progress:
        raise HTTPException(status_code=404, detail="批量排查任务不存在")
    return progress
