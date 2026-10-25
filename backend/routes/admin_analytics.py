from collections import Counter
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import case, func
from sqlalchemy.orm import Session

from core.dependencies import require_admin
from database import engine
from schemas.models import Conversation, Message, SecurityEvent, User

router = APIRouter(prefix="/admin", tags=["Admin Analytics"])

SEVERITY_WEIGHT = case(
    (SecurityEvent.severity == "high", 3),
    (SecurityEvent.severity == "medium", 2),
    else_=1,
)


# ---------- helpers ----------

def _since(days: int) -> datetime:
    return datetime.now(timezone.utc) - timedelta(days=days)


def _get_org_employee(session: Session, admin: User, user_id: int) -> User:
    user = (
        session.query(User)
        .filter(User.id == user_id, User.organization_id == admin.organization_id)
        .first()
    )
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    return user


def _split_pii(value: str | None) -> list[str]:
    return [p for p in (value or "").split(",") if p]


def _build_leaderboard(session: Session, org_id: int, since: datetime) -> list[dict]:
    employees = (
        session.query(User)
        .filter(User.organization_id == org_id, User.role == "user")
        .all()
    )
    if not employees:
        return []
    ids = [u.id for u in employees]

    msg_rows = (
        session.query(
            Conversation.user_id,
            func.count().filter(Message.role == "user"),
            func.coalesce(func.sum(Message.prompt_tokens), 0),
            func.coalesce(func.sum(Message.completion_tokens), 0),
            func.count().filter(Message.role == "user", Message.cached.is_(True)),
        )
        .join(Message, Message.conversation_id == Conversation.id)
        .filter(Conversation.user_id.in_(ids), Message.created_at >= since)
        .group_by(Conversation.user_id)
        .all()
    )
    msgs = {r[0]: r[1:] for r in msg_rows}

    ev_rows = (
        session.query(
            SecurityEvent.user_id,
            func.count(),
            func.coalesce(func.sum(SEVERITY_WEIGHT), 0),
            func.count().filter(SecurityEvent.severity == "high"),
        )
        .filter(SecurityEvent.organization_id == org_id, SecurityEvent.created_at >= since)
        .group_by(SecurityEvent.user_id)
        .all()
    )
    events = {r[0]: r[1:] for r in ev_rows}

    rows = []
    for u in employees:
        prompts, in_tok, out_tok, cached = msgs.get(u.id, (0, 0, 0, 0))
        violations, weighted, high = events.get(u.id, (0, 0, 0))
        attempts = prompts + violations
        risk = min(100.0, 100.0 * weighted / (3 * max(attempts, 10)))
        rows.append(
            {
                "user_id": u.id,
                "name": u.name,
                "email": u.email,
                "is_active": u.is_active,
                "prompts": prompts,
                "violations": violations,
                "high_severity": high,
                "attempts": attempts,
                "violation_rate": round(violations / attempts, 4) if attempts else 0.0,
                "prompt_tokens": int(in_tok),
                "completion_tokens": int(out_tok),
                "total_tokens": int(in_tok) + int(out_tok),
                "cache_hits": cached,
                "risk_score": round(risk, 1),
            }
        )

    # Peer percentile: share of colleagues with a strictly lower score
    n = len(rows)
    for r in rows:
        if n > 1:
            lower = sum(1 for p in rows if p["risk_score"] < r["risk_score"])
            r["riskier_than_pct"] = round(100 * lower / (n - 1))
        else:
            r["riskier_than_pct"] = None

    rows.sort(key=lambda r: (-r["risk_score"], -r["violations"]))
    for i, r in enumerate(rows, start=1):
        r["rank"] = i
    return rows


# ---------- endpoints ----------

