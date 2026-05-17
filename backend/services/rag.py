"""
RAG Pipeline — Complete 6-stage implementation
1. PDF text extraction  (PyMuPDF)
2. Recursive chunking   (paragraph → sentence → word)
3. Embedding generation (sentence-transformers, local & free)
4. Vector indexing      (ChromaDB, per-user isolated)
5. Semantic retrieval   (cosine similarity, top-K)
6. LLM response         (Google Gemini)
"""

import os
import re
import uuid
import fitz          # PyMuPDF
import chromadb
import httpx
from dataclasses import dataclass
from typing import List, Dict, Optional
from sentence_transformers import SentenceTransformer


# ─── Models ──────────────────────────────────────────────────────────────────

@dataclass
class Chunk:
    chunk_id: str
    document_id: str
    text: str
    page_number: int
    chunk_index: int


@dataclass
class Retrieved:
    chunk_id: str
    text: str
    page_number: int
    score: float          # 0-1, higher = more relevant
    document_id: str


# ─── Stage 1: PDF Extraction ─────────────────────────────────────────────────

class PDFExtractor:
    def extract(self, pdf_bytes: bytes) -> Dict:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        pages = []
        for i, page in enumerate(doc):
            text = ""
            for block in page.get_text("blocks", sort=True):
                if block[6] == 0 and block[4].strip():  # text block only
                    text += block[4].strip() + "\n\n"
            pages.append({"page_number": i + 1, "text": text.strip()})

        full_text = "\n\n===PAGE_BREAK===\n\n".join(
            f"[Page {p['page_number']}]\n{p['text']}" for p in pages if p["text"]
        )
        return {
            "full_text": full_text,
            "page_count": len(doc),
            "metadata": {
                "title":   doc.metadata.get("title", ""),
                "author":  doc.metadata.get("author", ""),
                "subject": doc.metadata.get("subject", ""),
            },
        }


# ─── Stage 2: Chunking ───────────────────────────────────────────────────────

class Chunker:
    """Recursive character splitter — respects natural document boundaries."""

    SEPARATORS = [
        "\n\n===PAGE_BREAK===\n\n",
        "\n\n", "\n", ". ", "! ", "? ", "; ", ", ", " ", "",
    ]

    def __init__(self, size: int = 800, overlap: int = 150):
        self.size = size
        self.overlap = overlap

    def split(self, text: str, document_id: str) -> List[Chunk]:
        raws = self._split(text, self.SEPARATORS)
        chunks = []
        for idx, (chunk_text, page) in enumerate(raws):
            chunk_text = chunk_text.strip()
            if len(chunk_text) >= 50:
                chunks.append(Chunk(
                    chunk_id=str(uuid.uuid4()),
                    document_id=document_id,
                    text=chunk_text,
                    page_number=page,
                    chunk_index=idx,
                ))
        return chunks

    def _split(self, text: str, seps: List[str]) -> List[tuple]:
        if not seps:
            return [(text, 1)]
        sep = seps[0]
        parts = text.split(sep)
        results, current, cur_page = [], "", 1
        for part in parts:
            m = re.search(r"\[Page (\d+)\]", part)
            if m:
                cur_page = int(m.group(1))
            if len(current) + len(part) + len(sep) <= self.size:
                current = current + (sep if current else "") + part
            else:
                if current:
                    if len(current) > self.size and len(seps) > 1:
                        results.extend(self._split(current, seps[1:]))
                    else:
                        results.append((current, cur_page))
                    current = current[-self.overlap:] + (sep if self.overlap else "") + part
                else:
                    current = part
        if current:
            results.append((current, cur_page))
        return results


# ─── Stage 3: Embeddings ─────────────────────────────────────────────────────

class Embedder:
    def __init__(self):
        model_name = os.getenv("EMBEDDING_MODEL", "all-MiniLM-L6-v2")
        self.model = SentenceTransformer(model_name)

    def embed(self, texts: List[str]) -> List[List[float]]:
        return self.model.encode(texts, normalize_embeddings=True).tolist()

    def embed_one(self, text: str) -> List[float]:
        return self.embed([text])[0]


