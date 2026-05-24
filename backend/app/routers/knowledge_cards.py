from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import KnowledgeCard
from app.deps import get_db
from app.schemas import KnowledgeCardOut

router = APIRouter(prefix="/knowledge-cards", tags=["knowledge-cards"])


@router.get("", response_model=list[KnowledgeCardOut])
def list_knowledge_cards(
    subject_id: str | None = Query(default=None, alias="subject_id"),
    db: Session = Depends(get_db),
):
    q = db.query(KnowledgeCard)
    if subject_id:
        q = q.filter(KnowledgeCard.subject_id == subject_id)
    cards = q.order_by(KnowledgeCard.created_at.desc()).all()
    return [
        KnowledgeCardOut(
            id=c.id,
            subject_id=c.subject_id,
            concept=c.concept,
            summary=c.summary,
            detail=c.detail or "",
            tags=c.tags or [],
            created_at=c.created_at,
        )
        for c in cards
    ]


@router.delete("/{card_id}", status_code=204)
def delete_knowledge_card(card_id: str, db: Session = Depends(get_db)):
    card = db.get(KnowledgeCard, card_id)
    if not card:
        raise HTTPException(status_code=404, detail="知识卡片不存在")
    db.delete(card)
    db.commit()
    return None
