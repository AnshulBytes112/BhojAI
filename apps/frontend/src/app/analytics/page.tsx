'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Sidebar,
  TopBar,
  ToastContainer,
  IconArrowDown,
  IconArrowUp,
  IconCash,
  IconCard,
  IconChart,
  IconInventory,
  IconCog,
  IconUsers,
  IconStar,
  IconFlame,
  type ToastItem,
} from '../components/shared';
import { apiRequest, formatCompactCurrency, formatCurrency, formatNumber } from '../lib/api';

interface DashboardSummary {
  totalRevenue: number;
  totalOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  avgOrderValue: number;
  lowStockCount: number;
  paymentBreakdown: Record<string, number>;
  lowStockItems: Array<{ id: string; name: string; quantity: number; minThreshold: number | null; unit: string }>;
}

interface TopItem {
  id: string;
  name: string;
  count: number;
  revenue: number;
  dietaryLabel: string | null;
}

interface HourlyPoint {
  hour: number;
  orders: number;
  revenue: number;
}

interface AIInsight {
  type: 'HOT_ITEM' | 'SLOW_ITEM';
  message: string;
  data: { id: string; name: string; count: number; revenue: number };
}

const FALLBACK_INSIGHTS: AIInsight[] = [
  {
    type: 'HOT_ITEM',
    message: '🔥 Butter Chicken is a bestseller! Consider featuring it on the home menu.',
    data: { id: 'm1', name: 'Butter Chicken', count: 126, revenue: 47880 },
  },
  {
    type: 'SLOW_ITEM',
    message: '📉 Veg Biryani has low sales. Consider a 15% discount or featuring it in staff recommendations.',
    data: { id: 'm5', name: 'Veg Biryani', count: 12, revenue: 480 },
  },
];

const FALLBACK_SUMMARY: DashboardSummary = {
  totalRevenue: 184250,
  totalOrders: 214,
  completedOrders: 197,
  cancelledOrders: 5,
  avgOrderValue: 936,
  lowStockCount: 3,
  paymentBreakdown: { CASH: 48250, CARD: 59100, UPI: 76900 },
  lowStockItems: [
    { id: 'i1', name: 'Paneer Blocks', quantity: 4, minThreshold: 10, unit: 'kg' },
    { id: 'i2', name: 'Basmati Rice', quantity: 12, minThreshold: 18, unit: 'kg' },
    { id: 'i3', name: 'Kulfi Cups', quantity: 16, minThreshold: 20, unit: 'pcs' },
  ],
};

const FALLBACK_TOP_ITEMS: TopItem[] = [
  { id: 'm1', name: 'Butter Chicken', count: 126, revenue: 47880, dietaryLabel: 'NON_VEG' },
  { id: 'm2', name: 'Chicken Biryani', count: 118, revenue: 40120, dietaryLabel: 'NON_VEG' },
  { id: 'm3', name: 'Paneer Tikka', count: 102, revenue: 28560, dietaryLabel: 'VEG' },
  { id: 'm4', name: 'Mango Lassi', count: 96, revenue: 11520, dietaryLabel: 'VEG' },
  { id: 'm5', name: 'Garlic Naan', count: 188, revenue: 13160, dietaryLabel: 'VEG' },
];

const FALLBACK_HOURLY: HourlyPoint[] = Array.from({ length: 12 }, (_, index) => ({
  hour: index + 11,
  orders: [4, 7, 11, 16, 18, 21, 19, 17, 14, 11, 9, 6][index],
  revenue: [3200, 5400, 9200, 15100, 18600, 24100, 22800, 19800, 15600, 10400, 7600, 4200][index],
}));



