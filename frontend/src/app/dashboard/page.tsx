'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { docsAPI, sessionsAPI } from '@/lib/api';
import type { Document, Session, User } from '@/types';

const fmt = (n: number) => n >= 1048576 ? (n/1048576).toFixed(1)+'MB' : (n/1024).toFixed(0)+'KB';

export default function DashboardPage() {
  const [docs, setDocs]       = useState<Document[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [user, setUser]        = useState<User | null>(null);
  const [loading, setLoading]  = useState(true);

  useEffect(() => {
    const u = localStorage.getItem('user');
    if (u) setUser(JSON.parse(u));
    Promise.all([docsAPI.list(), sessionsAPI.list()])
      .then(([d, s]) => { setDocs(d); setSessions(s); })
      .finally(() => setLoading(false));
  }, []);

  const ready   = docs.filter(d => d.status === 'ready');
  const pages   = docs.reduce((a, d) => a + (d.page_count || 0), 0);
  const msgs    = sessions.reduce((a, s) => a + s.message_count, 0);

  const STATS = [
    { label:'Documents',    value: docs.length,            icon:'📄', sub:`${ready.length} indexed` },
    { label:'Pages Indexed', value: pages.toLocaleString(), icon:'📖', sub:'Fully searchable' },
    { label:'Chat Sessions', value: sessions.length,        icon:'💬', sub:'Conversations' },
    { label:'Messages Sent', value: msgs,                   icon:'✨', sub:'AI responses' },
  ];

  return (
    <div style={{ flex:1, overflowY:'auto', padding:28 }}>
      <div style={{ marginBottom:28 }}>
        <h1 style={{ fontFamily:'Instrument Serif', fontSize:26, fontWeight:400, marginBottom:4 }}>
          Good {new Date().getHours() < 12 ? 'morning' : 'afternoon'}{user ? `, ${user.full_name.split(' ')[0]}` : ''} 👋
        </h1>
        <p style={{ fontSize:13.5, color:'var(--text2)' }}>Your AI knowledge base — {ready.length} documents indexed and ready.</p>
      </div>

      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:28 }}>
        {STATS.map(s => (
          <div key={s.label} style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12, padding:'18px 20px' }}>
            <div style={{ fontSize:12, color:'var(--text3)', fontWeight:500, marginBottom:8 }}>{s.icon} {s.label}</div>
            <div style={{ fontSize:26, fontWeight:600, lineHeight:1 }}>{loading ? '…' : s.value}</div>
            <div style={{ fontSize:11.5, color:'var(--success)', marginTop:4 }}>{s.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>
        {/* Recent docs */}
        <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12, padding:20 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
            <span style={{ fontSize:14, fontWeight:500 }}>Recent Documents</span>
            <Link href="/dashboard/documents" style={{ fontSize:12, color:'var(--accent2)', textDecoration:'none' }}>View all →</Link>
          </div>
          {docs.length === 0 && !loading && (
            <div style={{ textAlign:'center', padding:'20px 0', color:'var(--text3)', fontSize:13 }}>
              No documents yet. <Link href="/dashboard/documents" style={{ color:'var(--accent2)' }}>Upload one →</Link>
            </div>
          )}
          {docs.slice(0,4).map(doc => (
            <div key={doc.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 0', borderBottom:'1px solid var(--border)' }}>
              <span style={{ fontSize:20 }}>📄</span>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:13, fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{doc.filename}</div>
                <div style={{ fontSize:11, color:'var(--text3)' }}>{doc.page_count ? `${doc.page_count} pages` : 'Processing…'} · {fmt(doc.file_size)}</div>
              </div>
              <span style={{ fontSize:11, padding:'2px 8px', borderRadius:4, fontWeight:500,
                background: doc.status==='ready' ? 'rgba(16,185,129,0.1)' : doc.status==='processing' ? 'rgba(245,158,11,0.1)' : 'rgba(239,68,68,0.1)',
                color: doc.status==='ready' ? 'var(--success)' : doc.status==='processing' ? 'var(--warning)' : 'var(--danger)' }}>
                {doc.status}
              </span>
            </div>
          ))}
        </div>

        {/* RAG info */}
        <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12, padding:20 }}>
          <div style={{ fontSize:14, fontWeight:500, marginBottom:6 }}>RAG Pipeline</div>
          <div style={{ fontSize:12, color:'var(--text3)', marginBottom:16 }}>How your questions become answers</div>
          <div style={{ display:'flex', gap:0, marginBottom:16 }}>
            {['📥 Upload','✂️ Chunk','🧮 Embed','🗃️ Index','🔍 Search','🤖 Answer'].map((s,i) => (
              <div key={s} style={{ flex:1, textAlign:'center', padding:'8px 4px', borderRight: i<5 ? '1px solid var(--border)' : 'none' }}>
                <div style={{ fontSize:10, color:'var(--text3)', marginBottom:3 }}>{i+1}</div>
                <div style={{ fontSize:11, color:'var(--text2)', lineHeight:1.3 }}>{s}</div>
              </div>
            ))}
          </div>
          {[
            ['Chunk Size', '800 tokens'],
            ['Overlap', '150 tokens'],
            ['Embedding', 'all-MiniLM-L6-v2'],
            ['Vector DB', 'ChromaDB'],
            ['Top-K', '5 chunks'],
            ['LLM', 'Gemini Flash'],
          ].map(([k,v]) => (
            <div key={k} style={{ display:'flex', justifyContent:'space-between', fontSize:12, padding:'4px 0', borderBottom:'1px solid var(--border)' }}>
              <span style={{ color:'var(--text3)' }}>{k}</span>
              <span style={{ color:'var(--text2)', fontWeight:500 }}>{v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
