from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import KnowledgeCard, PracticeSession, Subject, WrongAnswer
from app.deps import get_db
from app.schemas import StatsOut

router = APIRouter(prefix="/stats", tags=["stats"])


@router.get("", response_model=StatsOut)
def get_stats(db: Session = Depends(get_db)):
    return StatsOut(
        subject_count=db.query(func.count(Subject.id)).scalar() or 0,
        card_count=db.query(func.count(KnowledgeCard.id)).scalar() or 0,
        wrong_count=db.query(func.count(WrongAnswer.id)).scalar() or 0,
        session_count=db.query(func.count(PracticeSession.id)).scalar() or 0,
    )
