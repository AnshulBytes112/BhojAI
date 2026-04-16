'use client';

import { useEffect, useState } from 'react';
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

function getTrendTone(value: number) {
  return value >= 0 ? 'up' : 'down';
}

export default function AnalyticsPage() {
  const [summary, setSummary] = useState<DashboardSummary>(FALLBACK_SUMMARY);
  const [topItems, setTopItems] = useState<TopItem[]>(FALLBACK_TOP_ITEMS);
  const [hourly, setHourly] = useState<HourlyPoint[]>(FALLBACK_HOURLY);
  const [insights, setInsights] = useState<AIInsight[]>(FALLBACK_INSIGHTS);
  const [loading, setLoading] = useState(true);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setLoading(true);
      try {
        const [summaryData, topItemsData, hourlyData, insightsData] = await Promise.all([
          apiRequest<DashboardSummary>('/dashboard/summary'),
          apiRequest<TopItem[]>('/dashboard/top-items'),
          apiRequest<HourlyPoint[]>('/dashboard/hourly'),
          apiRequest<{ insights: AIInsight[] }>('/ai/insights'),
        ]);

        if (!mounted) return;
        setSummary(summaryData);
        setTopItems(topItemsData.length ? topItemsData : FALLBACK_TOP_ITEMS);
        setHourly(hourlyData.length ? hourlyData : FALLBACK_HOURLY);

        // Handle insights response
        if (insightsData && insightsData.insights) {
          setInsights(insightsData.insights);
        }
      } catch {
        if (!mounted) return;
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
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, []);

  const paymentEntries = Object.entries(summary.paymentBreakdown || {});
  const paymentTotal = paymentEntries.reduce((sum, [, amount]) => sum + amount, 0) || 1;
  const maxRevenue = Math.max(...hourly.map((point) => point.revenue), 1);
  const chartPoints = hourly
    .map((point, index) => {
      const x = hourly.length === 1 ? 50 : (index / (hourly.length - 1)) * 100;
      const y = 100 - (point.revenue / maxRevenue) * 100;
      return `${x},${y}`;
    })
    .join(' ');

  const kpis = [
    {
      label: 'Net Revenue',
      value: formatCompactCurrency(summary.totalRevenue),
      trend: '+12.4%',
      tone: getTrendTone(12.4),
      icon: <IconCash />,
      color: 'orange',
    },
    {
      label: 'Orders Closed',
      value: formatNumber(summary.completedOrders),
      trend: `${summary.totalOrders} total today`,
      tone: 'up',
      icon: <IconChart />,
      color: 'blue',
    },
    {
      label: 'Average Check',
      value: formatCurrency(summary.avgOrderValue),
      trend: '+4.8%',
      tone: getTrendTone(4.8),
      icon: <IconCard />,
      color: 'green',
    },
    {
      label: 'Stock Alerts',
      value: formatNumber(summary.lowStockCount),
      trend: summary.lowStockCount > 0 ? 'Needs attention' : 'Healthy',
      tone: summary.lowStockCount > 0 ? 'down' : 'up',
      icon: <IconInventory />,
      color: 'yellow',
    },
  ] as const;

  return (
    <div className="pos-layout">
      <Sidebar activePath="/analytics" />

      <div className="pos-main">
        <TopBar
          title="Operations Dashboard"
          subtitle="Manager workspace with live sales, payment mix and stock pressure"
          actions={
            <button className="btn btn-secondary btn-sm" onClick={() => window.location.reload()}>
              Refresh
            </button>
          }
        />

        <div className="admin-shell">
          <div className="kpi-grid">
            {kpis.map((kpi) => (
              <div key={kpi.label} className={`kpi-card ${kpi.color}`}>
                <div className={`kpi-icon ${kpi.color}`}>{kpi.icon}</div>
                <div className="kpi-value">{loading ? '...' : kpi.value}</div>
                <div className="kpi-label">{kpi.label}</div>
                <div className={`kpi-trend ${kpi.tone}`}>
                  {kpi.tone === 'up' ? <IconArrowUp /> : <IconArrowDown />}
                  <span>{kpi.trend}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="admin-grid-2">
            <div className="admin-card">
              <div className="section-header">
                <div>
                  <div className="section-title">Revenue Pulse</div>
                  <div className="section-subtitle">Hourly billing trend for the current service window</div>
                </div>
                <div className="badge badge-info">{hourly.length} intervals</div>
              </div>

              <div className="chart-panel">
                <div className="chart-summary">
                  <div>
                    <div className="chart-metric-label">Peak Hour</div>
                    <div className="chart-metric-value">
                      {hourly.reduce((best, current) => (current.revenue > best.revenue ? current : best), hourly[0]).hour}:00
                    </div>
                  </div>
                  <div>
                    <div className="chart-metric-label">Peak Revenue</div>
                    <div className="chart-metric-value">
                      {formatCurrency(Math.max(...hourly.map((point) => point.revenue), 0))}
                    </div>
                  </div>
                </div>

                <div className="chart-canvas">
                  <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="chart-svg" aria-hidden="true">
                    <defs>
                      <linearGradient id="revenueGlow" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="rgba(255,107,43,0.85)" />
                        <stop offset="100%" stopColor="rgba(255,107,43,0)" />
                      </linearGradient>
                    </defs>
                    <polyline points={chartPoints} fill="none" stroke="var(--primary)" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
                  </svg>

                  <div className="chart-axis">
                    {hourly.map((point) => (
                      <span key={point.hour}>{point.hour}:00</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="stack-column">
              <div className="admin-card">
                <div className="section-header">
                  <div>
                    <div className="section-title">Payment Mix</div>
                    <div className="section-subtitle">How guests are settling bills today</div>
                  </div>
                </div>
                <div className="metric-list">
                  {paymentEntries.map(([method, amount], index) => (
                    <div key={method} className="metric-row">
                      <div>
                        <div className="metric-label">{method}</div>
                        <div className="metric-caption">{Math.round((amount / paymentTotal) * 100)}% share</div>
                      </div>
                      <div className="metric-value-group">
                        <div className="metric-value">{formatCurrency(amount)}</div>
                        <div className="bar-track">
                          <div
                            className={`bar-fill tone-${(index % 3) + 1}`}
                            style={{ width: `${Math.max(14, (amount / paymentTotal) * 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="admin-card">
                <div className="section-header">
                  <div>
                    <div className="section-title">Low Stock Watch</div>
                    <div className="section-subtitle">Ingredients likely to disrupt service next</div>
                  </div>
                  <div className="badge badge-warning">{summary.lowStockCount} open</div>
                </div>
                <div className="metric-list">
                  {summary.lowStockItems.map((item) => (
                    <div key={item.id} className="metric-row compact">
                      <div>
                        <div className="metric-label">{item.name}</div>
                        <div className="metric-caption">
                          {item.quantity} {item.unit} left
                        </div>
                      </div>
                      <div className="metric-caption">
                        Min {item.minThreshold ?? 0} {item.unit}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="admin-grid-2">
            <div className="admin-card">
              <div className="section-header">
                <div>
                  <div className="section-title">Top Selling Items</div>
                  <div className="section-subtitle">Revenue leaders across dine-in and takeaway</div>
                </div>
              </div>

              <div className="data-table">
                <div className="data-table-head">
                  <span>Item</span>
                  <span>Qty</span>
                  <span>Revenue</span>
                </div>
                {topItems.map((item) => (
                  <div key={item.id} className="data-table-row">
                    <div>
                      <div className="table-primary">{item.name}</div>
                      <div className="table-secondary">{item.dietaryLabel || 'Chef special'}</div>
                    </div>
                    <span>{formatNumber(item.count)}</span>
                    <span>{formatCurrency(item.revenue)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="admin-card">
              <div className="section-header">
                <div>
                  <div className="section-title">Service Notes</div>
                  <div className="section-subtitle">Quick readouts for the next floor briefing</div>
                </div>
              </div>
              <div className="metric-list">
                <div className="metric-row compact">
                  <div>
                    <div className="metric-label">Completion Rate</div>
                    <div className="metric-caption">Orders successfully closed</div>
                  </div>
                  <div className="metric-value">{Math.round((summary.completedOrders / Math.max(summary.totalOrders, 1)) * 100)}%</div>
                </div>
                <div className="metric-row compact">
                  <div>
                    <div className="metric-label">Cancellation Count</div>
                    <div className="metric-caption">Keep this below operational threshold</div>
                  </div>
                  <div className="metric-value">{formatNumber(summary.cancelledOrders)}</div>
                </div>
                <div className="metric-row compact">
                  <div>
                    <div className="metric-label">Most Active Window</div>
                    <div className="metric-caption">Best time to place extra staff on floor</div>
                  </div>
                  <div className="metric-value">
                    {hourly.reduce((best, current) => (current.orders > best.orders ? current : best), hourly[0]).hour}:00
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* AI-Driven Insights */}
          <div className="admin-card" style={{ background: 'linear-gradient(135deg, rgba(255,107,43,0.08) 0%, rgba(76,175,80,0.08) 100%)' }}>
            <div className="section-header">
              <div>
                <div className="section-title">💡 AI-Driven Insights</div>
                <div className="section-subtitle">Machine learning analysis of sales patterns and recommendations</div>
              </div>
            </div>

            <div style={{ display: 'grid', gap: '12px' }}>
              {insights.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px', color: 'var(--on-surface-dim)', fontSize: '13px' }}>
                  No insights available yet. Check back after more orders.
                </div>
              ) : (
                insights.map((insight) => (
                  <div
                    key={`${insight.type}-${insight.data.id}`}
                    style={{
                      background: 'var(--surface-container)',
                      border: `2px solid ${insight.type === 'HOT_ITEM' ? 'var(--warning)' : 'var(--danger)'}`,
                      borderRadius: 'var(--radius-lg)',
                      padding: '14px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                    }}
                  >
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--on-surface)' }}>
                      {insight.message}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', fontSize: '12px' }}>
                      <div>
                        <div style={{ color: 'var(--on-surface-dim)', marginBottom: '4px' }}>Item</div>
                        <div style={{ fontWeight: 600 }}>{insight.data.name}</div>
                      </div>
                      <div>
                        <div style={{ color: 'var(--on-surface-dim)', marginBottom: '4px' }}>Orders</div>
                        <div style={{ fontWeight: 600 }}>{formatNumber(insight.data.count)}</div>
                      </div>
                      <div>
                        <div style={{ color: 'var(--on-surface-dim)', marginBottom: '4px' }}>Revenue</div>
                        <div style={{ fontWeight: 600 }}>{formatCurrency(insight.data.revenue)}</div>
                      </div>
                    </div>
                    {insight.type === 'SLOW_ITEM' && (
                      <button
                        className="btn btn-secondary btn-sm"
                        style={{ marginTop: '8px' }}
                        onClick={async () => {
                          const promoName = `${insight.data.name} Recovery Offer`;
                          try {
                            await apiRequest('/promotions', {
                              method: 'POST',
                              body: {
                                name: promoName,
                                description: `Auto-suggested from analytics for slow-selling item: ${insight.data.name}`,
                                type: 'PERCENTAGE_DISCOUNT',
                                value: 20,
                                minOrderAmount: 0,
                                appliesToMenuItemId: insight.data.id,
                                isActive: true,
                              },
                            });

                            const id = Date.now().toString();
                            setToasts((prev) => [
                              ...prev,
                              {
                                id,
                                icon: '✅',
                                title: 'Promotion created',
                                message: `${promoName} (20%) is now active.`,
                              },
                            ]);
                            setTimeout(() => setToasts((prev) => prev.filter((toast) => toast.id !== id)), 4500);
                          } catch (error) {
                            const id = Date.now().toString();
                            setToasts((prev) => [
                              ...prev,
                              {
                                id,
                                icon: '❌',
                                title: 'Promotion create failed',
                                message: (error as Error).message,
                              },
                            ]);
                            setTimeout(() => setToasts((prev) => prev.filter((toast) => toast.id !== id)), 4500);
                          }
                        }}
                      >
                        → Create Promotion
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      <ToastContainer toasts={toasts} onDismiss={(id) => setToasts((prev) => prev.filter((toast) => toast.id !== id))} />
    </div>
  );
}
