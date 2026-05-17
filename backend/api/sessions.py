from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
import uuid

from api.auth import get_current_user
from models.models import User, ChatSession
from utils.database import get_db
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

router = APIRouter()


class SessionIn(BaseModel):
    title: Optional[str] = "New conversation"
    document_ids: List[str] = []


class SessionOut(BaseModel):
    id: str
    title: Optional[str]
    document_ids: List[str]
    message_count: int
    last_message_at: Optional[datetime]
    created_at: datetime


@router.post("/", response_model=SessionOut)
async def create(body: SessionIn, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    s = ChatSession(id=str(uuid.uuid4()), user_id=user.id, title=body.title, document_ids=body.document_ids)
    db.add(s)
    await db.commit()
    await db.refresh(s)
    return SessionOut(id=s.id, title=s.title, document_ids=s.document_ids or [], message_count=0, last_message_at=None, created_at=s.created_at)


@router.get("/", response_model=List[SessionOut])
async def list_sessions(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(ChatSession).where(ChatSession.user_id == user.id).order_by(ChatSession.created_at.desc()))
    return [SessionOut(id=s.id, title=s.title, document_ids=s.document_ids or [], message_count=s.message_count or 0,
                       last_message_at=s.last_message_at, created_at=s.created_at) for s in res.scalars().all()]


@router.delete("/{sid}")
async def delete(sid: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    s = await db.get(ChatSession, sid)
    if not s or s.user_id != user.id:
        raise HTTPException(404, "Not found")
    await db.delete(s)
    await db.commit()
    return {"message": "Deleted"}