@router.get("/overview")
def overview(days: int = Query(30, ge=1, le=90), admin: User = Depends(require_admin)):
    org_id = admin.organization_id
    since = _since(days)

    with Session(engine) as session:
        total_emp = session.query(func.count(User.id)).filter(
            User.organization_id == org_id, User.role == "user").scalar()
        active_emp = session.query(func.count(User.id)).filter(
            User.organization_id == org_id, User.role == "user", User.is_active.is_(True)).scalar()

        # Message totals for the whole organization
        prompts, in_tok, out_tok, cached = (
            session.query(
                func.count().filter(Message.role == "user"),
                func.coalesce(func.sum(Message.prompt_tokens), 0),
                func.coalesce(func.sum(Message.completion_tokens), 0),
                func.count().filter(Message.role == "user", Message.cached.is_(True)),
            )
            .join(Conversation, Conversation.id == Message.conversation_id)
            .join(User, User.id == Conversation.user_id)
            .filter(User.organization_id == org_id, Message.created_at >= since)
            .one()
        )

        violations = session.query(func.count(SecurityEvent.id)).filter(
            SecurityEvent.organization_id == org_id, SecurityEvent.created_at >= since).scalar()

        # Per-day series
        msg_by_day = dict(
            session.query(func.date(Message.created_at), func.count())
            .join(Conversation, Conversation.id == Message.conversation_id)
            .join(User, User.id == Conversation.user_id)
            .filter(User.organization_id == org_id, Message.role == "user", Message.created_at >= since)
            .group_by(func.date(Message.created_at))
            .all()
        )
        ev_by_day = dict(
            session.query(func.date(SecurityEvent.created_at), func.count())
            .filter(SecurityEvent.organization_id == org_id, SecurityEvent.created_at >= since)
            .group_by(func.date(SecurityEvent.created_at))
            .all()
        )

        # Violation breakdown
        type_counter: Counter = Counter()
        pii_counter: Counter = Counter()
        for event_type, detected in (
            session.query(SecurityEvent.event_type, SecurityEvent.detected_pii)
            .filter(SecurityEvent.organization_id == org_id, SecurityEvent.created_at >= since)
            .all()
        ):
            type_counter[event_type] += 1
            pii_counter.update(_split_pii(detected))

    today = datetime.now(timezone.utc).date()
    series = []
    for i in range(days - 1, -1, -1):
        d = today - timedelta(days=i)
        series.append({"date": d.isoformat(), "prompts": msg_by_day.get(d, 0), "violations": ev_by_day.get(d, 0)})

    attempts = prompts + violations
    return {
        "window_days": days,
        "employees": {"total": total_emp, "active": active_emp},
        "prompts": prompts,
        "violations": violations,
        "violation_rate": round(violations / attempts, 4) if attempts else 0.0,
        "tokens": {"prompt": int(in_tok), "completion": int(out_tok), "total": int(in_tok) + int(out_tok)},
        "cache_hits": cached,
        "cache_hit_rate": round(cached / prompts, 4) if prompts else 0.0,
        "violations_by_type": dict(type_counter),
        "sensitive_data_by_kind": dict(pii_counter),
        "by_day": series,
    }


@router.get("/leaderboard")
def leaderboard(days: int = Query(30, ge=1, le=365), admin: User = Depends(require_admin)):
    with Session(engine) as session:
        return {
            "window_days": days,
            "employees": _build_leaderboard(session, admin.organization_id, _since(days)),
        }


@router.get("/users/{user_id}")
def user_detail(user_id: int, days: int = Query(30, ge=1, le=365), admin: User = Depends(require_admin)):
    with Session(engine) as session:
        user = _get_org_employee(session, admin, user_id)
        board = _build_leaderboard(session, admin.organization_id, _since(days))
        stats = next((r for r in board if r["user_id"] == user.id), None)

        recent = (
            session.query(SecurityEvent)
            .filter(SecurityEvent.organization_id == admin.organization_id, SecurityEvent.user_id == user.id)
            .order_by(SecurityEvent.id.desc())
            .limit(10)
            .all()
        )
        return {
            "profile": {
                "id": user.id, "name": user.name, "email": user.email, "role": user.role,
                "is_active": user.is_active, "created_at": user.created_at, "last_login_at": user.last_login_at,
            },
            "window_days": days,
            "stats": stats,
            "peer_count": len(board),
            "recent_events": [
                {
                    "id": e.id, "event_type": e.event_type, "severity": e.severity,
                    "risk_score": e.risk_score, "detected": _split_pii(e.detected_pii),
                    "created_at": e.created_at,
                }
                for e in recent
            ],
        }