# ─── Stage 4 & 5: Vector Store ───────────────────────────────────────────────

class VectorStore:
    def __init__(self):
        persist_dir = os.getenv("CHROMA_PERSIST_DIR", "./chroma_db")
        self.client = chromadb.PersistentClient(path=persist_dir)
        self.embedder = Embedder()

    def _col(self, user_id: str):
        return self.client.get_or_create_collection(
            name=f"u_{user_id.replace('-', '')}",
            metadata={"hnsw:space": "cosine"},
        )

    def index(self, chunks: List[Chunk], user_id: str) -> int:
        if not chunks:
            return 0
        col = self._col(user_id)
        texts = [c.text for c in chunks]
        embeddings = self.embedder.embed(texts)
        col.add(
            ids=[c.chunk_id for c in chunks],
            embeddings=embeddings,
            documents=texts,
            metadatas=[{"document_id": c.document_id, "page_number": c.page_number, "chunk_index": c.chunk_index} for c in chunks],
        )
        return len(chunks)

    def search(self, query: str, user_id: str, doc_ids: Optional[List[str]] = None, top_k: int = 5) -> List[Retrieved]:
        col = self._col(user_id)
        qe = self.embedder.embed_one(query)
        where = {"document_id": {"$in": doc_ids}} if doc_ids else None
        res = col.query(query_embeddings=[qe], n_results=min(top_k, col.count() or 1), where=where, include=["documents", "metadatas", "distances"])
        candidates = []
        for i, cid in enumerate(res["ids"][0]):
            dist = res["distances"][0][i]
            score = round(1 - dist, 4)
            candidates.append(Retrieved(
                chunk_id=cid,
                text=res["documents"][0][i],
                page_number=res["metadatas"][0][i].get("page_number", 0),
                score=score,
                document_id=res["metadatas"][0][i].get("document_id", ""),
            ))
        candidates = sorted(candidates, key=lambda x: x.score, reverse=True)
        min_score = float(os.getenv("RETRIEVAL_MIN_SCORE", "0.15"))
        results = [c for c in candidates if c.score >= min_score]
        if not results and doc_ids:
            results = candidates[:min(top_k, 3)]
        return sorted(results, key=lambda x: x.score, reverse=True)

    def delete_document(self, document_id: str, user_id: str):
        try:
            col = self._col(user_id)
            col.delete(where={"document_id": document_id})
        except Exception:
            pass


# ─── Stage 6: Response Generator ─────────────────────────────────────────────

