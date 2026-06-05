"""
仓库扫描服务 - 支持GitHub, GitLab 和 Gitea 仓库扫描
"""

import asyncio
import httpx
import json
import logging
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
from typing import List, Dict, Any, Optional

logger = logging.getLogger(__name__)
from datetime import datetime, timezone
from urllib.parse import urlparse, quote
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.utils.repo_utils import parse_repository_url
from app.models.audit import AuditTask, AuditIssue
from app.models.project import Project
from app.core.config import settings
from app.services.quick_scan import (
    calculate_quality_score,
    collect_source_files,
    deduplicate_findings,
    get_language_from_path as local_language_from_path,
    is_text_file as local_is_text_file,
    run_pattern_scan,
    run_semgrep_scan,
    should_exclude as local_should_exclude,
)
from app.services.code_analysis import CodeAnalysisService


def get_analysis_config(user_config: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """
    获取分析配置参数（优先使用用户配置，然后使用系统配置）

    Returns:
        包含以下字段的字典:
        - max_analyze_files: 最大分析文件数
        - llm_concurrency: LLM 并发数
        - llm_gap_ms: LLM 请求间隔（毫秒）
    """
    other_config = (user_config or {}).get('otherConfig', {})

    return {
        'max_analyze_files': other_config.get('maxAnalyzeFiles') or settings.MAX_ANALYZE_FILES,
        'llm_concurrency': other_config.get('llmConcurrency') or settings.LLM_CONCURRENCY,
        'llm_gap_ms': other_config.get('llmGapMs') or settings.LLM_GAP_MS,
    }


def is_text_file(path: str) -> bool:
    """检查是否为文本文件"""
    return local_is_text_file(path)


def should_exclude(path: str, exclude_patterns: List[str] = None) -> bool:
    """检查是否应该排除该文件"""
    return local_should_exclude(path, exclude_patterns)


def get_language_from_path(path: str) -> str:
    """从文件路径获取语言类型"""
    return local_language_from_path(path)


def parse_compiled_options(raw: Any) -> Dict[str, Any]:
    """Decode a Project.compiled_options column value into a plain dict.

    The column is Text/JSON, but stored values can be:
    - None / "" → empty options
    - a JSON string → decode
    - already a dict (in tests / future schema change) → return as-is
    - malformed JSON → log warning and return {}
    """
    if not raw:
        return {}
    if isinstance(raw, dict):
        return raw
    if isinstance(raw, str):
        try:
            return json.loads(raw)
        except json.JSONDecodeError as e:
            logger.warning(
                "Failed to decode project.compiled_options JSON: %s; raw=%r", e, raw[:100]
            )
            return {}
    return {}


class TaskControlManager:
    """任务控制管理器 - 用于取消运行中的任务"""
    
    def __init__(self):
        self._cancelled_tasks: set = set()
    
    def cancel_task(self, task_id: str):
        """取消任务"""
        self._cancelled_tasks.add(task_id)
        print(f"🛑 任务 {task_id} 已标记为取消")
    
    def is_cancelled(self, task_id: str) -> bool:
        """检查任务是否被取消"""
        return task_id in self._cancelled_tasks
    
    def cleanup_task(self, task_id: str):
        """清理已完成任务的控制状态"""
        self._cancelled_tasks.discard(task_id)


# 全局任务控制器
task_control = TaskControlManager()


async def github_api(url: str, token: str = None) -> Any:
    """调用GitHub API"""
    headers = {"Accept": "application/vnd.github+json"}
    t = token or settings.GITHUB_TOKEN
    if t:
        headers["Authorization"] = f"Bearer {t}"
    
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.get(url, headers=headers)
        if response.status_code == 403:
            raise Exception("GitHub API 403：请配置 GITHUB_TOKEN 或确认仓库权限/频率限制")
        if response.status_code != 200:
            raise Exception(f"GitHub API {response.status_code}: {url}")
        return response.json()



async def gitea_api(url: str, token: str = None) -> Any:
    """调用Gitea API"""
    headers = {"Content-Type": "application/json"}
    t = token or settings.GITEA_TOKEN
    if t:
        headers["Authorization"] = f"token {t}"
    
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.get(url, headers=headers)
        if response.status_code == 401:
            raise Exception("Gitea API 401：请配置 GITEA_TOKEN 或确认仓库权限")
        if response.status_code == 403:
            raise Exception("Gitea API 403：请确认仓库权限/频率限制")
        if response.status_code != 200:
            raise Exception(f"Gitea API {response.status_code}: {url}")
        return response.json()


async def gitlab_api(url: str, token: str = None) -> Any:
    """调用GitLab API"""
    headers = {"Content-Type": "application/json"}
    t = token or settings.GITLAB_TOKEN
    if t:
        headers["PRIVATE-TOKEN"] = t
    
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.get(url, headers=headers)
        if response.status_code == 401:
            raise Exception("GitLab API 401：请配置 GITLAB_TOKEN 或确认仓库权限")
        if response.status_code == 403:
            raise Exception("GitLab API 403：请确认仓库权限/频率限制")
        if response.status_code != 200:
            raise Exception(f"GitLab API {response.status_code}: {url}")
        return response.json()


async def fetch_file_content(url: str, headers: Dict[str, str] = None) -> Optional[str]:
    """获取文件内容"""
    async with httpx.AsyncClient(timeout=30) as client:
        try:
            response = await client.get(url, headers=headers or {})
            if response.status_code == 200:
                return response.text
        except Exception as e:
            print(f"获取文件内容失败: {url}, 错误: {e}")
    return None


async def get_github_branches(repo_url: str, token: str = None) -> List[str]:
    """获取GitHub仓库分支列表"""
    repo_info = parse_repository_url(repo_url, "github")
    owner, repo = repo_info['owner'], repo_info['repo']
    
    branches_url = f"https://api.github.com/repos/{owner}/{repo}/branches?per_page=100"
    branches_data = await github_api(branches_url, token)
    
    return [b["name"] for b in branches_data]





async def get_gitea_branches(repo_url: str, token: str = None) -> List[str]:
    """获取Gitea仓库分支列表"""
    repo_info = parse_repository_url(repo_url, "gitea")
    base_url = repo_info['base_url'] # This is {base}/api/v1
    owner, repo = repo_info['owner'], repo_info['repo']
    
    branches_url = f"{base_url}/repos/{owner}/{repo}/branches"
    branches_data = await gitea_api(branches_url, token)
    
    return [b["name"] for b in branches_data]


async def get_gitlab_branches(repo_url: str, token: str = None) -> List[str]:
    """获取GitLab仓库分支列表"""
    parsed = urlparse(repo_url)
    
    extracted_token = token
    if parsed.username:
        if parsed.username == 'oauth2' and parsed.password:
            extracted_token = parsed.password
        elif parsed.username and not parsed.password:
            extracted_token = parsed.username
    
    repo_info = parse_repository_url(repo_url, "gitlab")
    base_url = repo_info['base_url']
    project_path = quote(repo_info['project_path'], safe='')
    
    branches_url = f"{base_url}/projects/{project_path}/repository/branches?per_page=100"
    branches_data = await gitlab_api(branches_url, extracted_token)
    
    return [b["name"] for b in branches_data]


async def get_github_files(repo_url: str, branch: str, token: str = None, exclude_patterns: List[str] = None) -> List[Dict[str, str]]:
    """获取GitHub仓库文件列表"""
    # 解析仓库URL
    repo_info = parse_repository_url(repo_url, "github")
    owner, repo = repo_info['owner'], repo_info['repo']
    
    # 获取仓库文件树
    tree_url = f"https://api.github.com/repos/{owner}/{repo}/git/trees/{quote(branch)}?recursive=1"
    tree_data = await github_api(tree_url, token)
    
    files = []
    for item in tree_data.get("tree", []):
        if item.get("type") == "blob" and is_text_file(item["path"]) and not should_exclude(item["path"], exclude_patterns):
            size = item.get("size", 0)
            if size <= settings.MAX_FILE_SIZE_BYTES:
                files.append({
                    "path": item["path"],
                    "url": f"https://raw.githubusercontent.com/{owner}/{repo}/{quote(branch)}/{item['path']}"
                })
    
    return files


async def get_gitlab_files(repo_url: str, branch: str, token: str = None, exclude_patterns: List[str] = None) -> List[Dict[str, str]]:
    """获取GitLab仓库文件列表"""
    parsed = urlparse(repo_url)
    
    # 从URL中提取token（如果存在）
    extracted_token = token
    if parsed.username:
        if parsed.username == 'oauth2' and parsed.password:
            extracted_token = parsed.password
        elif parsed.username and not parsed.password:
            extracted_token = parsed.username
    
    # 解析项目路径
    repo_info = parse_repository_url(repo_url, "gitlab")
    base_url = repo_info['base_url'] # {base}/api/v4
    project_path = quote(repo_info['project_path'], safe='')
    
    # 获取仓库文件树
    tree_url = f"{base_url}/projects/{project_path}/repository/tree?ref={quote(branch)}&recursive=true&per_page=100"
    tree_data = await gitlab_api(tree_url, extracted_token)
    
    files = []
    for item in tree_data:
        if item.get("type") == "blob" and is_text_file(item["path"]) and not should_exclude(item["path"], exclude_patterns):
            files.append({
                "path": item["path"],
                "url": f"{base_url}/projects/{project_path}/repository/files/{quote(item['path'], safe='')}/raw?ref={quote(branch)}",
                "token": extracted_token
            })
    
    return files



async def get_gitea_files(repo_url: str, branch: str, token: str = None, exclude_patterns: List[str] = None) -> List[Dict[str, str]]:
    """获取Gitea仓库文件列表"""
    repo_info = parse_repository_url(repo_url, "gitea")
    base_url = repo_info['base_url']
    owner, repo = repo_info['owner'], repo_info['repo']
    
    # Gitea tree API: GET /repos/{owner}/{repo}/git/trees/{sha}?recursive=1
    # 可以直接使用分支名作为sha
    tree_url = f"{base_url}/repos/{owner}/{repo}/git/trees/{quote(branch)}?recursive=1"
    tree_data = await gitea_api(tree_url, token)
    
    files = []
    for item in tree_data.get("tree", []):
         # Gitea API returns 'type': 'blob' for files
        if item.get("type") == "blob" and is_text_file(item["path"]) and not should_exclude(item["path"], exclude_patterns):
            # 使用API raw endpoint: GET /repos/{owner}/{repo}/raw/{filepath}?ref={branch}
             files.append({
                "path": item["path"],
                "url": f"{base_url}/repos/{owner}/{repo}/raw/{quote(item['path'])}?ref={quote(branch)}",
                "token": token # 传递token以便fetch_file_content使用
            })
    
    return files


def _write_workspace_file(workspace_dir: str, relative_path: str, content: str) -> None:
    target_path = os.path.join(workspace_dir, relative_path)
    os.makedirs(os.path.dirname(target_path), exist_ok=True)
    with open(target_path, "w", encoding="utf-8", errors="ignore") as handle:
        handle.write(content)


def _is_whitelisted_finding(
    finding: Dict[str, Any],
    other_config: Optional[Dict[str, Any]] = None,
) -> bool:
    other_config = other_config or {}
    vuln_whitelist = {item.lower() for item in other_config.get("vulnerabilityWhitelist", []) if item}
    function_whitelist = {item.lower() for item in other_config.get("functionWhitelist", []) if item}
    sanitizer_functions = {item.lower() for item in other_config.get("sanitizerFunctions", []) if item}

    haystacks = [
        str(finding.get("rule_id", "")).lower(),
        str(finding.get("title", "")).lower(),
        str(finding.get("issue_type", "")).lower(),
        str(finding.get("vulnerability_type", "")).lower(),  # Agent finding field
        str(finding.get("code_snippet", "")).lower(),
    ]
    if vuln_whitelist and any(item in hay for item in vuln_whitelist for hay in haystacks):
        return True

    snippet = str(finding.get("code_snippet", "")).lower()
    if function_whitelist and any(item in snippet for item in function_whitelist):
        return True
    if sanitizer_functions and any(item in snippet for item in sanitizer_functions):
        return True
    return False


def merge_whitelist_config(
    global_config: Dict[str, Any],
    task_whitelist: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """合并 per-task 白名单与全局配置白名单（union, deduped）"""
    merged = global_config.copy()
    if not task_whitelist:
        return merged
    for key in ("functionWhitelist", "vulnerabilityWhitelist", "sanitizerFunctions"):
        global_list = merged.get(key, []) or []
        task_list = task_whitelist.get(key, []) or []
        merged[key] = list(set(global_list + task_list))
    return merged


async def materialize_repository_workspace(
    project: Project,
    branch: str,
    user_config: Optional[Dict[str, Any]] = None,
    exclude_patterns: Optional[List[str]] = None,
) -> str:
    workspace_dir = tempfile.mkdtemp(prefix=f"deepaudit_repo_{project.id}_")
    repo_type = (project.repository_type or "other").lower()
    repo_url = project.repository_url or ""
    user_other_config = (user_config or {}).get("otherConfig", {})

    if repo_type == "svn":
        cmd = ["svn", "export", "--force", repo_url, workspace_dir]
        if user_other_config.get("svnUsername"):
            cmd.extend(["--username", user_other_config["svnUsername"]])
        if user_other_config.get("svnPassword"):
            cmd.extend(["--password", user_other_config["svnPassword"], "--non-interactive", "--trust-server-cert-failures=unknown-ca"])
        subprocess.run(cmd, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        return workspace_dir

    github_token = user_other_config.get("githubToken") or settings.GITHUB_TOKEN
    gitlab_token = user_other_config.get("gitlabToken") or settings.GITLAB_TOKEN
    gitea_token = user_other_config.get("giteaToken") or settings.GITEA_TOKEN
    ssh_private_key = user_other_config.get("sshPrivateKey")

    files: List[Dict[str, str]] = []
    headers: Dict[str, str] = {}

    from app.services.git_ssh_service import GitSSHOperations

    if GitSSHOperations.is_ssh_url(repo_url):
        if not ssh_private_key:
            raise Exception("仓库使用 SSH 地址，但当前用户未配置 SSH 私钥")
        files_with_content = GitSSHOperations.get_repo_files_via_ssh(
            repo_url, ssh_private_key, branch, exclude_patterns or []
        )
        for item in files_with_content:
            _write_workspace_file(workspace_dir, item["path"], item.get("content", ""))
        return workspace_dir

    if repo_type == "github":
        files = await get_github_files(repo_url, branch, github_token, exclude_patterns)
    elif repo_type == "gitlab":
        files = await get_gitlab_files(repo_url, branch, gitlab_token, exclude_patterns)
    elif repo_type == "gitea":
        files = await get_gitea_files(repo_url, branch, gitea_token, exclude_patterns)
    else:
        raise Exception("不支持的仓库类型，仅支持 GitHub、GitLab、Gitea 和 SVN")

    for file_info in files:
        headers = {}
        if repo_type == "gitlab":
            token_to_use = file_info.get("token") or gitlab_token
            if token_to_use:
                headers["PRIVATE-TOKEN"] = token_to_use
        elif repo_type == "gitea":
            token_to_use = file_info.get("token") or gitea_token
            if token_to_use:
                headers["Authorization"] = f"token {token_to_use}"
        elif repo_type == "github" and github_token:
            headers["Authorization"] = f"Bearer {github_token}"

        content = await fetch_file_content(file_info["url"], headers)
        if content is None:
            continue
        _write_workspace_file(workspace_dir, file_info["path"], content)

    return workspace_dir


async def scan_local_workspace(
    task: AuditTask,
    db: AsyncSession,
    workspace_dir: str,
    user_config: Optional[Dict[str, Any]] = None,
) -> None:
    scan_config = (user_config or {}).get("scan_config", {})

    # --- compiled-artifact mode: skip source-scan pipeline entirely ---
    if scan_config.get("scan_mode") == "compiled":
        await _run_compiled_scan(task, db, workspace_dir, scan_config)
        return

    exclude_patterns = scan_config.get("exclude_patterns", [])
    target_files = scan_config.get("file_paths", [])
    analysis_config = get_analysis_config(user_config)
    other_config = (user_config or {}).get("otherConfig", {})

    # 合并 per-task 白名单与全局白名单
    task_whitelist = {k: scan_config[k] for k in ("functionWhitelist", "vulnerabilityWhitelist", "sanitizerFunctions")
                      if scan_config.get(k)}
    other_config = merge_whitelist_config(other_config, task_whitelist)

    source_files = collect_source_files(
        workspace_dir,
        exclude_patterns=exclude_patterns,
        target_files=target_files,
        max_file_size=settings.MAX_FILE_SIZE_BYTES,
    )
    # 快速审计仅使用规则引擎（Semgrep + 正则），无 LLM 开销，不截断文件数
    # max_analyze_files 仅用于限制 LLM 分析的文件数量，对规则扫描无效

    task.total_files = len(source_files)
    task.scanned_files = 0  # 初始为0，扫描过程中逐步更新
    task.status = "running"
    await db.commit()

    # 执行代码分析
    try:
        analysis_service = CodeAnalysisService(workspace_dir)
        # tree-sitter 解析 + 调用图构建是 CPU-bound 同步代码，
        # 直接调用会阻塞事件循环数十秒，导致并发 HTTP 请求超时。
        # 用 asyncio.to_thread 卸到 worker 线程，事件循环保持空闲。
        code_analysis_results = await asyncio.to_thread(
            analysis_service.analyze,
            exclude_patterns=exclude_patterns,
            target_files=target_files,
            extract_api=True,
            extract_calls=True,
            extract_dependencies=True,
            extract_control_flow=True,
        )

        # 调试日志：检查分析结果
        api_count = len(code_analysis_results.get('api_endpoints', []))
        call_count = len(code_analysis_results.get('call_graph', []))
        dep_count = len(code_analysis_results.get('file_dependencies', []))
        cf_count = len(code_analysis_results.get('control_flow', {}) or {})
        by_lang = code_analysis_results['statistics'].get('by_language', {})
        print(f"📊 代码分析结果: API端点={api_count}, 调用图={call_count}, 依赖={dep_count}, 控制流文件={cf_count}, 按语言={by_lang}")

        task.code_analysis_results = code_analysis_results
        await db.commit()
        print(f"✅ 代码分析完成: 分析了 {code_analysis_results['statistics']['analyzed_files']} 个文件")
    except Exception as e:
        print(f"⚠️ 代码分析失败: {e}")
        import traceback
        traceback.print_exc()
        # 不影响主流程，继续执行扫描

    # Phase 1: 规则扫描（Semgrep + 正则）
    semgrep_findings = run_semgrep_scan(
        workspace_dir,
        source_files,
        exclude_patterns=exclude_patterns,
    )
    # Semgrep扫描完成，更新进度到50%
    task.scanned_files = len(source_files) // 2
    await db.commit()

    pattern_findings = run_pattern_scan(source_files)
    findings = deduplicate_findings(semgrep_findings + pattern_findings)

    for finding in findings:
        if _is_whitelisted_finding(finding, other_config):
            continue
        db.add(
            AuditIssue(
                task_id=task.id,
                file_path=finding["file_path"],
                line_number=finding.get("line_number"),
                column_number=finding.get("column_number"),
                issue_type=finding.get("issue_type", "security"),
                severity=finding.get("severity", "medium"),
                title=finding.get("title"),
                message=finding.get("description"),
                description=finding.get("description"),
                suggestion=finding.get("suggestion"),
                code_snippet=finding.get("code_snippet"),
                ai_explanation=json.dumps(
                    {
                        "review_status": "rule_hit",
                        "tool": finding.get("tool"),
                        "rule_id": finding.get("rule_id"),
                    },
                    ensure_ascii=False,
                ),
                source=finding.get("source"),
                sink=finding.get("sink"),
                dataflow_path=json.dumps(finding["dataflow_path"], ensure_ascii=False) if finding.get("dataflow_path") else None,
                code_context=finding.get("code_context"),
                status="not_fixed",
            )
        )

    await db.flush()

    await db.commit()

    issues_result = await db.execute(select(AuditIssue).where(AuditIssue.task_id == task.id))
    issues = issues_result.scalars().all()
    task.scanned_files = len(source_files)
    task.total_lines = sum(int(item.get("line_count") or 0) for item in source_files)
    task.issues_count = len(issues)
    task.quality_score = calculate_quality_score(len(source_files), len(issues))
    task.status = "completed" if source_files or findings else "failed"
    task.completed_at = datetime.now(timezone.utc)
    await db.commit()


async def scan_repo_task(task_id: str, db_session_factory, user_config: dict = None):
    """
    后台仓库扫描任务
    
    Args:
        task_id: 任务ID
        db_session_factory: 数据库会话工厂
        user_config: 用户配置字典（包含llmConfig和otherConfig）
    """
    async with db_session_factory() as db:
        task = await db.get(AuditTask, task_id)
        if not task:
            return

        try:
            task.status = "running"
            task.started_at = datetime.now(timezone.utc)
            await db.commit()

            project = await db.get(Project, task.project_id)
            if not project:
                raise Exception("项目不存在")

            source_type = getattr(project, 'source_type', 'repository')
            if source_type == 'zip':
                raise Exception("ZIP类型项目请使用ZIP上传扫描接口")
            if not project.repository_url:
                raise Exception("仓库地址不存在")

            branch = task.branch_name or project.default_branch or "main"
            task_exclude_patterns = []
            if task.exclude_patterns:
                try:
                    task_exclude_patterns = json.loads(task.exclude_patterns)
                except:
                    pass
            workspace_dir = await materialize_repository_workspace(
                project,
                branch,
                user_config=user_config,
                exclude_patterns=task_exclude_patterns,
            )
            try:
                await scan_local_workspace(task, db, workspace_dir, user_config=user_config)
            finally:
                shutil.rmtree(workspace_dir, ignore_errors=True)
            task_control.cleanup_task(task_id)

        except Exception as e:
            print(f"❌ 扫描失败: {e}")
            task.status = "failed"
            task.completed_at = datetime.now(timezone.utc)
            await db.commit()
            task_control.cleanup_task(task_id)


# ============ IaC 扫描入口 ============

IAC_FILE_GLOBS = [
    "**/Dockerfile",
    "**/Dockerfile.*",
    "**/*.dockerfile",
    "**/docker-compose*.yml",
    "**/docker-compose*.yaml",
    "**/compose.yml",
    "**/compose.yaml",
    "**/.github/workflows/*.yml",
    "**/.github/workflows/*.yaml",
]


def _collect_iac_files(workspace: Path) -> list[dict[str, Any]]:
    """收集 IaC 文件，返回 run_semgrep_scan 所需 source_files 结构。"""
    seen: set[Path] = set()
    files: list[dict[str, Any]] = []
    for pattern in IAC_FILE_GLOBS:
        for abs_path in workspace.glob(pattern):
            if not abs_path.is_file() or abs_path in seen:
                continue
            seen.add(abs_path)
            rel = abs_path.relative_to(workspace).as_posix()
            files.append({
                "path": rel,
                "absolute_path": str(abs_path),
                "language": "yaml" if abs_path.suffix in {".yml", ".yaml"} else "generic",
            })
    return files


async def _run_iac_workspace(
    task: AuditTask,
    db: AsyncSession,
    workspace_dir: str,
) -> None:
    """在已物化的 workspace 上跑 IaC Semgrep 扫描并落 issue。

    被 scan_iac_task（Git 仓库路径）和 process_zip_task 的 iac_scan 分支
    （zip 上传路径）共用，保持 issue 落库形态完全一致。
    """
    from app.services.quick_scan import run_semgrep_scan

    iac_rules_path = (
        Path(__file__).resolve().parents[3]
        / "rules" / "semgrep" / "iac-rules.yml"
    )

    workspace_path = Path(workspace_dir)
    iac_files = _collect_iac_files(workspace_path)
    print(f"📦 IaC 扫描发现 {len(iac_files)} 个文件")

    findings = []
    if iac_files:
        findings = run_semgrep_scan(
            workspace_dir=workspace_path,
            source_files=iac_files,
            rules_file=iac_rules_path,
        )

    for f in findings:
        issue = AuditIssue(
            task_id=task.id,
            file_path=f["file_path"],
            line_number=f.get("line_number"),
            column_number=f.get("column_number"),
            issue_type="iac",
            severity=f.get("severity", "medium"),
            title=f.get("title"),
            message=f.get("title"),
            description=f.get("description"),
            suggestion=f.get("suggestion"),
            code_snippet=f.get("code_snippet"),
        )
        db.add(issue)
    task.total_files = len(iac_files)
    task.scanned_files = len(iac_files)
    task.issues_count = len(findings)


async def scan_iac_task(task_id: str, db_session_factory, user_config: Optional[Dict[str, Any]] = None):
    """IaC 扫描任务入口：克隆仓库 → 收集 IaC 文件 → 跑 IaC Semgrep 规则 → 落 Issue。"""
    # 1) Mark running
    async with db_session_factory() as db:
        task = await db.get(AuditTask, task_id)
        if not task:
            print(f"❌ IaC 任务 {task_id} 不存在")
            return
        task.status = "running"
        task.started_at = datetime.now(timezone.utc)
        await db.commit()

    workspace_dir: Optional[str] = None
    try:
        # 2) Load project info
        async with db_session_factory() as db:
            task = await db.get(AuditTask, task_id)
            project = await db.get(Project, task.project_id)
            branch = task.branch_name or project.default_branch or "main"

        # 3) Materialize workspace (clone/checkout/zip-extract handled inside)
        workspace_dir = await materialize_repository_workspace(
            project=project,
            branch=branch,
            user_config=user_config,
        )

        # 4) Run IaC scan via shared helper
        async with db_session_factory() as db:
            task = await db.get(AuditTask, task_id)
            await _run_iac_workspace(task, db, workspace_dir)
            task.status = "completed"
            task.completed_at = datetime.now(timezone.utc)
            await db.commit()
        print(f"✅ IaC 任务 {task_id} 完成")

    except Exception as exc:
        print(f"❌ IaC 任务 {task_id} 失败: {exc}")
        async with db_session_factory() as db:
            task = await db.get(AuditTask, task_id)
            if task:
                task.status = "failed"
                task.completed_at = datetime.now(timezone.utc)
                await db.commit()
    finally:
        if workspace_dir and Path(workspace_dir).exists():
            shutil.rmtree(workspace_dir, ignore_errors=True)


async def _run_compiled_scan(
    task: AuditTask,
    db: AsyncSession,
    workspace_dir: str,
    scan_config: Dict[str, Any],
) -> None:
    """Compiled-artifact scan path. Mirrors the persistence shape of the
    source-scan branch above (scanner.py:482-509) so the rest of the system
    treats these findings identically."""
    from app.services.compiled_scan.engine import CompiledScanEngine
    from app.services.compiled_scan.collector import collect_compiled_artifacts

    compiled_opts = scan_config.get("compiled_options", {}) or {}
    options = {
        "enable_sca": compiled_opts.get("enable_sca", True),
        "max_binary_size_mb": compiled_opts.get("max_binary_size_mb", 200),
        "exclude_patterns": scan_config.get("exclude_patterns", []) or [],
    }

    task.status = "running"
    task.scanned_files = 0
    await db.commit()

    engine = CompiledScanEngine()
    findings = engine.scan(workspace_dir, options)

    for finding in findings:
        db.add(
            AuditIssue(
                task_id=task.id,
                file_path=finding["file_path"],
                line_number=finding.get("line_number", 0),
                column_number=finding.get("column_number"),
                issue_type=finding.get("issue_type", "security"),
                severity=finding.get("severity", "medium"),
                title=finding.get("title"),
                message=finding.get("description"),
                description=finding.get("description"),
                suggestion=finding.get("suggestion"),
                code_snippet=finding.get("code_snippet"),
                ai_explanation=json.dumps(
                    {
                        "review_status": "rule_hit",
                        "tool": finding.get("tool"),
                        "rule_id": finding.get("rule_id"),
                    },
                    ensure_ascii=False,
                ),
                source=finding.get("source"),
                sink=finding.get("sink"),
                status="not_fixed",
            )
        )

    await db.flush()
    await db.commit()

    # Count artifacts as "files" for UI progress accounting.
    artifacts = collect_compiled_artifacts(
        workspace_dir,
        exclude_patterns=options["exclude_patterns"],
        max_size_mb=options["max_binary_size_mb"],
    )
    task.total_files = len(artifacts)
    task.scanned_files = len(artifacts)
    task.issues_count = len(findings)
    task.status = "completed"
    task.completed_at = datetime.now(timezone.utc)
    await db.commit()
