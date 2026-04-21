'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isClient) return;

    const token = localStorage.getItem('auth.token');
    const isPublicPath = pathname === '/login' || pathname === '/';
    
    if (!token && !isPublicPath) {
      router.replace('/login');
    }
  }, [isClient, pathname, router]);

  if (!isClient) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface)', color: 'var(--primary)', fontWeight: 600 }}>
        Loading BhojAI Workspace...
      </div>
    );
  }

  return <>{children}</>;
}
