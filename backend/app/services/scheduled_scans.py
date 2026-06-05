"""
定时扫描调度器。
"""

from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime, time, timedelta, timezone
from typing import Any
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from sqlalchemy import select

from app.core.encryption import decrypt_sensitive_data
from app.db.session import AsyncSessionLocal
from app.models.audit import AuditTask
from app.models.agent_task import AgentTask, AgentTaskPhase, AgentTaskStatus
from app.models.project import Project
from app.models.scheduled_scan import ScheduledScan
from app.models.user_config import UserConfig
from app.services.scanner import scan_repo_task
from app.services.zip_storage import load_project_zip

logger = logging.getLogger(__name__)

DEFAULT_SCHEDULE_TIMEZONE = "Asia/Shanghai"

SENSITIVE_LLM_FIELDS = [
    "llmApiKey",
    "geminiApiKey",
    "openaiApiKey",
    "claudeApiKey",
    "qwenApiKey",
    "deepseekApiKey",
    "zhipuApiKey",
    "moonshotApiKey",
    "baiduApiKey",
    "minimaxApiKey",
    "doubaoApiKey",
]
SENSITIVE_OTHER_FIELDS = [
    "githubToken",
    "gitlabToken",
    "giteaToken",
    "sshPrivateKey",
    "svnUsername",
    "svnPassword",
]


def _decrypt_config(config: dict, sensitive_fields: list[str]) -> dict:
    decrypted = config.copy()
    for field in sensitive_fields:
        if field in decrypted and decrypted[field]:
            decrypted[field] = decrypt_sensitive_data(decrypted[field])
    return decrypted


async def _load_user_config(user_id: str) -> dict:
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(UserConfig).where(UserConfig.user_id == user_id))
        config = result.scalar_one_or_none()
        if not config:
            return {}
        return {
            "llmConfig": _decrypt_config(json.loads(config.llm_config or "{}"), SENSITIVE_LLM_FIELDS),
            "otherConfig": _decrypt_config(json.loads(config.other_config or "{}"), SENSITIVE_OTHER_FIELDS),
        }


def _parse_window_time(value: str | None) -> time | None:
    if not value:
        return None
    try:
        hour_text, minute_text = value.split(":", 1)
        hour = int(hour_text)
        minute = int(minute_text)
    except (TypeError, ValueError):
        return None
    if not (0 <= hour <= 23 and 0 <= minute <= 59):
        return None
    return time(hour=hour, minute=minute)


def _zoneinfo(tz_name: str | None) -> ZoneInfo:
    try:
        return ZoneInfo(tz_name or DEFAULT_SCHEDULE_TIMEZONE)
    except ZoneInfoNotFoundError:
        logger.warning("无效的定时扫描时区 %s，已回退到 %s", tz_name, DEFAULT_SCHEDULE_TIMEZONE)
        return ZoneInfo(DEFAULT_SCHEDULE_TIMEZONE)


def _is_within_time_window(schedule: ScheduledScan, moment: datetime) -> bool:
    start_time = _parse_window_time(getattr(schedule, "time_window_start", None))
    end_time = _parse_window_time(getattr(schedule, "time_window_end", None))
    if not start_time or not end_time:
        return True

    local_time = moment.astimezone(_zoneinfo(getattr(schedule, "timezone", None))).time().replace(second=0, microsecond=0)
    if start_time <= end_time:
        return start_time <= local_time <= end_time
    return local_time >= start_time or local_time <= end_time


def _next_allowed_time(schedule: ScheduledScan, candidate: datetime) -> datetime:
    start_time = _parse_window_time(getattr(schedule, "time_window_start", None))
    end_time = _parse_window_time(getattr(schedule, "time_window_end", None))
    if not start_time or not end_time or _is_within_time_window(schedule, candidate):
        return candidate

    zone = _zoneinfo(getattr(schedule, "timezone", None))
    local = candidate.astimezone(zone)
    today_start = local.replace(
        hour=start_time.hour,
        minute=start_time.minute,
        second=0,
        microsecond=0,
    )

    if start_time <= end_time:
        next_local = today_start if local.time() < start_time else today_start + timedelta(days=1)
    else:
        next_local = today_start

    return next_local.astimezone(timezone.utc)


def _calculate_next_run_at(schedule: ScheduledScan, base: datetime) -> datetime:
    candidate = base + timedelta(minutes=max(1, schedule.interval_minutes))
    return _next_allowed_time(schedule, candidate)


def _json_list(value: str | None) -> list[str]:
    if not value:
        return []
    try:
        parsed = json.loads(value)
    except (TypeError, json.JSONDecodeError):
        return []
    return parsed if isinstance(parsed, list) else []