class Generator:
    def __init__(self):
        self.api_key = os.getenv("GEMINI_API_KEY", "")
        self.model = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")

    def _extractive_answer(self, query: str, chunks: List[Retrieved], reason: str = "") -> str:
        if not chunks:
            return "I couldn't find relevant information in the selected documents to answer your question."

        query_l = query.lower()
        joined = "\n\n".join(c.text for c in chunks)
        page = chunks[0].page_number

        field_patterns = [
            ("cgpa", r"(?i)\bCGPA\s*[:\-]?\s*([0-9]+(?:\.[0-9]+)?)"),
            ("gpa", r"(?i)\bGPA\s*[:\-]?\s*([0-9]+(?:\.[0-9]+)?)"),
            ("percentage", r"(?i)\bPercentage\s*[:\-]?\s*([0-9]+(?:\.[0-9]+)?%?)"),
        ]
        for label, pattern in field_patterns:
            if label in query_l or (label == "percentage" and "percent" in query_l):
                match = re.search(pattern, joined)
                if match:
                    note = f"\n\nNote: Gemini is unavailable ({reason}), so this was extracted directly from the document." if reason else ""
                    return f"According to page {page}, the **{label.upper()}** is **{match.group(1)}**.\n\nSources: Page {page}{note}"

        excerpts = "\n\n".join(
            f"- Page {c.page_number}: {c.text[:500]}{'...' if len(c.text) > 500 else ''}"
            for c in chunks[:3]
        )
        note = f"\n\nGemini is unavailable ({reason}), so I am showing the most relevant document excerpts." if reason else ""
        return f"I found these relevant excerpts in the selected documents:\n\n{excerpts}{note}"

    def generate(self, query: str, chunks: List[Retrieved], history: List[Dict], doc_names: List[str]) -> str:
        if not chunks:
            return "I couldn't find relevant information in the selected documents to answer your question. Try rephrasing or selecting different documents."
        if not self.api_key or self.api_key == "your_gemini_api_key_here":
            return self._extractive_answer(query, chunks, "API key is not configured")

        context = "\n\n".join(
            f"[Source {i+1} — Page {c.page_number}, relevance {c.score:.0%}]\n{c.text}"
            for i, c in enumerate(chunks)
        )
        docs_list = ", ".join(f'"{n}"' for n in doc_names)

        system = f"""You are DocuMind AI, a precise document assistant. Answer questions using ONLY the provided document excerpts.

Documents loaded: {docs_list}

Rules:
- Base answers strictly on the provided context
- Cite page numbers: "According to page 5..."
- Use bullet points for lists, **bold** for key terms
- If context is insufficient, say so clearly
- End with a brief "Sources" section listing page numbers used

DOCUMENT EXCERPTS:
{context}"""

        contents = []
        for m in history[-6:]:
            role = "model" if m["role"] == "assistant" else "user"
            contents.append({"role": role, "parts": [{"text": m["content"]}]})
        contents.append({"role": "user", "parts": [{"text": query}]})

        url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:generateContent"
        payload = {
            "systemInstruction": {"parts": [{"text": system}]},
            "contents": contents,
            "generationConfig": {
                "temperature": 0.2,
                "maxOutputTokens": 1500,
            },
        }

        try:
            resp = httpx.post(url, params={"key": self.api_key}, json=payload, timeout=60)
            resp.raise_for_status()
            data = resp.json()
            parts = data.get("candidates", [{}])[0].get("content", {}).get("parts", [])
            text = "".join(part.get("text", "") for part in parts).strip()
            return text or "Gemini returned an empty response. Try asking again with a more specific question."
        except httpx.HTTPStatusError as e:
            detail = e.response.text[:500] if e.response is not None else str(e)
            return self._extractive_answer(query, chunks, f"API error: {detail}")
        except Exception as e:
            return self._extractive_answer(query, chunks, f"request failed: {str(e)}")


# ─── Orchestrator ─────────────────────────────────────────────────────────────

class RAGPipeline:
    def __init__(self):
        self.extractor   = PDFExtractor()
        self.chunker     = Chunker(
            size=int(os.getenv("CHUNK_SIZE", "800")),
            overlap=int(os.getenv("CHUNK_OVERLAP", "150")),
        )
        self.vector_store = VectorStore()
        self.generator   = Generator()

    async def ingest(self, pdf_bytes: bytes, document_id: str, user_id: str) -> Dict:
        extracted = self.extractor.extract(pdf_bytes)
        chunks    = self.chunker.split(extracted["full_text"], document_id)
        indexed   = self.vector_store.index(chunks, user_id)
        return {
            "page_count":  extracted["page_count"],
            "chunk_count": indexed,
            "metadata":    extracted["metadata"],
        }

    async def query(self, question: str, user_id: str, doc_ids: List[str], doc_names: List[str], history: List[Dict]) -> Dict:
        top_k = int(os.getenv("TOP_K_RETRIEVAL", "5"))
        chunks = self.vector_store.search(question, user_id, doc_ids, top_k)
        answer = self.generator.generate(question, chunks, history, doc_names)
        return {
            "answer": answer,
            "sources": [
                {
                    "chunk_id":    c.chunk_id,
                    "document_id": c.document_id,
                    "page_number": c.page_number,
                    "score":       c.score,
                    "excerpt":     c.text[:200] + ("…" if len(c.text) > 200 else ""),
                }
                for c in chunks
            ],
            "chunks_retrieved": len(chunks),
        }

    def delete_document(self, document_id: str, user_id: str):
        self.vector_store.delete_document(document_id, user_id)


# Singleton
rag = RAGPipeline()
