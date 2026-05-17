'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { Toaster } from 'react-hot-toast';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  useEffect(() => {
    if (!localStorage.getItem('token')) router.replace('/login');
  }, [router]);

  return (
    <div style={{ display:'flex', height:'100vh', overflow:'hidden' }}>
      <Sidebar />
      <main style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', minWidth:0 }}>
        {children}
      </main>
      <Toaster position="bottom-right" toastOptions={{
        style: { background:'var(--surface2)', color:'var(--text)', border:'1px solid var(--border2)', fontSize:13 }
      }} />
    </div>
  );
}
