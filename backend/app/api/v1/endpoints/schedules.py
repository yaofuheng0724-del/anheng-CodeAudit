import json
from datetime import datetime, time, timedelta, timezone
from typing import Any, List, Literal, Optional
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api import deps
from app.db.session import get_db
from app.models.project import Project
from app.models.scheduled_scan import ScheduledScan
from app.models.user import User

router = APIRouter()

DEFAULT_SCHEDULE_TIMEZONE = "Asia/Shanghai"


def _parse_window_time(value: Optional[str]) -> Optional[time]:
    if not value:
        return None
    try:
        hour_text, minute_text = value.split(":", 1)
        hour = int(hour_text)
        minute = int(minute_text)
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="扫描时间段格式必须为 HH:mm")
    if not (0 <= hour <= 23 and 0 <= minute <= 59):
        raise HTTPException(status_code=400, detail="扫描时间段必须在 00:00 到 23:59 之间")
    return time(hour=hour, minute=minute)


def _validate_time_window(start: Optional[str], end: Optional[str]) -> None:
    if bool(start) != bool(end):
        raise HTTPException(status_code=400, detail="扫描时间段需要同时设置开始和结束时间")
    _parse_window_time(start)
    _parse_window_time(end)


def _zoneinfo(tz_name: Optional[str]) -> ZoneInfo:
    try:
        return ZoneInfo(tz_name or DEFAULT_SCHEDULE_TIMEZONE)
    except ZoneInfoNotFoundError:
        raise HTTPException(status_code=400, detail="无效的时区配置")


def _is_within_time_window(
    moment: datetime,
    start: Optional[str],
    end: Optional[str],
    tz_name: Optional[str],
) -> bool:
    start_time = _parse_window_time(start)
    end_time = _parse_window_time(end)
    if not start_time or not end_time:
        return True

    local_time = moment.astimezone(_zoneinfo(tz_name)).time().replace(second=0, microsecond=0)
    if start_time <= end_time:
        return start_time <= local_time <= end_time
    return local_time >= start_time or local_time <= end_time


def _next_allowed_time(
    candidate: datetime,
    start: Optional[str],
    end: Optional[str],
    tz_name: Optional[str],
) -> datetime:
    start_time = _parse_window_time(start)
    end_time = _parse_window_time(end)
    if not start_time or not end_time or _is_within_time_window(candidate, start, end, tz_name):
        return candidate

    zone = _zoneinfo(tz_name)
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


def _calculate_next_run_at(
    base: datetime,
    interval_minutes: int,
    start: Optional[str],
    end: Optional[str],
    tz_name: Optional[str],
) -> datetime:
    candidate = base + timedelta(minutes=max(1, interval_minutes))
    return _next_allowed_time(candidate, start, end, tz_name)


def _calculate_initial_next_run_at(
    now: datetime,
    interval_minutes: int,
    start: Optional[str],
    end: Optional[str],
    tz_name: Optional[str],
) -> datetime:
    """计算定时计划的首次执行时间。

    优先使用 time_window_end（用户设置的执行时间）确定首次执行时间点，
    而不是基于 now + interval 的周期计算。

    例如：执行时间 09:20，当前 09:10 → 今天 09:20（10分钟后首次执行）
    例如：执行时间 09:20，当前 09:30 → 明天 09:20（明天首次执行）
    例如：周期 2 小时，执行时间 09:20，当前 08:00 → 今天 09:20
    """
    # 优先使用 time_window_end（用户设置的执行时间）计算首次执行时间
    end_time = _parse_window_time(end)
    if end_time:
        zone = _zoneinfo(tz_name)
        local_now = now.astimezone(zone)
        # 计算今天的执行时间点
        next_local = local_now.replace(
            hour=end_time.hour,
            minute=end_time.minute,
            second=0,
            microsecond=0,
        )
        # 如果今天的时间已经过了，推到下一个周期
        if next_local <= local_now:
            # 计算需要加多少天才能到达下一次执行时间
            # 对于天级周期，加 1 天；对于小时级周期，按间隔推算
            if interval_minutes >= 1440:
                next_local += timedelta(days=1)
            else:
                # 小时级周期：从今天执行时间开始，按间隔推算下一次
                while next_local <= local_now:
                    next_local += timedelta(minutes=interval_minutes)
        return next_local.astimezone(timezone.utc)

    # 如果没有设置执行时间，按周期从 now 开始计算
    return _calculate_next_run_at(now, interval_minutes, start, end, tz_name)


