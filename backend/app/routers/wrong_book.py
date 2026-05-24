from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import WrongAnswer
from app.deps import get_db
from app.schemas import WrongAnswerOut

router = APIRouter(prefix="/wrong-book", tags=["wrong-book"])


@router.get("", response_model=list[WrongAnswerOut])
def list_wrong_answers(
    subject_id: str | None = Query(default=None, alias="subject_id"),
    db: Session = Depends(get_db),
):
    q = db.query(WrongAnswer)
    if subject_id:
        q = q.filter(WrongAnswer.subject_id == subject_id)
    items = q.order_by(WrongAnswer.created_at.desc()).all()
    return [
        WrongAnswerOut(
            id=w.id,
            subject_id=w.subject_id,
            question=w.question,
            user_answer=w.user_answer,
            correct_answer=w.correct_answer,
            concept_id=w.concept_id,
            created_at=w.created_at,
        )
        for w in items
    ]


@router.delete("/{item_id}", status_code=204)
def delete_wrong_answer(item_id: str, db: Session = Depends(get_db)):
    item = db.get(WrongAnswer, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="错题不存在")
    db.delete(item)
    db.commit()
    return None
