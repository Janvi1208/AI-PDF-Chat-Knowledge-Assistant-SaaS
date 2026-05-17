'use client';
import { useEffect, useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import toast from 'react-hot-toast';
import { docsAPI } from '@/lib/api';
import type { Document } from '@/types';

const fmt = (n: number) => n >= 1048576 ? (n/1048576).toFixed(1)+' MB' : (n/1024).toFixed(0)+' KB';
const ago = (d: string) => { const s = (Date.now()-new Date(d).getTime())/1000; return s<60?'just now':s<3600?`${Math.floor(s/60)}m ago`:s<86400?`${Math.floor(s/3600)}h ago`:`${Math.floor(s/86400)}d ago`; };

export default function DocumentsPage() {
  const [docs, setDocs]       = useState<Document[]>([]);
  const [loading, setLoading]  = useState(true);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress]  = useState(0);

  const load = () => docsAPI.list().then(setDocs).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  // Poll processing docs
  useEffect(() => {
    const processing = docs.some(d => d.status === 'processing');
    if (!processing) return;
    const t = setInterval(() => docsAPI.list().then(setDocs), 3000);
    return () => clearInterval(t);
  }, [docs]);

  const uploadFile = async (file: File) => {
    if (!file.name.endsWith('.pdf')) { toast.error('Only PDF files supported'); return; }
    if (file.size > 50*1024*1024) { toast.error('File exceeds 50 MB'); return; }
    setUploading(true); setProgress(10);
    try {
      const doc = await docsAPI.upload(file);
      setProgress(100);
      setDocs(d => [doc, ...d]);
      toast.success(`"${file.name}" uploaded — processing…`);
    } catch (e: any) {
      toast.error(e.response?.data?.detail || 'Upload failed');
    } finally {
      setUploading(false); setProgress(0);
    }
  };

  const del = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"?`)) return;
    await docsAPI.del(id);
    setDocs(d => d.filter(x => x.id !== id));
    toast.success('Document deleted');
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (files) => files[0] && uploadFile(files[0]),
    accept: { 'application/pdf': ['.pdf'] },
    multiple: false,
    disabled: uploading,
  });

  return (
    <div style={{ flex:1, overflowY:'auto', padding:28 }}>
      <div style={{ marginBottom:24 }}>
        <h1 style={{ fontFamily:'Instrument Serif', fontSize:26, fontWeight:400, marginBottom:4 }}>Document Library</h1>
        <p style={{ fontSize:13.5, color:'var(--text2)' }}>Upload PDF files to index them for AI-powered search</p>
      </div>

      {/* Drop zone */}
      <div {...getRootProps()} style={{
        border:`2px dashed ${isDragActive ? 'var(--accent)' : 'var(--border2)'}`,
        borderRadius:12, padding:'40px 20px', textAlign:'center', cursor: uploading ? 'not-allowed' : 'pointer',
        background: isDragActive ? 'var(--accent-glow)' : 'transparent', transition:'all 0.2s', marginBottom:20
      }}>
        <input {...getInputProps()} />
        <div style={{ fontSize:36, marginBottom:10 }}>📤</div>
        <div style={{ fontSize:15, fontWeight:500, marginBottom:4 }}>
          {isDragActive ? 'Drop PDF here…' : 'Drag & drop a PDF or click to browse'}
        </div>
        <div style={{ fontSize:13, color:'var(--text2)' }}>Maximum 50 MB · PDF only</div>
      </div>

      {/* Upload progress */}
      {uploading && (
        <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:10, padding:16, marginBottom:20 }}>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
            <span style={{ fontSize:13, color:'var(--text2)' }}>Processing document…</span>
            <span style={{ fontSize:12, color:'var(--accent2)' }}>{progress}%</span>
          </div>
          <div style={{ height:3, background:'var(--surface3)', borderRadius:2 }}>
            <div style={{ height:'100%', background:'var(--accent)', borderRadius:2, width:`${progress}%`, transition:'width 0.3s' }} />
          </div>
        </div>
      )}

      {/* Doc grid */}
      {loading ? (
        <div style={{ textAlign:'center', padding:40, color:'var(--text3)' }}>Loading…</div>
      ) : docs.length === 0 ? (
        <div style={{ textAlign:'center', padding:60, color:'var(--text3)' }}>
          <div style={{ fontSize:48, marginBottom:12, opacity:0.3 }}>📁</div>
          <div style={{ fontSize:16, fontFamily:'Instrument Serif', color:'var(--text2)' }}>No documents yet</div>
          <div style={{ fontSize:13, marginTop:6 }}>Upload your first PDF to get started</div>
        </div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(280px,1fr))', gap:14 }}>
          {docs.map(doc => (
            <div key={doc.id} style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12, padding:18 }}>
              <div style={{ display:'flex', gap:12, marginBottom:14 }}>
                <div style={{ width:40, height:40, background:'rgba(99,102,241,0.1)', borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, flexShrink:0 }}>📄</div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13.5, fontWeight:500, marginBottom:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{doc.filename}</div>
                  <div style={{ fontSize:11.5, color:'var(--text3)' }}>{fmt(doc.file_size)} · {ago(doc.created_at)}</div>
                </div>
              </div>
              <div style={{ display:'flex', gap:12, marginBottom:14 }}>
                <div style={{ display:'flex', alignItems:'center', gap:4, fontSize:11.5, color:'var(--text3)' }}>
                  <span style={{ width:6, height:6, borderRadius:'50%', display:'inline-block',
                    background: doc.status==='ready' ? 'var(--success)' : doc.status==='processing' ? 'var(--warning)' : 'var(--danger)',
                    ...(doc.status==='processing' ? {animation:'pulse-dot 1.5s infinite'} : {}) }} />
                  {doc.status}
                </div>
                {doc.page_count && <div style={{ fontSize:11.5, color:'var(--text3)' }}>📖 {doc.page_count} pages</div>}
                {doc.chunk_count && <div style={{ fontSize:11.5, color:'var(--text3)' }}>✂️ {doc.chunk_count} chunks</div>}
              </div>
              <div style={{ display:'flex', gap:6 }}>
                <a href={`/dashboard/chat?doc=${doc.id}`} style={{
                  flex:1, textAlign:'center', fontSize:12, fontWeight:500, color:'var(--text2)',
                  background:'transparent', border:'1px solid var(--border2)', borderRadius:8,
                  padding:'5px 10px', textDecoration:'none',
                }}>Chat with this</a>
                <button onClick={() => del(doc.id, doc.filename)} style={{
                  fontSize:12, color:'var(--danger)', background:'rgba(239,68,68,0.08)',
                  border:'1px solid rgba(239,68,68,0.2)', borderRadius:8, padding:'5px 10px', cursor:'pointer',
                }}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