class ScheduledScanBase(BaseModel):
    project_id: str
    name: str
    scan_mode: Literal["fast", "agent"] = "fast"
    branch_name: Optional[str] = None
    interval_minutes: int = Field(default=60, ge=1, le=10080)
    time_window_start: Optional[str] = None
    time_window_end: Optional[str] = None
    timezone: str = DEFAULT_SCHEDULE_TIMEZONE
    rule_set_id: Optional[str] = None
    prompt_template_id: Optional[str] = None
    exclude_patterns: List[str] = Field(default_factory=list)
    file_paths: List[str] = Field(default_factory=list)
    functionWhitelist: List[str] = Field(default_factory=list)
    vulnerabilityWhitelist: List[str] = Field(default_factory=list)
    sanitizerFunctions: List[str] = Field(default_factory=list)
    is_active: bool = True


class ScheduledScanCreate(ScheduledScanBase):
    pass


class ScheduledScanUpdate(BaseModel):
    name: Optional[str] = None
    scan_mode: Optional[Literal["fast", "agent"]] = None
    branch_name: Optional[str] = None
    interval_minutes: Optional[int] = Field(default=None, ge=1, le=10080)
    time_window_start: Optional[str] = None
    time_window_end: Optional[str] = None
    timezone: Optional[str] = None
    rule_set_id: Optional[str] = None
    prompt_template_id: Optional[str] = None
    exclude_patterns: Optional[List[str]] = None
    file_paths: Optional[List[str]] = None
    is_active: Optional[bool] = None


class ScheduledScanResponse(ScheduledScanBase):
    id: str
    created_by: str
    last_run_at: Optional[datetime] = None
    next_run_at: Optional[datetime] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


def _serialize_schedule(item: ScheduledScan) -> ScheduledScanResponse:
    return ScheduledScanResponse(
        id=item.id,
        project_id=item.project_id,
        name=item.name,
        scan_mode=item.scan_mode or "fast",
        branch_name=item.branch_name,
        interval_minutes=item.interval_minutes,
        time_window_start=item.time_window_start,
        time_window_end=item.time_window_end,
        timezone=item.timezone or DEFAULT_SCHEDULE_TIMEZONE,
        rule_set_id=item.rule_set_id,
        prompt_template_id=item.prompt_template_id,
        exclude_patterns=[] if not item.exclude_patterns else json.loads(item.exclude_patterns),
        file_paths=[] if not item.file_paths else json.loads(item.file_paths),
        functionWhitelist=[] if not item.function_whitelist else json.loads(item.function_whitelist),
        vulnerabilityWhitelist=[] if not item.vulnerability_whitelist else json.loads(item.vulnerability_whitelist),
        sanitizerFunctions=[] if not item.sanitizer_functions else json.loads(item.sanitizer_functions),
        is_active=item.is_active,
        created_by=item.created_by,
        last_run_at=item.last_run_at,
        next_run_at=item.next_run_at,
        created_at=item.created_at,
        updated_at=item.updated_at,
    )


