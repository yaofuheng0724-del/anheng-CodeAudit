from fastapi import APIRouter, UploadFile, File, Form, Depends, BackgroundTasks, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import Any, Dict, List, Optional
from pydantic import BaseModel
from datetime import datetime, timezone
from pathlib import Path
import uuid
import shutil
import os
import json
import asyncio

from app.api import deps
from app.db.session import get_db, AsyncSessionLocal
from app.models.audit import AuditTask, AuditIssue
from app.models.user import User
from app.models.project import Project
from app.models.analysis import InstantAnalysis
from app.models.user_config import UserConfig
from app.services.llm.service import LLMService
from app.services.archive_utils import extract_archive_recursive, is_supported_archive
from app.services.scanner import (
    get_analysis_config,
    parse_compiled_options,
    scan_local_workspace,
    task_control,
)
from app.services.zip_storage import load_project_zip, save_project_zip, has_project_zip
from app.core.config import settings

router = APIRouter()


def normalize_path(path: str) -> str:
    """
    统一路径分隔符为正斜杠，确保跨平台兼容性
    Windows 使用反斜杠 (\\)，Unix/Mac 使用正斜杠 (/)
    统一转换为正斜杠以保证一致性
    """
    return path.replace("\\", "/")


async def process_zip_task(task_id: str, file_path: str, db_session_factory, user_config: dict = None):
    """后台本地文件处理任务"""
    async with db_session_factory() as db:
        task = await db.get(AuditTask, task_id)
        if not task:
            return

        extract_dir = Path(f"/tmp/{task_id}")
        try:
            task.status = "running"
            task.started_at = datetime.now(timezone.utc)
            await db.commit()
            extract_dir.mkdir(parents=True, exist_ok=True)
            extract_archive_recursive(file_path, extract_dir)

            # 按 scan_config.task_type 分流：iac_scan 走 IaC Semgrep，
            # 其它走现有源码/编译产物扫描管道
            scan_cfg = (user_config or {}).get("scan_config", {}) or {}
            requested_task_type = scan_cfg.get("task_type") or "repository"

            if requested_task_type == "iac_scan":
                # 回写 task.task_type 让前端列表/详情正确识别为 IaC 任务
                task.task_type = "iac_scan"
                await db.commit()
                from app.services.scanner import _run_iac_workspace
                await _run_iac_workspace(task, db, str(extract_dir))
                task.status = "completed"
                task.completed_at = datetime.now(timezone.utc)
                await db.commit()
            else:
                await scan_local_workspace(task, db, str(extract_dir), user_config=user_config)

            task_control.cleanup_task(task_id)

        except Exception as e:
            print(f"❌ 本地文件扫描失败: {e}")
            task.status = "failed"
            task.completed_at = datetime.now(timezone.utc)
            await db.commit()
            task_control.cleanup_task(task_id)
        finally:
            if extract_dir.exists():
                shutil.rmtree(extract_dir)


