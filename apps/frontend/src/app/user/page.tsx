'use client';

import { Sidebar, TopBar, IconUsers } from '../components/shared';

export default function UserPage() {
  return (
    <div className="pos-layout" style={{ background: 'var(--surface)' }}>
      <Sidebar activePath="/user" />
      <div className="pos-main">
        <TopBar title="User Management" subtitle="Manage staff, roles, and permissions" />
        <div className="pos-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
          <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '64px 48px', textAlign: 'center', maxWidth: 480 }}>
            <div style={{ background: 'var(--primary-glow)', width: 80, height: 80, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24, color: 'var(--primary)' }}>
              <IconUsers className="w-10 h-10" />
            </div>
            <h2 style={{ fontSize: 24, fontWeight: 800, color: 'var(--on-surface)', marginBottom: 12 }}>
              Staff & User Management
            </h2>
            <p style={{ color: 'var(--on-surface-muted)', fontSize: 15, lineHeight: 1.5, marginBottom: 32 }}>
              The full RBAC (Role-Based Access Control) interface is currently under development. Soon, you will be able to add new staff members, set detailed permissions, and manage shift schedules here.
            </p>
            <div style={{ display: 'inline-block', padding: '8px 16px', background: 'var(--surface-high)', borderRadius: 20, color: 'var(--primary)', fontWeight: 600, fontSize: 13, border: '1px solid var(--outline-variant)' }}>
              Coming Soon
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
