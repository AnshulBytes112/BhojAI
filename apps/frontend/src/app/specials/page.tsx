'use client';

import { Sidebar, TopBar, IconStar } from '../components/shared';

export default function SpecialsPage() {
  return (
    <div className="pos-layout" style={{ background: 'var(--surface)' }}>
      <Sidebar activePath="/specials" />
      <div className="pos-main">
        <TopBar title="Today's Special" subtitle="Add and manage daily specials" />
        <div className="pos-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
          <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '64px 48px', textAlign: 'center', maxWidth: 480 }}>
            <div style={{ background: 'var(--primary-glow)', width: 80, height: 80, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24, color: 'var(--primary)' }}>
              <IconStar className="w-10 h-10" />
            </div>
            <h2 style={{ fontSize: 24, fontWeight: 800, color: 'var(--on-surface)', marginBottom: 12 }}>
              Today's Special
            </h2>
            <p style={{ color: 'var(--on-surface-muted)', fontSize: 15, lineHeight: 1.5, marginBottom: 32 }}>
              This feature is currently under development. Soon, chefs will be able to add and manage daily specials, updating the menu dynamically for the front-of-house staff.
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