export default function AnalyticsPage() {
  const [summary, setSummary] = useState<DashboardSummary>(FALLBACK_SUMMARY);
  const [topItems, setTopItems] = useState<TopItem[]>(FALLBACK_TOP_ITEMS);
  const [hourly, setHourly] = useState<HourlyPoint[]>(FALLBACK_HOURLY);
  const [insights, setInsights] = useState<AIInsight[]>(FALLBACK_INSIGHTS);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const PERIOD_OPTIONS = ['today', 'yesterday', 'week', 'month', 'last30'] as const;
  type PeriodKey = typeof PERIOD_OPTIONS[number];
  const [period, setPeriod] = useState<PeriodKey>('today');
  const [showPeriodMenu, setShowPeriodMenu] = useState(false);
  const mountedRef = useRef(true);

  const PERIOD_LABELS: Record<string, string> = {
    today: '📅 Today',
    yesterday: '📅 Yesterday',
    week: '📅 This Week',
    month: '📅 This Month',
    last30: '📅 Last 30 Days',
  };

  const load = useCallback(async (silent = false, forcePeriod?: string) => {
    const activePeriod = forcePeriod ?? period;
    if (!silent) setLoading(true);
    else setIsRefreshing(true);
    try {
      const qs = `?period=${activePeriod}`;
      const [summaryData, topItemsData, hourlyData, insightsData] = await Promise.all([
        apiRequest<DashboardSummary>(`/dashboard/summary${qs}`),
        apiRequest<TopItem[]>(`/dashboard/top-items${qs}`),
        apiRequest<HourlyPoint[]>(`/dashboard/hourly${qs}`),
        apiRequest<{ insights: AIInsight[] }>('/ai/insights'),
      ]);

      if (!mountedRef.current) return;
      setSummary(summaryData);
      setTopItems(topItemsData.length ? topItemsData : FALLBACK_TOP_ITEMS);
      setHourly(hourlyData.length ? hourlyData : FALLBACK_HOURLY);
      setLastUpdated(new Date());

      if (insightsData && insightsData.insights) {
        setInsights(insightsData.insights);
      }
    } catch {
      if (!mountedRef.current) return;
      if (!silent) {
        setSummary(FALLBACK_SUMMARY);
        setTopItems(FALLBACK_TOP_ITEMS);
        setHourly(FALLBACK_HOURLY);
        setInsights(FALLBACK_INSIGHTS);
        const id = Date.now().toString();
        setToasts((prev) => [
          ...prev,
          {
            id,
            icon: 'i',
            title: 'Showing workspace preview data',
            message: 'Backend analytics was unavailable, so the dashboard loaded curated demo metrics.',
          },
        ]);
        setTimeout(() => setToasts((prev) => prev.filter((toast) => toast.id !== id)), 4500);
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
        setIsRefreshing(false);
      }
    }
  }, [period]);

  useEffect(() => {
    mountedRef.current = true;
    load(false);

    // Poll every 30 seconds for real-time updates
    const interval = setInterval(() => {
      load(true); // silent refresh — no loading spinner
    }, 30000);

    return () => {
      mountedRef.current = false;
      clearInterval(interval);
    };
  }, [load]);

  // Close period dropdown on outside click
  useEffect(() => {
    if (!showPeriodMenu) return;
    const handler = () => setShowPeriodMenu(false);
    window.addEventListener('click', handler, { capture: true, once: true });
    return () => window.removeEventListener('click', handler, { capture: true });
  }, [showPeriodMenu]);

  return (
    <div className="pos-layout" style={{ background: 'var(--surface)' }}>
      <Sidebar activePath="/analytics" />

      <div className="pos-main">
        <TopBar
          title="Welcome to Dashboard"
          subtitle={`Real-time restaurant performance · ${PERIOD_LABELS[period].replace('📅 ', '')}`}
          actions={
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              {/* Live indicator */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#6b7280', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 20, padding: '4px 12px' }}>
                <span style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: isRefreshing ? '#f59e0b' : '#10b981',
                  display: 'inline-block',
                  boxShadow: isRefreshing ? '0 0 0 2px rgba(245,158,11,0.25)' : '0 0 0 2px rgba(16,185,129,0.25)',
                  animation: 'pulse-dot 1.5s infinite',
                }} />
                {isRefreshing ? 'Syncing…' : 'Live'}
                {lastUpdated && (
                  <span style={{ color: '#9ca3af', marginLeft: 4 }}>
                    · {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                )}
              </div>

              {/* Date range dropdown */}
              <div style={{ position: 'relative' }}>
                <button
                  className="btn btn-secondary"
                  onClick={() => setShowPeriodMenu((v) => !v)}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 148 }}
                >
                  {PERIOD_LABELS[period]}
                  <span style={{ fontSize: 10, marginLeft: 'auto', color: '#9ca3af' }}>▼</span>
                </button>
                {showPeriodMenu && (
                  <div style={{
                    position: 'absolute', top: '110%', right: 0, zIndex: 200,
                    background: '#fff', border: '1px solid #e5e7eb',
                    borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                    minWidth: 180, overflow: 'hidden',
                  }}>
                    {(Object.entries(PERIOD_LABELS) as [string, string][]).map(([key, label]) => (
                      <button
                        key={key}
                        onClick={() => {
                          const newPeriod = key as typeof period;
                          setPeriod(newPeriod);
                          setShowPeriodMenu(false);
                          load(false, newPeriod);
                        }}
                        style={{
                          width: '100%', textAlign: 'left', padding: '10px 16px',
                          background: period === key ? '#fff7ed' : 'transparent',
                          color: period === key ? '#ea580c' : '#374151',
                          fontWeight: period === key ? 700 : 500,
                          fontSize: 13, border: 'none', cursor: 'pointer',
                          borderBottom: '1px solid #f3f4f6',
                          transition: 'background 0.1s',
                        }}
                        onMouseEnter={(e) => { if (period !== key) e.currentTarget.style.background = '#f9fafb'; }}
                        onMouseLeave={(e) => { if (period !== key) e.currentTarget.style.background = 'transparent'; }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <button
                className="btn btn-primary"
                onClick={() => load(false)}
                disabled={loading}
                style={{ minWidth: 110 }}
              >
                {loading ? '⏳ Loading…' : '↻ Refresh'}
              </button>
            </div>
          }
        />

        <div className="pos-content">

        {/* Top KPI Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20, marginBottom: 24 }}>
          {/* Total Sales */}
          <div className="card hover-card" title="Total Sales Performance">
            <div style={{ fontSize: 13, color: '#6b7280', fontWeight: 600, marginBottom: 8 }}>Total Sales</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#111827' }}>{loading ? '...' : formatCurrency(summary.totalRevenue)}</div>
            <div style={{ fontSize: 12, color: '#10b981', fontWeight: 600, marginTop: 4 }}>+12.4% <span style={{ color: '#9ca3af' }}>vs yesterday</span></div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 16, paddingTop: 16, borderTop: '1px solid #f3f4f6' }}>
              <div>
                <div style={{ fontSize: 11, color: '#6b7280' }}>Subtotal</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>{formatCompactCurrency(summary.totalRevenue * 0.82)}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: '#6b7280' }}>Discount</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>{formatCompactCurrency(summary.totalRevenue * 0.05)}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: '#6b7280' }}>Tax</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>{formatCompactCurrency(summary.totalRevenue * 0.18)}</div>
              </div>
            </div>
          </div>

          {/* Total Customers */}
          <div className="card hover-card" title="Customer Growth & Retention">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: 13, color: '#6b7280', fontWeight: 600, marginBottom: 8 }}>Total Customers</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: '#111827' }}>{loading ? '...' : formatNumber(summary.totalOrders * 2.4)}</div>
                <div style={{ fontSize: 12, color: '#10b981', fontWeight: 600, marginTop: 4 }}>+5.2% <span style={{ color: '#9ca3af' }}>vs yesterday</span></div>
              </div>
              <div style={{ background: '#eff6ff', padding: 12, borderRadius: 12, color: '#3b82f6', width: 48, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <IconUsers />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 16, marginTop: 24, paddingTop: 16, borderTop: '1px solid #f3f4f6' }}>
               <div style={{ flex: 1 }}>
                 <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>Retention</div>
                 <div style={{ height: 6, background: '#f3f4f6', borderRadius: 3, overflow: 'hidden' }}>
                   <div style={{ width: '65%', height: '100%', background: '#3b82f6' }}></div>
                 </div>
               </div>
            </div>
          </div>

          {/* Average Order Value */}
          <div className="card hover-card" title="Average Order Value Metrics">
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: 13, color: '#6b7280', fontWeight: 600, marginBottom: 8 }}>Avg Order Value</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: '#111827' }}>{loading ? '...' : formatCurrency(summary.avgOrderValue)}</div>
                <div style={{ fontSize: 12, color: '#f43f5e', fontWeight: 600, marginTop: 4 }}>-1.5% <span style={{ color: '#9ca3af' }}>vs yesterday</span></div>
              </div>
              <div style={{ background: '#fef2f2', padding: 12, borderRadius: 12, color: '#ef4444', width: 48, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <IconCard />
              </div>
            </div>
             <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, marginTop: 16, height: 36 }}>
                {[40, 60, 45, 70, 85, 65, 90].map((val, i) => (
                  <div key={i} style={{ flex: 1, height: `${val}%`, background: i === 6 ? '#ef4444' : '#fecaca', borderRadius: '2px 2px 0 0' }}></div>
                ))}
            </div>
          </div>

          {/* Customer Satisfaction */}
          <div className="card hover-card" title="Overall Customer Satisfaction">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: 13, color: '#6b7280', fontWeight: 600, marginBottom: 8 }}>Customer Satisfaction</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: '#111827', display: 'flex', alignItems: 'center', gap: 8 }}>
                  4.8 <span style={{ width: 20, height: 20, color: '#f59e0b', display: 'inline-block' }}><IconStar /></span>
                </div>
                <div style={{ fontSize: 12, color: '#10b981', fontWeight: 600, marginTop: 4 }}>+0.2 <span style={{ color: '#9ca3af' }}>from last week</span></div>
              </div>
              <div style={{ background: '#fffbeb', padding: 12, borderRadius: 12, color: '#f59e0b', width: 48, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <IconFlame />
              </div>
            </div>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 24, paddingTop: 16, borderTop: '1px solid #f3f4f6' }}>
               Based on 124 recent reviews (Zomato & Google)
            </div>
          </div>
        </div>

        {/* Charts Row */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20, marginBottom: 24 }}>
          {/* Sales Trend (Area Chart) */}
          <div className="card hover-card" title="Sales Trend over time">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#111827' }}>Sales | Dine In & Ordering</div>
              <div style={{ display: 'flex', gap: 16, fontSize: 12, fontWeight: 600 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#e58b12' }}></span>Dine In</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#5c4632' }}></span>Online Ordering</div>
              </div>
            </div>
            <div style={{ height: 260, position: 'relative' }}>
              <svg className="hover-chart" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
                 <defs>
                    <linearGradient id="dineInGrad" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="rgba(229, 139, 18, 0.2)" />
                      <stop offset="100%" stopColor="rgba(229, 139, 18, 0)" />
                    </linearGradient>
                    <linearGradient id="onlineGrad" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="rgba(92, 70, 50, 0.2)" />
                      <stop offset="100%" stopColor="rgba(92, 70, 50, 0)" />
                    </linearGradient>
                 </defs>
                 {/* Grid lines */}
                 {[0, 25, 50, 75, 100].map(y => (
                   <line key={y} x1="0" y1={y} x2="100" y2={y} stroke="#f3f4f6" strokeWidth="0.5" />
                 ))}
                 
                 {/* Dine In Line (Simulated Curve) */}
                 <path d="M0,80 Q10,75 20,85 T40,60 T60,20 T80,40 T100,30" fill="url(#dineInGrad)" stroke="#e58b12" strokeWidth="2" strokeLinecap="round" />
                 
                 {/* Online Line (Simulated Curve) */}
                 <path d="M0,50 Q15,50 30,80 T60,60 T80,30 T100,50" fill="url(#onlineGrad)" stroke="#5c4632" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, fontSize: 11, color: '#6b7280' }}>
                 <span>11 am</span><span>1 pm</span><span>3 pm</span><span>5 pm</span><span>7 pm</span><span>9 pm</span><span>11 pm</span>
              </div>
            </div>
          </div>

          {/* Popular Time (Bar Chart) */}
          <div className="card hover-card" title="Hourly Order Volume">
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#111827' }}>Popular Time</div>
                <div style={{ fontSize: 12, color: '#6b7280' }}>Today ▾</div>
             </div>
             
             <div style={{ height: 260, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', height: 200, gap: 4, paddingBottom: 12, borderBottom: '1px solid #e5e7eb' }}>
                   {hourly.slice(-9).map((point, i, arr) => {
                      const max = Math.max(...hourly.map(h => h.revenue));
                      const isPeak = point.revenue === max;
                      const heightPct = Math.max(10, (point.revenue / max) * 100);
                      const isLast = i === arr.length - 1;
                      return (
                        <div key={i} style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                          {isPeak && (
                             <div style={{ position: 'absolute', top: -36, right: isLast ? 0 : 'auto', left: isLast ? 'auto' : '50%', transform: isLast ? 'none' : 'translateX(-50%)', background: '#111827', border: '1px solid #e5e7eb', padding: '4px 8px', borderRadius: 4, fontSize: 10, fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', zIndex: 10 }}>
                               Usually busy
                               {!isLast && <div style={{ position: 'absolute', bottom: -4, left: '50%', transform: 'translateX(-50%)', borderWidth: '4px 4px 0', borderStyle: 'solid', borderColor: '#111827 transparent transparent' }}></div>}
                             </div>
                          )}
                          <div className="hover-bar" title={`${point.revenue} sales at ${point.hour}:00`} style={{ width: '100%', height: `${heightPct}%`, background: isPeak ? '#e58b12' : '#fef2e8', borderRadius: '4px 4px 0 0', transition: 'height 0.3s' }}></div>
                        </div>
                      );
                   })}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, fontSize: 11, color: '#6b7280' }}>
                   {hourly.slice(-9).map((point, i) => (
                      <span key={point.hour} style={{ display: i % 2 !== 0 ? 'none' : 'inline-block' }}>{point.hour}:00</span>
                   ))}
                </div>
             </div>
          </div>
        </div>

        {/* Breakdown Row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20, marginBottom: 24 }}>
           {/* Payment Types */}
           <div className="card hover-card" title="Revenue distribution by payment method">
              <div style={{ fontSize: 15, fontWeight: 700, color: '#111827', marginBottom: 20 }}>Payment Types</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                 <div className="hover-chart" style={{ width: 100, height: 100, borderRadius: '50%', background: 'conic-gradient(#e58b12 0% 40%, #3c9b6a 40% 70%, #c17d12 70% 100%)' }}></div>
                 <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12, fontSize: 12, fontWeight: 600 }}>
                    <div className="hover-item" title="Card Transactions: 40%" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                       <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#e58b12' }}></span>Card</div>
                       <span>40%</span>
                    </div>
                    <div className="hover-item" title="Cash Transactions: 30%" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                       <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#3c9b6a' }}></span>Cash</div>
                       <span>30%</span>
                    </div>
                    <div className="hover-item" title="UPI/Digital Wallets: 30%" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                       <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#c17d12' }}></span>UPI/Others</div>
                       <span>30%</span>
                    </div>
                 </div>
              </div>
           </div>

           {/* Order Type */}
           <div className="card hover-card" title="Revenue distribution by order channel">
              <div style={{ fontSize: 15, fontWeight: 700, color: '#111827', marginBottom: 20 }}>Order Type</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                 <div className="hover-chart" style={{ width: 100, height: 100, borderRadius: '50%', background: 'conic-gradient(#e58b12 0% 40%, #c84b3f 40% 70%, #c17d12 70% 90%, #5c4632 90% 100%)' }}></div>
                 <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10, fontSize: 12, fontWeight: 600 }}>
                    <div className="hover-item" title="Dine In Orders: 40%" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                       <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#e58b12' }}></span>Dine In</div>
                       <span>40%</span>
                    </div>
                    <div className="hover-item" title="Zomato Deliveries: 30%" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                       <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#c84b3f' }}></span>Zomato</div>
                       <span>30%</span>
                    </div>
                    <div className="hover-item" title="Swiggy Deliveries: 20%" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                       <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#c17d12' }}></span>Swiggy</div>
                       <span>20%</span>
                    </div>
                    <div className="hover-item" title="Takeaway Orders: 10%" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                       <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#5c4632' }}></span>Takeaway</div>
                       <span>10%</span>
                    </div>
                 </div>
              </div>
           </div>

           {/* Meal Type */}
           <div className="card hover-card" title="Revenue distribution by meal period">
              <div style={{ fontSize: 15, fontWeight: 700, color: '#111827', marginBottom: 20 }}>Meal Type</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                 <div className="hover-chart" style={{ width: 100, height: 100, borderRadius: '50%', background: 'conic-gradient(#e58b12 0% 40%, #c17d12 40% 65%, #3c9b6a 65% 95%, #5c4632 95% 100%)' }}></div>
                 <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10, fontSize: 12, fontWeight: 600 }}>
                    <div className="hover-item" title="Dinner Services: 40%" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                       <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#e58b12' }}></span>Dinner</div>
                       <span>40%</span>
                    </div>
                    <div className="hover-item" title="Lunch Services: 25%" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                       <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#c17d12' }}></span>Lunch</div>
                       <span>25%</span>
                    </div>
                    <div className="hover-item" title="Breakfast Services: 30%" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                       <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#3c9b6a' }}></span>Breakfast</div>
                       <span>30%</span>
                    </div>
                    <div className="hover-item" title="Snacks/Other: 5%" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                       <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#5c4632' }}></span>Snacks</div>
                       <span>5%</span>
                    </div>
                 </div>
              </div>
           </div>

           {/* Profit Calculator / AI Insight */}
           <div className="card hover-card" style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#111827', marginBottom: 12 }}>Profit Calculator</div>
              <p style={{ fontSize: 11, color: '#6b7280', margin: '0 0 16px 0', lineHeight: 1.4 }}>Calculate the estimated profit of any menu item by selecting duration.</p>
              
              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                 <select style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 12 }}>
                   <option>Paneer Tikka</option>
                   <option>Butter Chicken</option>
                 </select>
                 <select style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 12 }}>
                   <option>Next Week</option>
                 </select>
              </div>

              <div style={{ marginTop: 'auto' }}>
                 <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>Estimated Profit</div>
                 <div style={{ fontSize: 24, fontWeight: 800, color: '#111827' }}>₹ 30,000</div>
                 <div style={{ fontSize: 11, color: '#10b981', fontWeight: 600, marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                   <span style={{ background: '#10b981', color: '#fff', borderRadius: '50%', width: 14, height: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10 }}>%</span>
                   Apply 10% discount → Profit ₹ 25,000
                 </div>
              </div>
           </div>
        </div>

        {/* Bottom Menu Insights Row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
           {/* Liked / Hot Dishes */}
           <div className="card hover-card" title="Top performing dishes">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                 <div style={{ fontSize: 16, fontWeight: 700, color: '#111827' }}>Liked Dishes (Hot)</div>
                 <div style={{ fontSize: 12, color: '#3b82f6', fontWeight: 600, cursor: 'pointer' }}>View All</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
                 {topItems.slice(0, 4).map((item, i) => (
                   <div key={item.id} className="hover-item" title={`${item.name} is up by ${80 - i * 10}% this week`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                      <div style={{ width: 64, height: 64, borderRadius: 12, background: `hsl(${i * 45 + 10}, 80%, 90%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, marginBottom: 8 }}>
                         {['🍲', '🍗', '🥘', '🍛'][i % 4]}
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', lineHeight: 1.2, marginBottom: 4 }}>{item.name}</div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#10b981' }}>{80 - i * 10}% ↑</div>
                   </div>
                 ))}
              </div>
           </div>

           {/* Disliked / Slow Dishes */}
           <div className="card hover-card" title="Underperforming dishes">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                 <div style={{ fontSize: 16, fontWeight: 700, color: '#111827' }}>Dis-liked Dishes (Slow)</div>
                 <div style={{ fontSize: 12, color: '#3b82f6', fontWeight: 600, cursor: 'pointer' }}>View All</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
                 {topItems.slice(-4).reverse().map((item, i) => (
                   <div key={item.id} className="hover-item" title={`${item.name} is down by ${40 + i * 10}% this week`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                      <div style={{ width: 64, height: 64, borderRadius: 12, background: `hsl(${i * 60 + 200}, 40%, 90%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, marginBottom: 8 }}>
                         {['🥗', '🥪', '🍜', '🍱'][i % 4]}
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', lineHeight: 1.2, marginBottom: 4 }}>{item.name}</div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#ef4444' }}>{40 + i * 10}% ↓</div>
                   </div>
                 ))}
              </div>
           </div>
        </div>
        </div>
      </div>

      <ToastContainer toasts={toasts} onDismiss={(id) => setToasts((prev) => prev.filter((toast) => toast.id !== id))} />
    </div>
  );
}

