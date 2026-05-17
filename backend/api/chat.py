from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
import uuid

from api.auth import get_current_user
from models.models import User, Document, ChatSession, ChatMessage
from services.rag import rag
from utils.database import get_db
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

router = APIRouter()


class MsgIn(BaseModel):
    session_id: str
    message: str
    document_ids: List[str]


class MsgOut(BaseModel):
    id: str
    role: str
    content: str
    sources: Optional[List[dict]]
    created_at: datetime


class ChatOut(BaseModel):
    message_id: str
    answer: str
    sources: List[dict]
    chunks_retrieved: int


@router.post("/message", response_model=ChatOut)
async def send_message(body: MsgIn, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    session = await db.get(ChatSession, body.session_id)
    if not session or session.user_id != user.id:
        raise HTTPException(404, "Session not found")

    docs = []
    for did in body.document_ids:
        doc = await db.get(Document, did)
        if not doc or doc.user_id != user.id:
            raise HTTPException(404, f"Document {did} not found")
        if doc.status != "ready":
            raise HTTPException(400, f"'{doc.filename}' is still processing")
        docs.append(doc)

    # Conversation history (last 12 messages)
    hist_res = await db.execute(
        select(ChatMessage).where(ChatMessage.session_id == body.session_id)
        .order_by(ChatMessage.created_at.desc()).limit(12)
    )
    history = [{"role": m.role, "content": m.content} for m in reversed(hist_res.scalars().all())]

    # Save user message
    db.add(ChatMessage(id=str(uuid.uuid4()), session_id=body.session_id, role="user", content=body.message))

    # RAG query
    result = await rag.query(
        question=body.message,
        user_id=user.id,
        doc_ids=body.document_ids,
        doc_names=[d.filename for d in docs],
        history=history,
    )

    # Save assistant message
    aid = str(uuid.uuid4())
    db.add(ChatMessage(id=aid, session_id=body.session_id, role="assistant", content=result["answer"], sources=result["sources"]))

    session.last_message_at = datetime.utcnow()
    session.message_count = (session.message_count or 0) + 2
    if session.message_count == 2:
        session.title = body.message[:60]

    await db.commit()
    return ChatOut(message_id=aid, answer=result["answer"], sources=result["sources"], chunks_retrieved=result["chunks_retrieved"])


@router.get("/sessions/{session_id}/messages", response_model=List[MsgOut])
async def get_messages(session_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    session = await db.get(ChatSession, session_id)
    if not session or session.user_id != user.id:
        raise HTTPException(404, "Session not found")
    res = await db.execute(select(ChatMessage).where(ChatMessage.session_id == session_id).order_by(ChatMessage.created_at))
    return [MsgOut(id=m.id, role=m.role, content=m.content, sources=m.sources, created_at=m.created_at) for m in res.scalars().all()]
