from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import os
import uvicorn

from api.auth import router as auth_router
from api.documents import router as docs_router
from api.chat import router as chat_router
from api.sessions import router as sessions_router
from utils.database import init_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        await init_db()
        print("✅ Database connected successfully")
    except Exception as e:
        print("❌ Database connection failed:", e)

    yield


app = FastAPI(
    title="DocuMind AI API",
    description="RAG-powered PDF chat assistant",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS configuration
origins = os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routes
app.include_router(auth_router, prefix="/api/auth", tags=["Auth"])
app.include_router(docs_router, prefix="/api/documents", tags=["Documents"])
app.include_router(chat_router, prefix="/api/chat", tags=["Chat"])
app.include_router(sessions_router, prefix="/api/sessions", tags=["Sessions"])


# Health check route
@app.get("/health")
def health():
    return {
        "status": "ok",
        "version": "1.0.0"
    }


# Root route
@app.get("/")
def root():
    return {
        "message": "DocuMind AI Backend Running 🚀"
    }


# Render deployment entrypoint
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 10000))

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=port,
        reload=False
    )