def _schedule_scan_mode(schedule: ScheduledScan) -> str:
    return "agent" if getattr(schedule, "scan_mode", "fast") == "agent" else "fast"


def _agent_task_name(schedule: ScheduledScan, now: datetime) -> str:
    local_now = now.astimezone(_zoneinfo(getattr(schedule, "timezone", None)))
    return f"{schedule.name}-{local_now.strftime('%Y%m%d_%H%M%S')}"


class ScheduledScanRunner:
    def __init__(self) -> None:
        self._task: asyncio.Task | None = None
        self._stopping = False

    async def start(self) -> None:
        if self._task and not self._task.done():
            return
        self._stopping = False
        self._task = asyncio.create_task(self._run_loop(), name="scheduled-scan-runner")
        logger.info("定时扫描调度器已启动")

    async def stop(self) -> None:
        self._stopping = True
        if self._task and not self._task.done():
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        logger.info("定时扫描调度器已停止")

    async def _run_loop(self) -> None:
        while not self._stopping:
            try:
                await self.run_once()
            except Exception as exc:
                logger.warning("定时扫描执行失败: %s", exc)
            await asyncio.sleep(30)

    async def run_once(self) -> None:
        now = datetime.now(timezone.utc)
        pending_jobs: list[dict[str, Any]] = []
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(ScheduledScan).where(
                    ScheduledScan.is_active == True,
                    ScheduledScan.next_run_at.is_not(None),
                    ScheduledScan.next_run_at <= now,
                )
            )
            schedules = result.scalars().all()
            for schedule in schedules:
                project = await db.get(Project, schedule.project_id)
                if not project or not project.is_active:
                    schedule.is_active = False
                    continue

                # BUG FIX: 用 next_run_at（预期执行时间）判断是否在时间窗口内，
                # 而不是用 now（实际调度器循环时间）。
                scheduled_time = schedule.next_run_at or now
                if not _is_within_time_window(schedule, scheduled_time):
                    schedule.next_run_at = _next_allowed_time(schedule, now)
                    continue

                file_paths = _json_list(schedule.file_paths)
                exclude_patterns = _json_list(schedule.exclude_patterns)
                function_whitelist = _json_list(getattr(schedule, "function_whitelist", None))
                vulnerability_whitelist = _json_list(getattr(schedule, "vulnerability_whitelist", None))
                sanitizer_functions = _json_list(getattr(schedule, "sanitizer_functions", None))

                if _schedule_scan_mode(schedule) == "agent":
                    # 查找已有的 "scheduled" 状态占位任务
                    existing_task_result = await db.execute(
                        select(AgentTask).where(
                            AgentTask.scheduled_scan_id == schedule.id,
                            AgentTask.status == AgentTaskStatus.SCHEDULED,
                        )
                    )
                    existing_task = existing_task_result.scalar_one_or_none()

                    if existing_task:
                        # 复用已有占位任务：从 "scheduled" → "pending"
                        existing_task.status = AgentTaskStatus.PENDING
                        existing_task.name = _agent_task_name(schedule, now)
                        await db.flush()
                        pending_jobs.append({"mode": "agent", "task_id": existing_task.id})
                        logger.info(
                            "复用定时占位任务: schedule=%s task=%s",
                            schedule.id, existing_task.id,
                        )
                    else:
                        # 周期性后续执行：创建新任务
                        task = AgentTask(
                            project_id=project.id,
                            created_by=schedule.created_by,
                            name=_agent_task_name(schedule, now),
                            status=AgentTaskStatus.PENDING,
                            current_phase=AgentTaskPhase.PLANNING,
                            audit_scope={
                                "scheduled_scan_id": schedule.id,
                                "schedule_name": schedule.name,
                            },
                            target_vulnerabilities=[
                                "sql_injection",
                                "xss",
                                "command_injection",
                                "path_traversal",
                                "ssrf",
                            ],
                            verification_level="sandbox",
                            branch_name=(
                                schedule.branch_name or project.default_branch or "main"
                                if project.source_type == "repository"
                                else None
                            ),
                            exclude_patterns=exclude_patterns,
                            target_files=file_paths or None,
                            max_iterations=50,
                            timeout_seconds=1800,
                            scheduled_scan_id=schedule.id,
                            agent_config=json.dumps({
                                "functionWhitelist": function_whitelist,
                                "vulnerabilityWhitelist": vulnerability_whitelist,
                                "sanitizerFunctions": sanitizer_functions,
                            }),
                        )
                        db.add(task)
                        await db.flush()
                        pending_jobs.append({"mode": "agent", "task_id": task.id})
                else:
                    # 查找已有的 "scheduled" 状态占位任务
                    existing_task_result = await db.execute(
                        select(AuditTask).where(
                            AuditTask.scheduled_scan_id == schedule.id,
                            AuditTask.status == "scheduled",
                        )
                    )
                    existing_task = existing_task_result.scalar_one_or_none()

                    if existing_task:
                        # 复用已有占位任务：从 "scheduled" → "pending"
                        existing_task.status = "pending"
                        await db.flush()

                        user_config = await _load_user_config(schedule.created_by)
                        user_config["scan_config"] = {
                            "file_paths": file_paths,
                            "exclude_patterns": exclude_patterns,
                            "rule_set_id": schedule.rule_set_id,
                            "prompt_template_id": schedule.prompt_template_id,
                            "functionWhitelist": function_whitelist,
                            "vulnerabilityWhitelist": vulnerability_whitelist,
                            "sanitizerFunctions": sanitizer_functions,
                        }

                        if project.source_type == "zip":
                            archive_path = await load_project_zip(project.id)
                            if archive_path:
                                pending_jobs.append(
                                    {
                                        "mode": "zip",
                                        "task_id": existing_task.id,
                                        "archive_path": archive_path,
                                        "user_config": user_config,
                                    }
                                )
                        else:
                            pending_jobs.append(
                                {
                                    "mode": "fast",
                                    "task_id": existing_task.id,
                                    "user_config": user_config,
                                }
                            )
                        logger.info(
                            "复用定时占位任务: schedule=%s task=%s",
                            schedule.id, existing_task.id,
                        )
                    else:
                        # 周期性后续执行：创建新任务
                        task = AuditTask(
                            project_id=project.id,
                            created_by=schedule.created_by,
                            task_type="scheduled_scan",
                            status="pending",
                            branch_name=schedule.branch_name or project.default_branch or "main",
                            exclude_patterns=schedule.exclude_patterns or "[]",
                            scan_config=json.dumps(
                                {
                                    "file_paths": file_paths,
                                    "exclude_patterns": exclude_patterns,
                                    "scheduled_scan_id": schedule.id,
                                    "rule_set_id": schedule.rule_set_id,
                                    "prompt_template_id": schedule.prompt_template_id,
                                    "functionWhitelist": function_whitelist,
                                    "vulnerabilityWhitelist": vulnerability_whitelist,
                                    "sanitizerFunctions": sanitizer_functions,
                                }
                            ),
                            scheduled_scan_id=schedule.id,
                        )
                        db.add(task)
                        await db.flush()

                        user_config = await _load_user_config(schedule.created_by)
                        user_config["scan_config"] = {
                            "file_paths": file_paths,
                            "exclude_patterns": exclude_patterns,
                            "rule_set_id": schedule.rule_set_id,
                            "prompt_template_id": schedule.prompt_template_id,
                            "functionWhitelist": function_whitelist,
                            "vulnerabilityWhitelist": vulnerability_whitelist,
                            "sanitizerFunctions": sanitizer_functions,
                        }

                        if project.source_type == "zip":
                            archive_path = await load_project_zip(project.id)
                            if archive_path:
                                pending_jobs.append(
                                    {
                                        "mode": "zip",
                                        "task_id": task.id,
                                        "archive_path": archive_path,
                                        "user_config": user_config,
                                    }
                                )
                        else:
                            pending_jobs.append(
                                {
                                    "mode": "fast",
                                    "task_id": task.id,
                                    "user_config": user_config,
                                }
                            )

                schedule.last_run_at = now
                # 基于 next_run_at（预期执行时间）计算下次执行时间，
                # 避免基于 now 导致的时间漂移。
                schedule.next_run_at = _calculate_next_run_at(schedule, scheduled_time)

            await db.commit()

        for job in pending_jobs:
            try:
                if job["mode"] == "agent":
                    from app.api.v1.endpoints.agent_tasks import _execute_agent_task

                    asyncio.create_task(_execute_agent_task(job["task_id"]))
                elif job["mode"] == "zip":
                    from app.api.v1.endpoints.scan import process_zip_task

                    asyncio.create_task(
                        process_zip_task(
                            job["task_id"],
                            job["archive_path"],
                            AsyncSessionLocal,
                            job["user_config"],
                        )
                    )
                else:
                    asyncio.create_task(
                        scan_repo_task(job["task_id"], AsyncSessionLocal, job["user_config"])
                    )
                logger.info("定时扫描已启动: mode=%s task_id=%s", job["mode"], job["task_id"])
            except Exception as exc:
                logger.error("定时扫描启动失败: mode=%s task_id=%s error=%s", job["mode"], job["task_id"], exc)


scheduled_scan_runner = ScheduledScanRunner()
