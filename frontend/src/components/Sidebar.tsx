'use client';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import type { User } from '@/types';

const NAV = [
  { href: '/dashboard',           label: 'Dashboard', icon: '⊞' },
  { href: '/dashboard/documents', label: 'Documents',  icon: '📄' },
  { href: '/dashboard/chat',      label: 'Chat',       icon: '💬' },
  { href: '/dashboard/settings',  label: 'Settings',   icon: '⚙' },
];

export default function Sidebar() {
  const router   = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const u = localStorage.getItem('user');
    if (u) setUser(JSON.parse(u));
  }, []);

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    router.push('/login');
  };

  const initials = user?.full_name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0,2) || 'U';

  return (
    <aside style={{ width:240, minWidth:240, background:'var(--surface)', borderRight:'1px solid var(--border)', display:'flex', flexDirection:'column', height:'100vh', overflow:'hidden' }}>
      {/* Logo */}
      <div style={{ padding:'20px 16px 14px', borderBottom:'1px solid var(--border)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16 }}>
          <div style={{ width:32, height:32, background:'var(--accent)', borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', fontSize:16 }}>📚</div>
          <span style={{ fontFamily:'Instrument Serif', fontSize:17 }}>DocuMind</span>
          <span style={{ fontSize:10, fontWeight:500, color:'var(--accent2)', background:'var(--accent-glow)', border:'1px solid rgba(99,102,241,0.2)', padding:'1px 6px', borderRadius:20 }}>AI</span>
        </div>
        <Link href="/dashboard/documents" style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:6, background:'var(--accent)', color:'white', borderRadius:8, padding:'7px 0', fontSize:13, fontWeight:500, textDecoration:'none', width:'100%' }}>
          + Upload PDF
        </Link>
      </div>

      {/* Nav */}
      <nav style={{ padding:'8px', flex:1 }}>
        <div style={{ fontSize:10, fontWeight:600, color:'var(--text3)', letterSpacing:'0.08em', textTransform:'uppercase', padding:'8px 8px 4px' }}>Menu</div>
        {NAV.map(n => {
          const active = pathname === n.href || (n.href !== '/dashboard' && pathname.startsWith(n.href));
          return (
            <Link key={n.href} href={n.href} style={{
              display:'flex', alignItems:'center', gap:10, padding:'8px 10px', borderRadius:8,
              fontSize:13.5, color: active ? 'var(--accent2)' : 'var(--text2)',
              background: active ? 'var(--accent-glow)' : 'transparent',
              textDecoration:'none', marginBottom:2, transition:'all 0.15s',
            }}>
              <span style={{ width:18, textAlign:'center' }}>{n.icon}</span>
              {n.label}
            </Link>
          );
        })}
      </nav>

      {/* User footer */}
      <div style={{ padding:'12px', borderTop:'1px solid var(--border)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, padding:8, borderRadius:8 }}>
          <div style={{ width:32, height:32, borderRadius:'50%', background:'linear-gradient(135deg,var(--accent),#8b5cf6)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:600, color:'white', flexShrink:0 }}>
            {initials}
          </div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:13, fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{user?.full_name || 'User'}</div>
            <div style={{ fontSize:11, color:'var(--text3)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{user?.email}</div>
          </div>
          <button onClick={logout} style={{ fontSize:14, color:'var(--text3)', background:'none', border:'none', cursor:'pointer' }} title="Sign out">↩</button>
        </div>
      </div>
    </aside>
  );
}