@router.get("/users/{user_id}/history")
def user_history(
    user_id: int,
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    admin: User = Depends(require_admin),
):
    with Session(engine) as session:
        user = _get_org_employee(session, admin, user_id)
        total = session.query(func.count(Conversation.id)).filter(Conversation.user_id == user.id).scalar()
        rows = (
            session.query(
                Conversation.id, Conversation.title, Conversation.created_at,
                func.count(Message.id),
                func.coalesce(func.sum(Message.prompt_tokens + Message.completion_tokens), 0),
            )
            .outerjoin(Message, Message.conversation_id == Conversation.id)
            .filter(Conversation.user_id == user.id)
            .group_by(Conversation.id)
            .order_by(Conversation.id.desc())
            .limit(limit).offset(offset)
            .all()
        )
        return {
            "total": total,
            "items": [
                {"id": r[0], "title": r[1], "created_at": r[2], "message_count": r[3], "total_tokens": int(r[4])}
                for r in rows
            ],
        }


@router.get("/conversations/{conversation_id}/messages")
def conversation_messages(conversation_id: int, admin: User = Depends(require_admin)):
    with Session(engine) as session:
        conv = (
            session.query(Conversation)
            .join(User, User.id == Conversation.user_id)
            .filter(Conversation.id == conversation_id, User.organization_id == admin.organization_id)
            .first()
        )
        if not conv:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Conversation not found")

        msgs = (
            session.query(Message)
            .filter(Message.conversation_id == conv.id)
            .order_by(Message.id.asc())
            .all()
        )
        return {
            "conversation": {"id": conv.id, "title": conv.title, "user_id": conv.user_id},
            "messages": [
                {
                    "id": m.id, "role": m.role, "content": m.content, "model": m.model,
                    "prompt_tokens": m.prompt_tokens, "completion_tokens": m.completion_tokens,
                    "cached": m.cached, "latency_ms": m.latency_ms, "created_at": m.created_at,
                }
                for m in msgs
            ],
        }


@router.get("/events")
def list_events(
    days: int = Query(30, ge=1, le=365),
    user_id: int | None = None,
    event_type: str | None = None,
    severity: str | None = Query(None, pattern="^(low|medium|high)$"),
    limit: int = Query(25, ge=1, le=100),
    offset: int = Query(0, ge=0),
    admin: User = Depends(require_admin),
):
    with Session(engine) as session:
        q = (
            session.query(SecurityEvent, User)
            .join(User, User.id == SecurityEvent.user_id)
            .filter(SecurityEvent.organization_id == admin.organization_id, SecurityEvent.created_at >= _since(days))
        )
        if user_id:
            q = q.filter(SecurityEvent.user_id == user_id)
        if event_type:
            q = q.filter(SecurityEvent.event_type == event_type)
        if severity:
            q = q.filter(SecurityEvent.severity == severity)

        total = q.count()
        rows = q.order_by(SecurityEvent.id.desc()).limit(limit).offset(offset).all()
        return {
            "total": total,
            "limit": limit,
            "offset": offset,
            "items": [
                {
                    "id": e.id, "created_at": e.created_at, "event_type": e.event_type,
                    "severity": e.severity, "action_taken": e.action_taken, "risk_score": e.risk_score,
                    "detected": _split_pii(e.detected_pii), "conversation_id": e.conversation_id,
                    "user": {"id": u.id, "name": u.name, "email": u.email},
                }
                for e, u in rows
            ],
        }