'use client';
import { useState } from 'react';
import toast from 'react-hot-toast';

const Field = ({ label, hint, children }: { label: string; hint: string; children: React.ReactNode }) => (
  <div style={{ marginBottom:16 }}>
    <label style={{ fontSize:12.5, fontWeight:500, color:'var(--text2)', display:'block', marginBottom:4 }}>{label}</label>
    <div style={{ fontSize:11, color:'var(--text3)', marginBottom:6 }}>{hint}</div>
    {children}
  </div>
);

const inp: React.CSSProperties = { width:'100%', background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:8, padding:'9px 12px', color:'var(--text)', fontFamily:'DM Sans', fontSize:13.5, outline:'none' };

export default function SettingsPage() {
  const [apiKey, setApiKey] = useState('');
  const [chunkSize, setChunk] = useState(800);
  const [overlap, setOverlap] = useState(150);
  const [topK, setTopK]       = useState(5);

  const save = () => toast.success('Settings saved (restart backend to apply)');

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12, padding:20, marginBottom:16 }}>
      <div style={{ fontSize:14, fontWeight:500, marginBottom:16 }}>{title}</div>
      {children}
    </div>
  );

  return (
    <div style={{ flex:1, overflowY:'auto', padding:28 }}>
      <div style={{ marginBottom:24 }}>
        <h1 style={{ fontFamily:'Instrument Serif', fontSize:26, fontWeight:400, marginBottom:4 }}>Settings</h1>
        <p style={{ fontSize:13.5, color:'var(--text2)' }}>Configure your AI assistant and RAG pipeline</p>
      </div>
      <div style={{ maxWidth:560 }}>
        <Section title="API Keys">
          <Field label="Gemini API Key" hint="Used for LLM response generation - set in .env for production">
            <input style={inp} type="password" placeholder="AIza..." value={apiKey} onChange={e=>setApiKey(e.target.value)} />
          </Field>
          <Field label="LLM Model" hint="Model for generating answers">
            <select style={inp}><option>gemini-2.0-flash</option><option>gemini-1.5-flash</option><option>gemini-1.5-pro</option></select>
          </Field>
        </Section>

        <Section title="RAG Pipeline">
          <Field label={`Chunk Size: ${chunkSize} tokens`} hint="Size of each indexed document segment — larger = more context, lower precision">
            <input type="range" min={200} max={2000} step={100} value={chunkSize} onChange={e=>setChunk(+e.target.value)} style={{ width:'100%' }} />
          </Field>
          <Field label={`Chunk Overlap: ${overlap} tokens`} hint="Overlap between adjacent chunks — prevents context loss at boundaries">
            <input type="range" min={0} max={400} step={25} value={overlap} onChange={e=>setOverlap(+e.target.value)} style={{ width:'100%' }} />
          </Field>
          <Field label={`Top-K Retrieval: ${topK} chunks`} hint="Number of chunks retrieved per query — more = richer context, slower">
            <input type="range" min={1} max={15} step={1} value={topK} onChange={e=>setTopK(+e.target.value)} style={{ width:'100%' }} />
          </Field>
        </Section>

        <Section title="Embedding & Vector DB">
          <Field label="Embedding Model" hint="Model for generating vector representations of text">
            <select style={inp}><option>all-MiniLM-L6-v2 (local, free, fast)</option><option>text-embedding-3-small (OpenAI)</option><option>text-embedding-3-large (OpenAI, best quality)</option></select>
          </Field>
          <Field label="Vector Database" hint="Backend storage for semantic search">
            <select style={inp}><option>ChromaDB (local, default)</option><option>Pinecone (cloud, scalable)</option><option>Qdrant (cloud/self-hosted)</option><option>FAISS (in-memory)</option></select>
          </Field>
        </Section>

        <div style={{ padding:16, background:'rgba(99,102,241,0.06)', border:'1px solid rgba(99,102,241,0.15)', borderRadius:10, marginBottom:16, fontSize:13, color:'var(--text2)', lineHeight:1.6 }}>
          💡 For production, set all values in your <code style={{ background:'var(--surface3)', padding:'1px 5px', borderRadius:3, fontSize:12 }}>.env</code> file and restart the backend container. UI settings here are for reference.
        </div>

        <button onClick={save} style={{ background:'var(--accent)', color:'white', border:'none', borderRadius:8, padding:'10px 20px', fontSize:14, fontWeight:500, cursor:'pointer' }}>
          Save Configuration
        </button>
      </div>
    </div>
  );
}
