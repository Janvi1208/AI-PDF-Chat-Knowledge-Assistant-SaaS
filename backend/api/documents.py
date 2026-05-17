from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, BackgroundTasks
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
import uuid

from api.auth import get_current_user
from models.models import User, Document
from services.rag import rag
from utils.database import get_db
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

router = APIRouter()
MAX_BYTES = 50 * 1024 * 1024  # 50 MB


class DocOut(BaseModel):
    id: str
    filename: str
    file_size: int
    page_count: Optional[int]
    chunk_count: Optional[int]
    status: str
    created_at: datetime
    metadata: Optional[dict]


async def _process(pdf_bytes: bytes, doc_id: str, user_id: str, db: AsyncSession):
    try:
        result = await rag.ingest(pdf_bytes, doc_id, user_id)
        doc = await db.get(Document, doc_id)
        if doc:
            doc.status      = "ready"
            doc.page_count  = result["page_count"]
            doc.chunk_count = result["chunk_count"]
            doc.pdf_metadata = result["metadata"]
            await db.commit()
    except Exception as e:
        doc = await db.get(Document, doc_id)
        if doc:
            doc.status   = "failed"
            doc.error_msg = str(e)[:500]
            await db.commit()


@router.post("/upload", response_model=DocOut)
async def upload(
    bg: BackgroundTasks,
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(400, "Only PDF files are supported")
    pdf_bytes = await file.read()
    if len(pdf_bytes) > MAX_BYTES:
        raise HTTPException(413, "File exceeds 50 MB limit")
    if len(pdf_bytes) < 100:
        raise HTTPException(400, "File appears empty or corrupted")

    doc_id = str(uuid.uuid4())
    doc = Document(id=doc_id, user_id=user.id, filename=file.filename, file_size=len(pdf_bytes), status="processing")
    db.add(doc)
    await db.commit()

    bg.add_task(_process, pdf_bytes, doc_id, user.id, db)

    return DocOut(id=doc_id, filename=file.filename, file_size=len(pdf_bytes),
                  page_count=None, chunk_count=None, status="processing",
                  created_at=doc.created_at, metadata=None)


@router.get("/", response_model=List[DocOut])
async def list_docs(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(Document).where(Document.user_id == user.id).order_by(Document.created_at.desc()))
    return [DocOut(id=d.id, filename=d.filename, file_size=d.file_size, page_count=d.page_count,
                   chunk_count=d.chunk_count, status=d.status, created_at=d.created_at, metadata=d.pdf_metadata)
            for d in res.scalars().all()]


@router.get("/{doc_id}", response_model=DocOut)
async def get_doc(doc_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    doc = await db.get(Document, doc_id)
    if not doc or doc.user_id != user.id:
        raise HTTPException(404, "Document not found")
    return DocOut(id=doc.id, filename=doc.filename, file_size=doc.file_size, page_count=doc.page_count,
                  chunk_count=doc.chunk_count, status=doc.status, created_at=doc.created_at, metadata=doc.pdf_metadata)


@router.delete("/{doc_id}")
async def delete_doc(doc_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    doc = await db.get(Document, doc_id)
    if not doc or doc.user_id != user.id:
        raise HTTPException(404, "Document not found")
    rag.delete_document(doc_id, user.id)
    await db.delete(doc)
    await db.commit()
    return {"message": "Deleted"}
