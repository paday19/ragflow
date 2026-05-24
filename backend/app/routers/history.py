from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import PracticeSession
from app.deps import get_db
from app.schemas import PracticeSessionOut

router = APIRouter(prefix="/history", tags=["history"])


@router.get("", response_model=list[PracticeSessionOut])
def list_history(db: Session = Depends(get_db)):
    sessions = db.query(PracticeSession).order_by(PracticeSession.created_at.desc()).all()
    return [
        PracticeSessionOut(
            id=s.id,
            subject_id=s.subject_id,
            score=s.score,
            total=s.total,
            duration=s.duration,
            created_at=s.created_at,
        )
        for s in sessions
    ]
