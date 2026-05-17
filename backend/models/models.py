from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, JSON, Text, BigInteger
from sqlalchemy.orm import DeclarativeBase, relationship
from datetime import datetime
import uuid


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"
    id               = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    email            = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password  = Column(String(255), nullable=False)
    full_name        = Column(String(255), nullable=False)
    created_at       = Column(DateTime, default=datetime.utcnow)
    documents        = relationship("Document", back_populates="user", cascade="all, delete-orphan")
    sessions         = relationship("ChatSession", back_populates="user", cascade="all, delete-orphan")


class Document(Base):
    __tablename__ = "documents"
    id           = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id      = Column(String(36), ForeignKey("users.id"), nullable=False)
    filename     = Column(String(500), nullable=False)
    file_size    = Column(BigInteger, nullable=False)
    page_count   = Column(Integer, nullable=True)
    chunk_count  = Column(Integer, nullable=True)
    status       = Column(String(50), default="processing")
    error_msg    = Column(Text, nullable=True)
    pdf_metadata = Column(JSON, nullable=True)
    created_at   = Column(DateTime, default=datetime.utcnow)
    user         = relationship("User", back_populates="documents")


class ChatSession(Base):
    __tablename__ = "chat_sessions"
    id              = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id         = Column(String(36), ForeignKey("users.id"), nullable=False)
    title           = Column(String(500), default="New conversation")
    document_ids    = Column(JSON, default=list)
    message_count   = Column(Integer, default=0)
    last_message_at = Column(DateTime, nullable=True)
    created_at      = Column(DateTime, default=datetime.utcnow)
    user            = relationship("User", back_populates="sessions")
    messages        = relationship("ChatMessage", back_populates="session", cascade="all, delete-orphan")


class ChatMessage(Base):
    __tablename__ = "chat_messages"
    id         = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id = Column(String(36), ForeignKey("chat_sessions.id"), nullable=False)
    role       = Column(String(20), nullable=False)
    content    = Column(Text, nullable=False)
    sources    = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    session    = relationship("ChatSession", back_populates="messages")