@router.get("", response_model=List[ScheduledScanResponse])
async def list_schedules(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    result = await db.execute(
        select(ScheduledScan)
        .where(ScheduledScan.created_by == current_user.id)
        .order_by(ScheduledScan.created_at.desc())
    )
    schedules = result.scalars().all()
    return [_serialize_schedule(item) for item in schedules]


@router.post("", response_model=ScheduledScanResponse)
async def create_schedule(
    payload: ScheduledScanCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    _validate_time_window(payload.time_window_start, payload.time_window_end)
    _zoneinfo(payload.timezone)

    project = await db.get(Project, payload.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    if project.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="只能为自己的项目创建计划")

    # 1. 先创建定时计划（需要 schedule.id 来关联任务）
    schedule = ScheduledScan(
        project_id=payload.project_id,
        created_by=current_user.id,
        name=payload.name,
        scan_mode=payload.scan_mode or "fast",
        branch_name=payload.branch_name,
        interval_minutes=payload.interval_minutes,
        time_window_start=payload.time_window_start,
        time_window_end=payload.time_window_end,
        timezone=payload.timezone,
        rule_set_id=payload.rule_set_id,
        prompt_template_id=payload.prompt_template_id,
        exclude_patterns=json.dumps(payload.exclude_patterns),
        file_paths=json.dumps(payload.file_paths),
        function_whitelist=json.dumps(payload.functionWhitelist),
        vulnerability_whitelist=json.dumps(payload.vulnerabilityWhitelist),
        sanitizer_functions=json.dumps(payload.sanitizerFunctions),
        is_active=payload.is_active,
        next_run_at=_calculate_initial_next_run_at(
            datetime.now(timezone.utc),
            payload.interval_minutes,
            payload.time_window_start,
            payload.time_window_end,
            payload.timezone,
        ),
        last_run_at=None,
    )
    db.add(schedule)
    await db.flush()  # 刷新以获取 schedule.id

    # 2. 创建占位任务，状态为 "scheduled"（待扫描），出现在任务列表中
    # ScheduledScanRunner 在 next_run_at 到达时会复用此任务并启动执行
    if payload.scan_mode == "agent":
        from app.models.agent_task import AgentTask, AgentTaskStatus, AgentTaskPhase

        task = AgentTask(
            project_id=project.id,
            created_by=current_user.id,
            name=payload.name,
            status=AgentTaskStatus.SCHEDULED,
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
                payload.branch_name or project.default_branch or "main"
                if project.source_type == "repository"
                else None
            ),
            exclude_patterns=payload.exclude_patterns or [],
            target_files=payload.file_paths or None,
            max_iterations=50,
            timeout_seconds=1800,
            scheduled_scan_id=schedule.id,
            agent_config=json.dumps({
                "functionWhitelist": payload.functionWhitelist or [],
                "vulnerabilityWhitelist": payload.vulnerabilityWhitelist or [],
                "sanitizerFunctions": payload.sanitizerFunctions or [],
            }),
        )
    else:
        from app.models.audit import AuditTask

        task = AuditTask(
            project_id=project.id,
            created_by=current_user.id,
            task_type="scheduled_scan",
            status="scheduled",
            branch_name=payload.branch_name or project.default_branch or "main",
            exclude_patterns=json.dumps(payload.exclude_patterns),
            scan_config=json.dumps({
                "file_paths": payload.file_paths,
                "exclude_patterns": payload.exclude_patterns,
                "scheduled_scan_id": schedule.id,
                "rule_set_id": payload.rule_set_id,
                "prompt_template_id": payload.prompt_template_id,
                "functionWhitelist": payload.functionWhitelist,
                "vulnerabilityWhitelist": payload.vulnerabilityWhitelist,
                "sanitizerFunctions": payload.sanitizerFunctions,
            }),
            scheduled_scan_id=schedule.id,
        )

    db.add(task)
    await db.commit()
    await db.refresh(schedule)
    return _serialize_schedule(schedule)


@router.put("/{schedule_id}", response_model=ScheduledScanResponse)
async def update_schedule(
    schedule_id: str,
    payload: ScheduledScanUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    schedule = await db.get(ScheduledScan, schedule_id)
    if not schedule:
        raise HTTPException(status_code=404, detail="计划不存在")
    if schedule.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="无权修改此计划")

    update_data = payload.model_dump(exclude_unset=True)
    next_start = update_data.get("time_window_start", schedule.time_window_start)
    next_end = update_data.get("time_window_end", schedule.time_window_end)
    next_timezone = update_data.get("timezone", schedule.timezone or DEFAULT_SCHEDULE_TIMEZONE)
    _validate_time_window(next_start, next_end)
    _zoneinfo(next_timezone)

    for field, value in update_data.items():
        if field in {"exclude_patterns", "file_paths"} and value is not None:
            setattr(schedule, field, json.dumps(value))
        else:
            setattr(schedule, field, value)

    recalc_fields = {
        "interval_minutes",
        "time_window_start",
        "time_window_end",
        "timezone",
        "is_active",
    }
    if recalc_fields.intersection(update_data) and schedule.is_active:
        # 基于 last_run_at（上次预期执行时间）计算 next_run_at，
        # 避免基于 now 导致的时间漂移
        base_time = schedule.last_run_at or datetime.now(timezone.utc)
        schedule.next_run_at = _calculate_next_run_at(
            base_time,
            schedule.interval_minutes,
            schedule.time_window_start,
            schedule.time_window_end,
            schedule.timezone,
        )

    await db.commit()
    await db.refresh(schedule)
    return _serialize_schedule(schedule)


@router.delete("/{schedule_id}")
async def delete_schedule(
    schedule_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    schedule = await db.get(ScheduledScan, schedule_id)
    if not schedule:
        raise HTTPException(status_code=404, detail="计划不存在")
    if schedule.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="无权删除此计划")
    await db.delete(schedule)
    await db.commit()
    return {"message": "计划已删除"}