@router.post("/upload-zip")
async def scan_zip(
    background_tasks: BackgroundTasks,
    project_id: str = Form(...),
    file: UploadFile = File(...),
    scan_config: Optional[str] = Form(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """
    Upload and scan a source archive.
    上传源代码归档并启动扫描，同时将归档保存到持久化存储
    """
    # Verify project exists
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    
    # 检查权限：只有项目所有者可以上传
    if project.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="无权操作此项目")

    # 解析项目的 scan_mode 作为回退；请求显式提供时必须与项目一致
    project_scan_mode = (project.scan_mode or "source")

    if not file.filename or not is_supported_archive(file.filename):
        raise HTTPException(status_code=400, detail="请上传 zip、rar、7z、tar、gz、tar.gz 等本地文件")
        
    # Save Uploaded File to temp
    file_id = str(uuid.uuid4())
    archive_ext = Path(file.filename).suffix or ".zip"
    file_path = f"/tmp/{file_id}{archive_ext}"
    total_size = 0
    with open(file_path, "wb") as buffer:
        while True:
            chunk = file.file.read(1024 * 1024)
            if not chunk:
                break
            total_size += len(chunk)
            if total_size > settings.UPLOAD_MAX_SIZE_BYTES:
                os.remove(file_path)
                raise HTTPException(status_code=400, detail="文件大小不能超过2GB")
            buffer.write(chunk)
    
    # 保存本地文件到持久化存储
    await save_project_zip(project_id, file_path, file.filename)
    
    # Parse scan_config if provided
    parsed_scan_config = {}
    if scan_config:
        try:
            parsed_scan_config = json.loads(scan_config)
        except json.JSONDecodeError:
            pass

    # Create Task
    task = AuditTask(
        project_id=project_id,
        created_by=current_user.id,
        task_type="zip_upload",
        status="pending",
        scan_config=scan_config if scan_config else "{}"
    )
    db.add(task)
    await db.commit()
    await db.refresh(task)

    # 获取用户配置
    user_config = await get_user_config_dict(db, current_user.id)
    
    # 将扫描配置注入到 user_config 中（包括规则集、提示词模板和排除模式）
    if parsed_scan_config:
        req_scan_mode = parsed_scan_config.get('scan_mode')
        if req_scan_mode and req_scan_mode != project_scan_mode:
            raise HTTPException(
                status_code=400,
                detail=f"扫描类型与项目不一致：项目 scan_mode={project_scan_mode}，请求 scan_mode={req_scan_mode}",
            )
        effective_scan_mode = req_scan_mode or project_scan_mode
        req_compiled_options = parsed_scan_config.get('compiled_options')
        effective_compiled_options = (
            req_compiled_options
            if req_compiled_options is not None
            else parse_compiled_options(project.compiled_options)
        )

        user_config['scan_config'] = {
            'file_paths': parsed_scan_config.get('file_paths', []),
            'exclude_patterns': parsed_scan_config.get('exclude_patterns', []),
            'rule_set_id': parsed_scan_config.get('rule_set_id'),
            'prompt_template_id': parsed_scan_config.get('prompt_template_id'),
            'functionWhitelist': parsed_scan_config.get('functionWhitelist', []),
            'vulnerabilityWhitelist': parsed_scan_config.get('vulnerabilityWhitelist', []),
            'sanitizerFunctions': parsed_scan_config.get('sanitizerFunctions', []),
            'scan_mode': effective_scan_mode,
            'compiled_options': effective_compiled_options,
            'task_type': parsed_scan_config.get('task_type') or 'repository',
        }
    else:
        # 请求未带 scan_config 时也要把项目默认的 scan_mode 透传给后台任务，
        # 否则 compiled 项目会被悄悄当 source 扫描
        user_config['scan_config'] = {
            'scan_mode': project_scan_mode,
            'compiled_options': parse_compiled_options(project.compiled_options),
        }

    # Trigger Background Task - 使用持久化存储的文件路径
    stored_zip_path = await load_project_zip(project_id)
    background_tasks.add_task(process_zip_task, task.id, stored_zip_path or file_path, AsyncSessionLocal, user_config)

    return {"task_id": task.id, "status": "queued"}


class ScanRequest(BaseModel):
    file_paths: Optional[List[str]] = None
    full_scan: bool = True
    exclude_patterns: Optional[List[str]] = None
    rule_set_id: Optional[str] = None
    prompt_template_id: Optional[str] = None
    functionWhitelist: Optional[List[str]] = None
    vulnerabilityWhitelist: Optional[List[str]] = None
    sanitizerFunctions: Optional[List[str]] = None
    # --- compiled-artifact mode ---
    scan_mode: Optional[str] = "source"           # "source" | "compiled"
    compiled_options: Optional[Dict[str, Any]] = None
    # --- task type for routing inside process_zip_task ---
    task_type: Optional[str] = "repository"       # "repository" | "iac_scan"


@router.post("/scan-stored-zip")
async def scan_stored_zip(
    project_id: str,
    background_tasks: BackgroundTasks,
    scan_request: Optional[ScanRequest] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """
    使用已存储的本地文件启动扫描（无需重新上传）
    """
    # Verify project exists
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    
    # 检查权限：只有项目所有者可以扫描
    if project.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="无权操作此项目")
    
    # 检查是否有存储的本地文件
    stored_zip_path = await load_project_zip(project_id)
    if not stored_zip_path:
        raise HTTPException(status_code=400, detail="项目没有已存储的本地文件，请先上传")

    project_scan_mode = (project.scan_mode or "source")

    # Create Task
    task = AuditTask(
        project_id=project_id,
        created_by=current_user.id,
        task_type="zip_upload",
        status="pending",
        scan_config=json.dumps(scan_request.dict()) if scan_request else "{}"
    )
    db.add(task)
    await db.commit()
    await db.refresh(task)

    # 获取用户配置
    user_config = await get_user_config_dict(db, current_user.id)
    
    # 将扫描配置注入到 user_config 中（包括规则集、提示词模板和排除模式）
    if scan_request:
        if scan_request.scan_mode and scan_request.scan_mode != project_scan_mode:
            raise HTTPException(
                status_code=400,
                detail=f"扫描类型与项目不一致：项目 scan_mode={project_scan_mode}，请求 scan_mode={scan_request.scan_mode}",
            )
        effective_scan_mode = scan_request.scan_mode or project_scan_mode
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
            'task_type': scan_request.task_type or 'repository',
        }
    else:
        # 请求未带 scan_request 时也透传项目默认值，避免 compiled 项目被当 source 扫
        user_config['scan_config'] = {
            'scan_mode': project_scan_mode,
            'compiled_options': parse_compiled_options(project.compiled_options),
        }

    # Trigger Background Task
    background_tasks.add_task(process_zip_task, task.id, stored_zip_path, AsyncSessionLocal, user_config)

    return {"task_id": task.id, "status": "queued"}


