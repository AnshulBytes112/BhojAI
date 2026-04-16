'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { IconFlame, IconCheck } from '../components/shared';
import { useAuthStore } from '../stores/authStore';
import { getRoleHomePath } from '../lib/roles';

const DEMO_AUTH_ENABLED = process.env.NEXT_PUBLIC_ENABLE_DEMO_AUTH === 'true';

// Staff PIN entries for quick login demo
const STAFF_PINS = [
  { name: 'Admin User', username: 'admin', role: 'Admin', initials: 'AU', pin: '0000', color: '#ef4444' },
  { name: 'Ravi Kumar', username: 'waiter1', role: 'Waiter', initials: 'RK', pin: '1234', color: '#3b82f6' },
  { name: 'Priya Singh', username: 'manager1', role: 'Manager', initials: 'PS', pin: '5678', color: '#10b981' },
  { name: 'Chef Arjun', username: 'chef1', role: 'Chef', initials: 'CA', pin: '9012', color: '#f59e0b' },
];

export default function LoginPage() {
  const router = useRouter();
  const { login, pinLogin, setDemoSession, hydrated, isAuthenticated, hydrateFromStorage, logout, user } = useAuthStore();
  const [tab, setTab] = useState<'password' | 'pin'>('password');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [passwordPin, setPasswordPin] = useState('');
  const [pin, setPin] = useState('');
  const [selectedStaff, setSelectedStaff] = useState<typeof STAFF_PINS[0] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPwd, setShowPwd] = useState(false);

  useEffect(() => {
    hydrateFromStorage();
  }, [hydrateFromStorage]);

  useEffect(() => {
    if (hydrated && isAuthenticated) {
      router.replace(getRoleHomePath(user?.role));
    }
  }, [hydrated, isAuthenticated, router, user?.role]);

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const normalizedUsername = username.trim().toLowerCase();
      const response = await login({ username: normalizedUsername, password, pin: passwordPin || undefined });
      router.push(getRoleHomePath(response.user.role));
    } catch (err: unknown) {
      if (DEMO_AUTH_ENABLED) {
        const role = 'ADMIN';
        setDemoSession({ username: username || 'admin', role });
        router.push(getRoleHomePath(role));
      } else {
        logout();
        setError(err instanceof Error ? err.message : 'Login failed. Please check credentials.');
      }
    } finally {
      setLoading(false);
    }
  };

  const appendPin = (digit: string) => {
    if (pin.length >= 4) return;
    setPin((p) => p + digit);
  };

  const deletePin = () => setPin((p) => p.slice(0, -1));

  const confirmPin = () => {
    if (!selectedStaff) {
      setError('Select a staff member first');
      return;
    }

    if (pin.length < 4) {
      setError('Enter a 4-digit PIN');
      return;
    }

    setLoading(true);
    setError('');

    const run = async () => {
      try {
        const response = await pinLogin({ username: selectedStaff.username, pin });
        router.push(getRoleHomePath(response.user.role));
      } catch (err: unknown) {
        if (DEMO_AUTH_ENABLED) {
          if (pin !== selectedStaff.pin) {
            setError('Incorrect PIN for selected staff.');
            return;
          }
          const role = selectedStaff.role.toUpperCase();
          setDemoSession({ username: selectedStaff.name, role });
          router.push(getRoleHomePath(role));
          return;
        }

        setError(err instanceof Error ? err.message : 'PIN login failed.');
      } finally {
        setLoading(false);
      }
    };

    void run();
  };

  const pinDisplay = pin.replace(/./g, '●') + ''.padEnd(4 - pin.length, '○').replace(/○/g, ' ○');

  return (
    <div className="login-page">
      <div className="login-bg" />

      {/* Decorative circles */}
      <div style={{
        position: 'absolute', width: 400, height: 400, borderRadius: '50%',
        border: '1px solid rgba(255,107,43,0.08)', top: '10%', left: '10%',
        pointerEvents: 'none'
      }} />
      <div style={{
        position: 'absolute', width: 200, height: 200, borderRadius: '50%',
        border: '1px solid rgba(255,107,43,0.06)', bottom: '20%', right: '15%',
        pointerEvents: 'none'
      }} />

      <div className="login-card">
        {/* Logo */}
        <div className="login-logo">
          <div className="login-logo-icon">
            <IconFlame />
          </div>
          <div className="login-logo-text">
            <h1>BhojAI</h1>
            <p>Restaurant OS · Spice Garden</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="login-tabs">
          <button className={`login-tab ${tab === 'password' ? 'active' : ''}`} onClick={() => { setTab('password'); setError(''); }}>
            Password Login
          </button>
          <button className={`login-tab ${tab === 'pin' ? 'active' : ''}`} onClick={() => { setTab('pin'); setError(''); }}>
            Quick PIN
          </button>
        </div>

        {error && (
          <div style={{ background: 'var(--danger-bg)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 'var(--radius-lg)', padding: '10px 14px', marginBottom: 16, fontSize: 13, color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>⚠</span> {error}
          </div>
        )}

        {/* Password Form */}
        {tab === 'password' && (
          <form onSubmit={handlePasswordLogin} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="input-group">
              <label className="input-label">Username</label>
              <div className="input-with-icon">
                <span className="input-icon">
                  <svg fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                  </svg>
                </span>
                <input
                  className="input-field"
                  type="text"
                  placeholder="Enter your username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="input-group">
              <label className="input-label">Password</label>
              <div className="input-with-icon" style={{ position: 'relative' }}>
                <span className="input-icon">
                  <svg fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                  </svg>
                </span>
                <input
                  className="input-field"
                  type={showPwd ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(!showPwd)}
                  style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--on-surface-dim)', padding: 4 }}
                >
                  {showPwd ? '🙈' : '👁'}
                </button>
              </div>
            </div>

            <div className="input-group">
              <label className="input-label">PIN (optional / waiter 2FA)</label>
              <div className="input-with-icon">
                <span className="input-icon">
                  <svg fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                  </svg>
                </span>
                <input
                  className="input-field"
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="e.g. 1234"
                  value={passwordPin}
                  onChange={(e) => setPasswordPin(e.target.value.replace(/\D/g, ''))}
                />
              </div>
            </div>

            <button className="btn btn-primary btn-xl btn-full" type="submit" disabled={loading} style={{ marginTop: 8 }}>
              {loading ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid white', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                  Signing in...
                </span>
              ) : 'Sign In to BhojAI'}
            </button>
          </form>
        )}

        {/* PIN Login */}
        {tab === 'pin' && (
          <div>
            {/* Staff Selector */}
            <div className="mb-4">
              <div className="input-label mb-2">Select Staff</div>
              <div style={{ display: 'flex', gap: 8 }}>
                {STAFF_PINS.map((s) => (
                  <button
                    key={s.name}
                    onClick={() => { setSelectedStaff(s); setPin(''); }}
                    style={{
                      flex: 1, padding: '10px 6px', borderRadius: 'var(--radius-lg)',
                      background: selectedStaff?.name === s.name ? 'var(--primary-glow)' : 'var(--surface-highest)',
                      border: `2px solid ${selectedStaff?.name === s.name ? 'var(--primary)' : 'var(--outline-variant)'}`,
                      cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                      transition: 'all 0.15s', fontFamily: 'inherit',
                    }}
                  >
                    <div style={{
                      width: 36, height: 36, borderRadius: '50%', background: s.color,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 12, fontWeight: 700, color: 'white',
                    }}>{s.initials}</div>
                    <span style={{ fontSize: 11, fontWeight: 600, color: selectedStaff?.name === s.name ? 'var(--primary)' : 'var(--on-surface-dim)' }}>
                      {s.name.split(' ')[0]}
                    </span>
                    <span style={{ fontSize: 10, color: 'var(--on-surface-dim)' }}>@{s.username}</span>
                    <span style={{ fontSize: 10, color: 'var(--on-surface-dim)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      {s.role}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* PIN Display */}
            <div className="pin-display">
              {pin.length === 0
                ? <span style={{ color: 'var(--on-surface-dim)', fontSize: 14, letterSpacing: 'normal', fontWeight: 400 }}>Enter PIN</span>
                : pin.split('').map((_, i) => (
                  <span key={i} style={{ display: 'inline-block', width: 14, height: 14, borderRadius: '50%', background: 'var(--primary)', margin: '0 4px' }} />
                ))
              }
            </div>

            {/* PIN Pad */}
            <div className="pin-grid">
              {['1','2','3','4','5','6','7','8','9'].map((d) => (
                <button key={d} className="pin-btn" onClick={() => appendPin(d)}>{d}</button>
              ))}
              <button className="pin-btn delete" onClick={deletePin}>⌫</button>
              <button className="pin-btn" onClick={() => appendPin('0')}>0</button>
              <button
                className="pin-btn confirm"
                onClick={confirmPin}
                disabled={pin.length < 4 || loading}
              >
                {loading ? '...' : <IconCheck />}
              </button>
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{ marginTop: 24, padding: '14px 0 0', borderTop: '1px solid var(--outline-variant)', textAlign: 'center' }}>
          <span style={{ fontSize: 11, color: 'var(--on-surface-dim)' }}>
            BhojAI Restaurant OS · v1.0 · Powered by AI
          </span>
        </div>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
