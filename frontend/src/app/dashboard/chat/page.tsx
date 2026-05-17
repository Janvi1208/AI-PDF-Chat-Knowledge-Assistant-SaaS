'use client';
import { useEffect, useState, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import toast from 'react-hot-toast';
import { docsAPI, sessionsAPI, chatAPI } from '@/lib/api';
import type { Document, Session, Message, Source } from '@/types';

const ago = (d: string) => { const s=(Date.now()-new Date(d).getTime())/1000; return s<60?'just now':s<3600?`${Math.floor(s/60)}m ago`:`${Math.floor(s/3600)}h ago`; };

export default function ChatPage() {
  const [docs, setDocs]           = useState<Document[]>([]);
  const [sessions, setSessions]    = useState<Session[]>([]);
  const [activeId, setActiveId]    = useState<string | null>(null);
  const [messages, setMessages]    = useState<Message[]>([]);
  const [input, setInput]          = useState('');
  const [sending, setSending]      = useState(false);
  const [selectedDocs, setSelectedDocs] = useState<string[]>([]);
  const [loadingMsgs, setLoadingMsgs]  = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const readyDocs = docs.filter(d => d.status === 'ready');

  useEffect(() => {
    Promise.all([docsAPI.list(), sessionsAPI.list()]).then(([d, s]) => {
      setDocs(d);
      setSessions(s);
      const ready = d.filter((x: Document) => x.status === 'ready');
      if (ready.length) setSelectedDocs([ready[0].id]);
    });
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  const loadMessages = async (sid: string) => {
    setLoadingMsgs(true);
    try { setMessages(await chatAPI.messages(sid)); }
    catch { toast.error('Could not load messages'); }
    finally { setLoadingMsgs(false); }
  };

  const selectSession = (s: Session) => {
    setActiveId(s.id);
    loadMessages(s.id);
    if (s.document_ids.length) setSelectedDocs(s.document_ids);
  };

  const newSession = async () => {
    if (selectedDocs.length === 0) { toast.error('Select at least one document first'); return; }
    const s = await sessionsAPI.create('New conversation', selectedDocs);
    setSessions(prev => [s, ...prev]);
    setActiveId(s.id);
    setMessages([]);
  };

  const delSession = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await sessionsAPI.del(id);
    setSessions(s => s.filter(x => x.id !== id));
    if (activeId === id) { setActiveId(null); setMessages([]); }
  };

  const send = async () => {
    if (!input.trim() || sending) return;
    if (!activeId) { toast.error('Create a new chat first'); return; }
    if (selectedDocs.length === 0) { toast.error('Select at least one document'); return; }

    const text = input.trim();
    setInput('');
    setSending(true);

    const tempUser: Message = { id: 'tmp-u', role: 'user', content: text, created_at: new Date().toISOString() };
    setMessages(m => [...m, tempUser]);

    try {
      const res = await chatAPI.send(activeId, text, selectedDocs);
      const aiMsg: Message = { id: res.message_id, role: 'assistant', content: res.answer, sources: res.sources, created_at: new Date().toISOString() };
      setMessages(m => [...m.filter(x => x.id !== 'tmp-u'), tempUser, aiMsg]);
      setSessions(s => s.map(sess => sess.id === activeId ? { ...sess, message_count: sess.message_count + 2, title: sess.message_count === 0 ? text.slice(0,50) : sess.title } : sess));
    } catch (e: any) {
      setMessages(m => m.filter(x => x.id !== 'tmp-u'));
      toast.error(e.response?.data?.detail || 'Failed to get response');
    } finally {
      setSending(false);
    }
  };

  const SUGGESTIONS = ['Summarize the key findings', 'What are the main conclusions?', 'List all action items', 'What risks are mentioned?'];

  return (
    <div style={{ flex:1, display:'flex', minHeight:0 }}>
      {/* Sessions panel */}
      <div style={{ width:230, minWidth:230, borderRight:'1px solid var(--border)', display:'flex', flexDirection:'column', overflow:'hidden' }}>
        <div style={{ padding:'12px 10px', borderBottom:'1px solid var(--border)' }}>
          <button onClick={newSession} style={{ width:'100%', background:'var(--accent)', color:'white', border:'none', borderRadius:8, padding:'7px', fontSize:13, fontWeight:500, cursor:'pointer' }}>
            + New Chat
          </button>
        </div>
        <div style={{ flex:1, overflowY:'auto', padding:8 }}>
          {sessions.length === 0 && <div style={{ padding:'16px 8px', fontSize:12, color:'var(--text3)' }}>No sessions yet</div>}
          {sessions.map(s => (
            <div key={s.id} onClick={() => selectSession(s)} style={{
              padding:'9px 10px', borderRadius:8, cursor:'pointer', marginBottom:2,
              background: s.id === activeId ? 'var(--accent-glow)' : 'transparent',
              transition:'background 0.15s',
            }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:4 }}>
                <div style={{ fontSize:13, fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flex:1, color: s.id===activeId ? 'var(--accent2)':'var(--text)' }}>{s.title}</div>
                <button onClick={e => delSession(s.id, e)} style={{ fontSize:12, color:'var(--text3)', background:'none', border:'none', cursor:'pointer', flexShrink:0, padding:0 }}>✕</button>
              </div>
              <div style={{ fontSize:11, color:'var(--text3)', display:'flex', justifyContent:'space-between', marginTop:2 }}>
                <span>{s.message_count} msgs</span>
                <span>{s.last_message_at ? ago(s.last_message_at) : 'now'}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Chat area */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', minWidth:0 }}>
        {activeId ? (
          <>
            {/* Chat header */}
            <div style={{ padding:'12px 18px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:10, flexShrink:0 }}>
              <span style={{ fontSize:14, fontWeight:500 }}>{sessions.find(s=>s.id===activeId)?.title || 'Chat'}</span>
              <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginLeft:4 }}>
                {selectedDocs.map(id => {
                  const doc = docs.find(d => d.id === id);
                  return doc ? <span key={id} style={{ fontSize:11.5, color:'var(--accent2)', background:'var(--accent-glow)', border:'1px solid rgba(99,102,241,0.2)', padding:'2px 10px', borderRadius:20 }}>📄 {doc.filename.replace('.pdf','')}</span> : null;
                })}
              </div>
            </div>

            {/* Messages */}
            <div style={{ flex:1, overflowY:'auto', padding:20, display:'flex', flexDirection:'column', gap:16 }}>
              {loadingMsgs && <div style={{ textAlign:'center', color:'var(--text3)', fontSize:13 }}>Loading…</div>}
              {!loadingMsgs && messages.length === 0 && (
                <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:14, padding:40, textAlign:'center' }}>
                  <div style={{ fontSize:48, opacity:0.3 }}>💬</div>
                  <div style={{ fontFamily:'Instrument Serif', fontSize:20, color:'var(--text2)' }}>Ask anything about your documents</div>
                  <div style={{ fontSize:13, color:'var(--text3)', maxWidth:320, lineHeight:1.6 }}>The RAG pipeline will retrieve the most relevant sections and craft a precise, cited answer.</div>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:8, justifyContent:'center', marginTop:4 }}>
                    {SUGGESTIONS.map(s => (
                      <button key={s} onClick={() => setInput(s)} style={{ fontSize:12.5, color:'var(--text2)', background:'var(--surface2)', border:'1px solid var(--border)', padding:'6px 14px', borderRadius:20, cursor:'pointer' }}>{s}</button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map(msg => (
                <div key={msg.id} className="animate-fade-in" style={{ display:'flex', gap:12, maxWidth:780, flexDirection: msg.role==='user' ? 'row-reverse' : 'row', ...(msg.role==='user' ? {marginLeft:'auto'} : {}) }}>
                  <div style={{ width:28, height:28, borderRadius:'50%', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize: msg.role==='assistant' ? 14 : 11, fontWeight:600, color:'white', marginTop:2,
                    background: msg.role==='assistant' ? 'var(--accent)' : 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}>
                    {msg.role==='assistant' ? '✦' : 'U'}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ padding:'11px 15px', borderRadius:12, fontSize:14, lineHeight:1.7, maxWidth:560,
                      background: msg.role==='assistant' ? 'var(--surface2)' : 'var(--accent)',
                      color: msg.role==='assistant' ? 'var(--text)' : 'white',
                      border: msg.role==='assistant' ? '1px solid var(--border)' : 'none' }}>
                      {msg.role === 'assistant'
                        ? <div className="prose-chat"><ReactMarkdown>{msg.content}</ReactMarkdown></div>
                        : msg.content
                      }
                    </div>
                    {msg.sources && msg.sources.length > 0 && (
                      <div style={{ marginTop:8 }}>
                        <div style={{ fontSize:10, color:'var(--text3)', fontWeight:500, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:5 }}>Sources</div>
                        <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                          {msg.sources.map((src: Source, i: number) => {
                            const docName = docs.find(d => d.id === src.document_id)?.filename?.replace('.pdf','') || 'Document';
                            return (
                              <span key={i} style={{ fontSize:11, color:'var(--text2)', background:'var(--surface)', border:'1px solid var(--border)', padding:'2px 8px', borderRadius:6 }}>
                                📄 {docName} · p.{src.page_number} · {Math.round(src.score*100)}%
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    <div style={{ fontSize:10.5, color:'var(--text3)', marginTop:4, ...(msg.role==='user'?{textAlign:'right'}:{}) }}>{ago(msg.created_at)}</div>
                  </div>
                </div>
              ))}

              {sending && (
                <div style={{ display:'flex', gap:12, maxWidth:780 }}>
                  <div style={{ width:28, height:28, borderRadius:'50%', background:'var(--accent)', display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontSize:14, flexShrink:0 }}>✦</div>
                  <div style={{ padding:'14px 15px', background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:12 }}>
                    <div style={{ display:'flex', gap:4, alignItems:'center' }}>
                      <div className="typing-dot"/><div className="typing-dot"/><div className="typing-dot"/>
                    </div>
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div style={{ padding:'14px 18px', borderTop:'1px solid var(--border)', flexShrink:0 }}>
              {readyDocs.length > 0 && (
                <div style={{ display:'flex', gap:6, marginBottom:10, flexWrap:'wrap', alignItems:'center' }}>
                  <span style={{ fontSize:11.5, color:'var(--text3)' }}>Search in:</span>
                  {readyDocs.map(d => (
                    <button key={d.id} onClick={() => setSelectedDocs(s => s.includes(d.id) ? s.filter(x=>x!==d.id) : [...s,d.id])} style={{
                      fontSize:11.5, padding:'3px 10px', borderRadius:20, cursor:'pointer',
                      background: selectedDocs.includes(d.id) ? 'var(--accent-glow)' : 'transparent',
                      color: selectedDocs.includes(d.id) ? 'var(--accent2)' : 'var(--text3)',
                      border: `1px solid ${selectedDocs.includes(d.id) ? 'rgba(99,102,241,0.3)' : 'var(--border)'}`,
                    }}>
                      📄 {d.filename.replace('.pdf','').slice(0,22)}
                    </button>
                  ))}
                </div>
              )}
              <div style={{ display:'flex', gap:10, alignItems:'flex-end' }}>
                <textarea
                  rows={2}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key==='Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                  placeholder="Ask a question about your documents… (Enter to send)"
                  style={{ flex:1, background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:12, padding:'11px 13px', color:'var(--text)', fontFamily:'DM Sans', fontSize:14, resize:'none', outline:'none', lineHeight:1.5, maxHeight:120 }}
                />
                <button onClick={send} disabled={sending || !input.trim()} style={{ width:40, height:40, borderRadius:10, background: (sending||!input.trim()) ? 'var(--surface3)' : 'var(--accent)', border:'none', cursor: (sending||!input.trim()) ? 'not-allowed':'pointer', color:'white', fontSize:18, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  ↑
                </button>
              </div>
            </div>
          </>
        ) : (
          <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:16, padding:40, textAlign:'center' }}>
            <div style={{ fontSize:56, opacity:0.2 }}>💬</div>
            <div style={{ fontFamily:'Instrument Serif', fontSize:22, color:'var(--text2)' }}>Start a conversation</div>
            <div style={{ fontSize:13.5, color:'var(--text3)', maxWidth:340, lineHeight:1.6 }}>Select documents to search, then click "New Chat" to ask questions about them.</div>
            {readyDocs.length === 0 && (
              <a href="/dashboard/documents" style={{ color:'var(--accent2)', fontSize:13.5 }}>Upload a document first →</a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