class InstantAnalysisRequest(BaseModel):
    code: str
    language: str
    prompt_template_id: Optional[str] = None


class InstantAnalysisResponse(BaseModel):
    id: str
    user_id: str
    language: str
    issues_count: int
    quality_score: float
    analysis_time: float
    analysis_result: str  # JSON字符串，包含完整的分析结果
    created_at: datetime

    class Config:
        from_attributes = True


async def get_user_config_dict(db: AsyncSession, user_id: str) -> dict:
    """获取用户配置字典（包含解密敏感字段）"""
    from app.core.encryption import decrypt_sensitive_data
    
    # 需要解密的敏感字段列表（与 config.py 保持一致）
    SENSITIVE_LLM_FIELDS = [
        'llmApiKey', 'geminiApiKey', 'openaiApiKey', 'claudeApiKey',
        'qwenApiKey', 'deepseekApiKey', 'zhipuApiKey', 'moonshotApiKey',
        'baiduApiKey', 'minimaxApiKey', 'doubaoApiKey'
    ]
    SENSITIVE_OTHER_FIELDS = [
        'githubToken', 'gitlabToken', 'giteaToken', 'sshPrivateKey',
        'svnUsername', 'svnPassword'
    ]
    
    def decrypt_config(config: dict, sensitive_fields: list) -> dict:
        """解密配置中的敏感字段"""
        decrypted = config.copy()
        for field in sensitive_fields:
            if field in decrypted and decrypted[field]:
                decrypted[field] = decrypt_sensitive_data(decrypted[field])
        return decrypted
    
    result = await db.execute(
        select(UserConfig).where(UserConfig.user_id == user_id)
    )
    config = result.scalar_one_or_none()
    if not config:
        return {}
    
    # 解析配置
    llm_config = json.loads(config.llm_config) if config.llm_config else {}
    other_config = json.loads(config.other_config) if config.other_config else {}
    
    # 解密敏感字段
    llm_config = decrypt_config(llm_config, SENSITIVE_LLM_FIELDS)
    other_config = decrypt_config(other_config, SENSITIVE_OTHER_FIELDS)
    
    return {
        'llmConfig': llm_config,
        'otherConfig': other_config,
    }


