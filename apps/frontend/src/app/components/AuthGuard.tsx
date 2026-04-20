'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '../stores/authStore';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { hydrated, isAuthenticated, hydrateFromStorage } = useAuthStore();

  useEffect(() => {
    hydrateFromStorage();
  }, [hydrateFromStorage]);

  useEffect(() => {
    if (!hydrated) return;

    const isPublicPath = pathname === '/login' || pathname === '/';
    
    if (!isAuthenticated && !isPublicPath) {
      router.replace('/login');
    }
  }, [hydrated, isAuthenticated, pathname, router]);

  // Wait for hydration to prevent flashing private content to unauthenticated users
  if (!hydrated) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface)', color: 'var(--primary)', fontWeight: 600 }}>
        Loading BhojAI Workspace...
      </div>
    );
  }

  const isPublicPath = pathname === '/login' || pathname === '/';
  if (!isAuthenticated && !isPublicPath) {
    return null; // Prevents the dashboard UI from rendering at all if not logged in
  }

  return <>{children}</>;
}
