export interface User {
  id: string;
  email: string;
  full_name: string;
  created_at: string;
}

export interface Document {
  id: string;
  filename: string;
  file_size: number;
  page_count: number | null;
  chunk_count: number | null;
  status: 'processing' | 'ready' | 'failed';
  created_at: string;
  metadata?: Record<string, string>;
}

export interface Session {
  id: string;
  title: string;
  document_ids: string[];
  message_count: number;
  last_message_at: string | null;
  created_at: string;
}

export interface Source {
  chunk_id: string;
  document_id: string;
  page_number: number;
  score: number;
  excerpt: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: Source[];
  created_at: string;
}

export interface ChatResponse {
  message_id: string;
  answer: string;
  sources: Source[];
  chunks_retrieved: number;
}