@router.post("/instant")
async def instant_analysis(
    req: InstantAnalysisRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user), 
) -> Any:
    """
    Perform instant code analysis.
    """
    # 获取用户配置
    user_config = await get_user_config_dict(db, current_user.id)
    
    # 创建使用用户配置的LLM服务实例
    llm_service = LLMService(user_config=user_config)
    
    start_time = datetime.now(timezone.utc)
    
    try:
        # 如果指定了提示词模板，使用自定义分析
        # 统一使用 analyze_code_with_rules，会自动使用默认模板
        result = await llm_service.analyze_code_with_rules(
            req.code, req.language,
            prompt_template_id=req.prompt_template_id,
            db_session=db,
            use_default_template=True  # 没有指定模板时使用数据库中的默认模板
        )
    except Exception as e:
        # 分析失败，返回错误信息
        error_msg = str(e)
        print(f"❌ 即时分析失败: {error_msg}")
        raise HTTPException(
            status_code=500, 
            detail=f"代码分析失败: {error_msg}"
        )
    
    end_time = datetime.now(timezone.utc)
    duration = (end_time - start_time).total_seconds()

    # Save record
    analysis = InstantAnalysis(
        user_id=current_user.id,
        language=req.language,
        code_content="",  # Do not persist code for privacy
        analysis_result=json.dumps(result),
        issues_count=len(result.get("issues", [])),
        quality_score=result.get("quality_score", 0),
        analysis_time=duration
    )
    db.add(analysis)
    await db.commit()
    await db.refresh(analysis)
    
    # Return result with analysis ID for export functionality
    return {
        **result,
        "analysis_id": analysis.id,
        "analysis_time": duration
    }


@router.get("/instant/history", response_model=List[InstantAnalysisResponse])
async def get_instant_analysis_history(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
    limit: int = 20,
) -> Any:
    """
    Get user's instant analysis history.
    """
    result = await db.execute(
        select(InstantAnalysis)
        .where(InstantAnalysis.user_id == current_user.id)
        .order_by(InstantAnalysis.created_at.desc())
        .limit(limit)
    )
    return result.scalars().all()


@router.delete("/instant/history/{analysis_id}")
async def delete_instant_analysis(
    analysis_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """
    Delete a specific instant analysis record.
    """
    result = await db.execute(
        select(InstantAnalysis)
        .where(InstantAnalysis.id == analysis_id)
        .where(InstantAnalysis.user_id == current_user.id)
    )
    analysis = result.scalar_one_or_none()
    
    if not analysis:
        raise HTTPException(status_code=404, detail="分析记录不存在")
    
    await db.delete(analysis)
    await db.commit()
    
    return {"message": "删除成功"}


@router.delete("/instant/history")
async def delete_all_instant_analyses(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """
    Delete all instant analysis records for current user.
    """
    from sqlalchemy import delete
    
    await db.execute(
        delete(InstantAnalysis).where(InstantAnalysis.user_id == current_user.id)
    )
    await db.commit()
    
    return {"message": "已清空所有历史记录"}


@router.get("/instant/history/{analysis_id}/report/pdf")
async def export_instant_report_pdf(
    analysis_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """
    Export instant analysis report as PDF by analysis ID.
    """
    from fastapi.responses import Response
    from app.services.report_generator import ReportGenerator
    
    # 获取即时分析记录
    result = await db.execute(
        select(InstantAnalysis)
        .where(InstantAnalysis.id == analysis_id)
        .where(InstantAnalysis.user_id == current_user.id)
    )
    analysis = result.scalar_one_or_none()
    
    if not analysis:
        raise HTTPException(status_code=404, detail="分析记录不存在")
    
    # 解析分析结果
    try:
        analysis_result = json.loads(analysis.analysis_result) if analysis.analysis_result else {}
    except json.JSONDecodeError:
        analysis_result = {}
    
    # 生成 PDF
    pdf_bytes = ReportGenerator.generate_instant_report(
        analysis_result,
        analysis.language,
        analysis.analysis_time
    )
    
    # 返回 PDF 文件
    filename = f"instant-analysis-{analysis.language}-{analysis.id[:8]}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"'
        }
    )
