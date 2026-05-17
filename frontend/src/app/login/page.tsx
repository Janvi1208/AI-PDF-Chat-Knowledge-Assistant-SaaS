'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { authAPI } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'login'|'register'>('login');
  const [form, setForm] = useState({ email: '', password: '', full_name: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handle = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      let data;
      if (mode === 'login') {
        data = await authAPI.login(form.email, form.password);
      } else {
        data = await authAPI.register({ email: form.email, password: form.password, full_name: form.full_name });
      }
      localStorage.setItem('token', data.access_token);
      localStorage.setItem('user', JSON.stringify(data.user));
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'var(--bg)' }}>
      <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:20, padding:40, width:420 }}>
        <div style={{ textAlign:'center', marginBottom:32 }}>
          <div style={{ width:48, height:48, background:'var(--accent)', borderRadius:12, display:'inline-flex', alignItems:'center', justifyContent:'center', fontSize:24, marginBottom:12 }}>📚</div>
          <div style={{ fontFamily:'Instrument Serif', fontSize:26, color:'var(--text)', marginBottom:4 }}>DocuMind AI</div>
          <div style={{ fontSize:13, color:'var(--text2)' }}>{mode === 'login' ? 'Sign in to your workspace' : 'Create your account'}</div>
        </div>

        {error && (
          <div style={{ background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.2)', color:'var(--danger)', padding:'10px 14px', borderRadius:8, fontSize:13, marginBottom:16 }}>
            ⚠ {error}
          </div>
        )}

        <form onSubmit={handle} style={{ display:'flex', flexDirection:'column', gap:14 }}>
          {mode === 'register' && (
            <div>
              <label style={{ fontSize:12, fontWeight:500, color:'var(--text2)', display:'block', marginBottom:5 }}>Full Name</label>
              <input
                style={{ width:'100%', background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:8, padding:'10px 12px', color:'var(--text)', fontSize:14, outline:'none' }}
                placeholder="Alex Chen" value={form.full_name}
                onChange={e => setForm(f=>({...f, full_name: e.target.value}))} required
              />
            </div>
          )}
          <div>
            <label style={{ fontSize:12, fontWeight:500, color:'var(--text2)', display:'block', marginBottom:5 }}>Email</label>
            <input
              type="email"
              style={{ width:'100%', background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:8, padding:'10px 12px', color:'var(--text)', fontSize:14, outline:'none' }}
              placeholder="you@company.com" value={form.email}
              onChange={e => setForm(f=>({...f, email: e.target.value}))} required
            />
          </div>
          <div>
            <label style={{ fontSize:12, fontWeight:500, color:'var(--text2)', display:'block', marginBottom:5 }}>Password</label>
            <input
              type="password"
              style={{ width:'100%', background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:8, padding:'10px 12px', color:'var(--text)', fontSize:14, outline:'none' }}
              placeholder="••••••••" value={form.password}
              onChange={e => setForm(f=>({...f, password: e.target.value}))} required minLength={6}
            />
          </div>
          <button
            type="submit" disabled={loading}
            style={{ background:'var(--accent)', color:'white', border:'none', borderRadius:8, padding:'11px', fontSize:14, fontWeight:500, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, fontFamily:'DM Sans' }}
          >
            {loading ? 'Please wait…' : mode === 'login' ? 'Sign In →' : 'Create Account →'}
          </button>
        </form>

        <div style={{ textAlign:'center', marginTop:20, fontSize:13, color:'var(--text3)' }}>
          {mode === 'login'
            ? <>Don&apos;t have an account? <span style={{ color:'var(--accent2)', cursor:'pointer' }} onClick={()=>setMode('register')}>Sign up free</span></>
            : <>Already have an account? <span style={{ color:'var(--accent2)', cursor:'pointer' }} onClick={()=>setMode('login')}>Sign in</span></>
          }
        </div>
      </div>
    </div>
  );
}
