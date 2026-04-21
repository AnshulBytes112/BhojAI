'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';
import { Sidebar, ToastContainer, type ToastItem } from '../../components/shared';
import { API_BASE } from '../../lib/api';

const API = API_BASE;

const PAGE_SIZE = 15;

interface ReservationItem {
  id: string;
  resNumber: string;
  customerName: string;
  phone: string;
  dateStr: string;
  timeRange: string;
  tableNumber: string;
  partySize: number;
  status: 'Upcoming' | 'Checked In' | 'Completed' | 'Cancelled';
  notes: string;
  isPaid: boolean;
  scheduledAt?: string;
  diningArea?: string;
}

export default function ReservationsPage() {
  const router = useRouter();
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [allReservations, setAllReservations] = useState<ReservationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [selectedRes, setSelectedRes] = useState<ReservationItem | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creatingReservation, setCreatingReservation] = useState(false);
  const [newReservation, setNewReservation] = useState({
    customerName: '',
    phone: '',
    partySize: '2',
    notes: '',
    date: new Date().toISOString().split('T')[0],
    time: '19:00',
    diningArea: 'Indoor',
  });

  const addToast = (t: Omit<ToastItem, 'id'>) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setToasts(p => [...p, { ...t, id }]);
    setTimeout(() => setToasts(p => p.filter(x => x.id !== id)), 4000);
  };

  const fetchReservations = async () => {
    setLoading(true);
    try {
      const token = sessionStorage.getItem('auth.token') || '';
      // Try to fetch real orders that might act as reservations
      const res = await fetch(`${API_BASE}/orders`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      const data = await res.json().catch(() => []);
      const allOrders = Array.isArray(data) ? data : [];
      // If backend supports reservation type, filter them out. If none exist, we'll fall back to demo data.
      const realReservations = allOrders.filter(o => o.type === 'RESERVATION' || o.type === 'PRE_ORDER').map((o, i) => ({
        id: o.id,
        resNumber: `#R-${1226 + i}`,
        customerName: o.customerName || 'Walk-In Guest',
        phone: o.customerPhone || `+91 98${Math.floor(10000000 + Math.random() * 90000000)}`,
        dateStr: new Date(o.createdAt).toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' }),
        timeRange: new Date(o.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
        tableNumber: o.table?.label || 'Unassigned',
        partySize: o.partySize || 2,
        status: (o.status === 'COMPLETED' ? 'Completed' : o.status === 'CANCELLED' ? 'Cancelled' : 'Upcoming') as ReservationItem['status'],
        notes: o.notes || '',
        isPaid: o.paymentStatus === 'PAID',
        scheduledAt: o.scheduledAt,
        diningArea: o.diningArea,
      }));


      if (realReservations.length > 0) {
        setAllReservations(realReservations);
        setSelectedRes(realReservations[0]);
        setLoading(false);
        return;
      }
    } catch (e) {
      console.warn('API error, falling back to demo data', e);
    }

    // Fallback Demo Data
    setTimeout(() => {
      const demo: ReservationItem[] = Array.from({ length: 120 }, (_, i) => {
        let status: 'Upcoming' | 'Checked In' | 'Completed' | 'Cancelled' = 'Upcoming';
        if (i === 1 || i === 2 || i === 3) status = 'Checked In';
        else if (i === 4) status = 'Completed';
        else if (i === 5) status = 'Cancelled';
        else status = ['Upcoming', 'Upcoming', 'Checked In', 'Completed', 'Cancelled'][i % 5] as any;

        const randomPhone = `+91 98${Math.floor(10000000 + Math.random() * 90000000)}`;

        return {
          id: `res-${i + 1}`,
          resNumber: `#R-${1226 + i}`,
          customerName: ['Habiba Falcon', 'Mohit Khurana', 'Rakesh Sharma', 'Akash Patel', 'Jyoti Verma', 'Ayaan Shah'][i % 6],
          phone: [randomPhone, randomPhone, '+91 91234 56789', '+91 98765 43210', '+91 99887 76655'][i % 5],
          dateStr: 'Mon, Apr 20',
          timeRange: ['7:00 pm - 9:00 pm', '7:30 pm - 9:00 pm', '7:50 pm - 9:00 pm'][i % 3],
          tableNumber: `Table T${(i % 5) + 1}`,
          partySize: (i % 6) + 2,
          status,
          notes: 'Can be reservation $',
          isPaid: i % 2 === 0,
          diningArea: ['Indoor', 'Outdoor', 'Private Room', 'Rooftop'][i % 4],
          scheduledAt: new Date(Date.now() + 86400000 * (i % 7)).toISOString(),
        };
      });
      setAllReservations(demo);
      setSelectedRes(demo[0]);
      setLoading(false);
    }, 400);
  };

  useEffect(() => { fetchReservations(); }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return allReservations.filter(r => {
      return !q || r.customerName.toLowerCase().includes(q) || r.phone.includes(q) || r.resNumber.toLowerCase().includes(q);
    });
  }, [allReservations, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  useEffect(() => setPage(1), [search]);

  const exportExcel = () => {
    const rows = filtered.map(r => ({
      'NAME': r.customerName,
      'RES #': r.resNumber,
      'DATE': r.dateStr,
      'TIME': r.timeRange,
      'AREA': r.diningArea || 'N/A',
      'PARTY SIZE': r.partySize,
      'STATUS': r.status,
      'PHONE': r.phone,
    }));
    
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Reservations');
    XLSX.writeFile(workbook, `reservations-${new Date().toISOString().slice(0, 10)}.xlsx`);
    addToast({ icon: '📊', title: 'Excel exported', message: `${filtered.length} reservations exported.` });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Upcoming': return { bg: '#fed7aa', color: '#ea580c' }; // Orange
      case 'Checked In': return { bg: '#dcfce7', color: '#166534' }; // Green
      case 'Completed': return { bg: '#e5e7eb', color: '#4b5563' }; // Gray
      case 'Cancelled': return { bg: '#fecaca', color: '#991b1b' }; // Red
      default: return { bg: '#eee', color: '#333' };
    }
  };

  const handleCheckIn = () => {
    if (!selectedRes) return;
    const updated = { ...selectedRes, status: 'Checked In' as const };
    setSelectedRes(updated);
    setAllReservations(prev => prev.map(r => r.id === updated.id ? updated : r));
    addToast({ icon: '✅', title: 'Checked In', message: `${selectedRes.customerName} has been checked in.` });
  };

  const handleCancel = () => {
    if (!selectedRes) return;
    const updated = { ...selectedRes, status: 'Cancelled' as const };
    setSelectedRes(updated);
    setAllReservations(prev => prev.map(r => r.id === updated.id ? updated : r));
    addToast({ icon: '❌', title: 'Cancelled', message: 'Reservation cancelled.' });
  };

  const handleMoreOptions = () => {
    if (!selectedRes) return;
    // Just as an example, marking as Completed
    const updated = { ...selectedRes, status: 'Completed' as const };
    setSelectedRes(updated);
    setAllReservations(prev => prev.map(r => r.id === updated.id ? updated : r));
    addToast({ icon: '⚙️', title: 'Completed', message: 'Reservation marked as completed.' });
  };

  const createReservation = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!newReservation.customerName.trim()) {
      addToast({ icon: '⚠️', title: 'Missing name', message: 'Customer name is required.' });
      return;
    }

    setCreatingReservation(true);
    try {
      const token = localStorage.getItem('auth.token') || '';
      const res = await fetch(`${API}/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          type: 'RESERVATION',
          customerName: newReservation.customerName.trim(),
          customerPhone: newReservation.phone.trim() || undefined,
          guestCount: Math.max(1, Number(newReservation.partySize || 2)),
          notes: newReservation.notes.trim() || undefined,
          scheduledAt: `${newReservation.date}T${newReservation.time}:00Z`,
          diningArea: newReservation.diningArea,
          items: [],
        }),
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload?.error || `Failed to create reservation (${res.status})`);
      }

      setShowCreateModal(false);
      setNewReservation({ 
        customerName: '', phone: '', partySize: '2', notes: '', 
        date: new Date().toISOString().split('T')[0], 
        time: '19:00', 
        diningArea: 'Indoor' 
      });
      await fetchReservations();
      addToast({ icon: '✅', title: 'Reservation created', message: `${payload?.customerName || 'Reservation'} saved successfully.` });
    } catch (error) {
      addToast({ icon: '❌', title: 'Create failed', message: (error as Error).message });
    } finally {
      setCreatingReservation(false);
    }
  };

  return (
    <div className="pos-layout" style={{ background: '#f6f4f1' }}>
      <Sidebar activePath="/pos/reservations" />

      <div className="pos-main" style={{ padding: 0, display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', background: '#f5f4ef' }}>

        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', height: '100%' }}>
          
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1a1a1a', margin: '0 0 4px 0' }}>Reservations</h1>
              <div style={{ fontSize: 13, color: '#666' }}>View, manage, and track table reservations</div>
            </div>
            
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={exportExcel} style={ghostBtn} onMouseEnter={e => e.currentTarget.style.background='#f0f0f0'} onMouseLeave={e => e.currentTarget.style.background='#fff'} onMouseDown={e => e.currentTarget.style.transform='scale(0.96)'} onMouseUp={e => e.currentTarget.style.transform='scale(1)'}>📥 Export CSV</button>
              <button onClick={fetchReservations} style={ghostBtn} onMouseEnter={e => e.currentTarget.style.background='#f0f0f0'} onMouseLeave={e => e.currentTarget.style.background='#fff'} onMouseDown={e => e.currentTarget.style.transform='scale(0.96)'} onMouseUp={e => e.currentTarget.style.transform='scale(1)'}>↻ Refresh</button>
              <button onClick={() => router.push('/pos/order')} style={ghostBtn} onMouseEnter={e => e.currentTarget.style.background='#f0f0f0'} onMouseLeave={e => e.currentTarget.style.background='#fff'} onMouseDown={e => e.currentTarget.style.transform='scale(0.96)'} onMouseUp={e => e.currentTarget.style.transform='scale(1)'}>🔙 Back to Orders</button>
              <button onClick={() => setShowCreateModal(true)} style={primaryBtn} onMouseEnter={e => e.currentTarget.style.background='#c2410c'} onMouseLeave={e => e.currentTarget.style.background='#ea580c'} onMouseDown={e => e.currentTarget.style.transform='scale(0.96)'} onMouseUp={e => e.currentTarget.style.transform='scale(1)'}>+ New Reservation</button>
            </div>
          </div>

          {/* Body Flex container */}
          <div style={{ display: 'flex', flex: 1, overflow: 'hidden', gap: '20px' }}>

            {/* Left Panel */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#fbfbf8', borderRadius: 12, border: '1px solid #eae7e0' }}>

              {/* Toolbar */}
              <div style={{ padding: '16px 20px', borderBottom: '1px solid #eae7e0', display: 'flex', flexDirection: 'column', gap: 16 }}>
                
                {/* Search & Date */}
                <div style={{ display: 'flex', gap: 12 }}>
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: '1px solid #eae7e0', borderRadius: 8, padding: '0 12px', height: 42 }}>
                    <span style={{ color: '#aaa', fontSize: 14 }}>🔍</span>
                    <input
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      placeholder="Search guest or phone #"
                      style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: 13, color: '#333', width: '100%' }}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: '1px solid #eae7e0', borderRadius: 8, padding: '0 16px', height: 42, color: '#333', fontSize: 13, cursor: 'pointer' }}>
                    📅 Mon, 20 Apr, 2026
                  </div>
                </div>

                {/* Filter chips */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <button style={{...filterChip, background: '#ea580c', color: '#fff', border: 'none'}}>Upcoming 4</button>
                  <button style={filterChip}>Checked In 2</button>
                  <button style={filterChip}>Completed 2</button>
                  <button style={filterChip}>Cancelled 1</button>
                  
                  <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ fontSize: 13, color: '#333', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                      Mon, 20 Apr, 2026 <span>▼</span>
                    </div>
                    <div style={{ display: 'flex', border: '1px solid #eae7e0', borderRadius: 6, overflow: 'hidden' }}>
                      <button style={{ padding: '4px 8px', background: '#fff', border: 'none', borderRight: '1px solid #eae7e0', cursor: 'pointer' }}>{'<'}</button>
                      <button style={{ padding: '4px 8px', background: '#fff', border: 'none', cursor: 'pointer' }}>{'>'}</button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Table Header */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr 1.5fr 1.5fr 0.5fr', padding: '16px 20px', borderBottom: '1px solid #eae7e0', background: '#f5f4ef' }}>
                {['NAME', 'DATE & TIME', 'PARTY SIZE / STATUS', 'CONTACT / NOTES'].map((h, i) => (
                  <div key={h} style={{ fontSize: 11, fontWeight: 700, color: '#777', letterSpacing: '0.5px' }}>
                    {h} <span style={{ color: '#ccc', fontSize: 10 }}>↕</span>
                  </div>
                ))}
              </div>

              {/* Table Rows */}
              <div style={{ flex: 1, overflowY: 'auto' }}>
                {paged.map((res, idx) => {
                  const isSelected = selectedRes?.id === res.id;
                  const st = getStatusColor(res.status);
                  
                  return (
                    <div
                      key={res.id}
                      onClick={() => setSelectedRes(res)}
                      style={{
                        display: 'grid', gridTemplateColumns: '2fr 1.5fr 1.5fr 1.5fr 0.5fr',
                        padding: '16px 20px', borderBottom: '1px solid #eae7e0',
                        cursor: 'pointer', transition: 'background 0.12s',
                        background: isSelected ? '#f1efe9' : 'transparent',
                      }}
                    >
                      {/* Name */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <img src={`https://i.pravatar.cc/100?img=${10 + idx}`} alt="Avatar" style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }} />
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1a' }}>{res.customerName}</div>
                          <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{res.resNumber}</div>
                        </div>
                      </div>

                      {/* Date & Time */}
                      <div style={{ alignSelf: 'center' }}>
                        <div style={{ fontSize: 13, color: '#333' }}>
                          {res.scheduledAt ? new Date(res.scheduledAt).toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' }) : res.dateStr}
                        </div>
                        <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
                          {res.scheduledAt ? new Date(res.scheduledAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : res.timeRange}
                        </div>
                      </div>

                      {/* Status */}
                      <div style={{ alignSelf: 'center', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{
                          padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                          background: st.bg, color: st.color,
                        }}>
                          {res.status}
                        </span>
                        {res.diningArea && (
                          <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 10, fontWeight: 700, background: '#f0f0f0', color: '#666', border: '1px solid #ddd' }}>
                            {res.diningArea.toUpperCase()}
                          </span>
                        )}
                        {res.isPaid && (
                          <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 10, fontWeight: 700, background: '#dcfce7', color: '#166534' }}>
                            PAID
                          </span>
                        )}
                      </div>

                      {/* Contact / Notes */}
                      <div style={{ alignSelf: 'center' }}>
                        <div style={{ fontSize: 13, color: '#333' }}>{res.phone}</div>
                        <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{res.notes}</div>
                      </div>

                      {/* Arrow */}
                      <div style={{ alignSelf: 'center', textAlign: 'right', color: '#ccc' }}>
                        &gt;
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Pagination */}
              <div style={{ padding: '12px 20px', background: '#f5f4ef', borderTop: '1px solid #eae7e0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                <div style={{ fontSize: 13, color: '#666' }}>Showing <strong>{paged.length}</strong> of <strong>{filtered.length}</strong> reservations</div>
                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={safePage <= 1} style={{...paginBtn, border: 'none', background: 'transparent'}}>Previous</button>
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map(p => (
                    <button key={p} onClick={() => setPage(p)} style={{
                      ...paginBtn,
                      background: safePage === p ? '#fff' : 'transparent',
                      color: safePage === p ? '#1a1a1a' : '#666',
                      fontWeight: safePage === p ? 600 : 400,
                      border: safePage === p ? '1px solid #ddd' : '1px solid transparent',
                    }}>{p}</button>
                  ))}
                  <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={safePage >= totalPages} style={{...paginBtn, border: 'none', background: 'transparent'}}>Next &gt;</button>
                </div>
              </div>
            </div>

            {/* Right Panel */}
            {selectedRes && (
              <div style={{ width: 340, background: '#fff', borderRadius: 12, border: '1px solid #eae7e0', display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: 0, boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
                <div style={{ padding: '24px 20px', display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto' }}>
                  
                  {/* Header (Avatar + Name) */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
                    <div style={{ display: 'flex', gap: 12 }}>
                      <img src={`https://i.pravatar.cc/100?img=${10 + paged.findIndex(r => r.id === selectedRes.id)}`} alt="Avatar" style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover' }} />
                      <div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: '#1a1a1a' }}>{selectedRes.customerName}</div>
                        <div style={{ fontSize: 13, color: '#ea580c', marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ea580c', display: 'inline-block' }} />
                          {selectedRes.status}
                        </div>
                      </div>
                    </div>
                    <div style={{ fontSize: 13, color: '#888' }}>{selectedRes.resNumber}</div>
                  </div>

                  <div style={{ height: 1, background: '#f0ede8', margin: '0 -20px 20px' }} />

                  {/* Info Box */}
                  <div style={{ background: '#fcfbf9', border: '1px solid #f0ede8', borderRadius: 12, padding: '16px', marginBottom: 20 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                      <div>
                        <div style={{ fontSize: 13, color: '#666', marginBottom: 4 }}>
                          {selectedRes.scheduledAt ? new Date(selectedRes.scheduledAt).toLocaleDateString('en-IN', { weekday: 'long', month: 'short', day: 'numeric' }) : selectedRes.dateStr}
                        </div>
                        <div style={{ fontSize: 13, color: '#666' }}>
                          {selectedRes.scheduledAt ? new Date(selectedRes.scheduledAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : selectedRes.timeRange}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 13, color: '#1a1a1a', fontWeight: 700 }}>{selectedRes.tableNumber}</div>
                        <div style={{ fontSize: 11, color: '#ea580c', fontWeight: 600, marginTop: 2 }}>{selectedRes.diningArea}</div>
                      </div>
                    </div>
                    <div style={{ fontSize: 13, color: '#666', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>👤</span> {selectedRes.partySize} Adults
                    </div>
                  </div>

                  {/* Contact Box */}
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a', marginBottom: 12 }}>Contact</div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid #eae7e0', borderRadius: 8, padding: '12px 16px' }}>
                      <div style={{ fontSize: 14, color: '#333' }}>{selectedRes.phone}</div>
                      <div style={{ color: '#ccc' }}>&gt;</div>
                    </div>
                  </div>

                  {/* Arriving Info Box */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, border: '1px solid #eae7e0', borderRadius: 8, padding: '12px 16px', marginBottom: 24 }}>
                    <span>📍</span>
                    <div style={{ fontSize: 13, color: '#333' }}>Arriving within 5 Mins</div>
                  </div>

                  {/* Actions */}
                  <button onClick={handleCheckIn} style={{ background: '#348356', color: '#fff', border: 'none', padding: '14px', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer', marginBottom: 12, transition: 'all 0.1s' }} onMouseEnter={e => e.currentTarget.style.background='#22603c'} onMouseLeave={e => e.currentTarget.style.background='#348356'} onMouseDown={e => e.currentTarget.style.transform='scale(0.98)'} onMouseUp={e => e.currentTarget.style.transform='scale(1)'}>
                    Check In
                  </button>
                  <button onClick={handleCancel} style={{ background: '#fff9f9', color: '#ea580c', border: '1px solid #fcdada', padding: '14px', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer', marginBottom: 16, transition: 'all 0.1s' }} onMouseEnter={e => e.currentTarget.style.background='#ffebeb'} onMouseLeave={e => e.currentTarget.style.background='#fff9f9'} onMouseDown={e => e.currentTarget.style.transform='scale(0.98)'} onMouseUp={e => e.currentTarget.style.transform='scale(1)'}>
                    Cancel Reservation
                  </button>
                  <div onClick={handleMoreOptions} style={{ textAlign: 'center', fontSize: 13, color: '#666', cursor: 'pointer', marginBottom: 24, transition: 'color 0.1s' }} onMouseEnter={e => e.currentTarget.style.color='#111'} onMouseLeave={e => e.currentTarget.style.color='#666'}>
                    More Options ▼
                  </div>

                  {/* Notes Box */}
                  <div style={{ background: '#fcfbf9', border: '1px solid #f0ede8', borderRadius: 8, padding: '16px', marginBottom: 24 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ color: '#ea580c' }}>📋</span> Notes
                      </div>
                      <span style={{ color: '#ccc' }}>&gt;</span>
                    </div>
                    <div style={{ fontSize: 13, color: '#666' }}>{selectedRes.notes || 'Arriving within 5 Mins.'}</div>
                  </div>

                  {/* Bottom Buttons */}
                  <div style={{ display: 'flex', gap: 12, marginTop: 'auto' }}>
                    <button onClick={exportExcel} style={{ flex: 1, background: 'transparent', border: '1px solid #eae7e0', color: '#333', padding: '12px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.1s' }} onMouseEnter={e => e.currentTarget.style.background='#f0f0f0'} onMouseLeave={e => e.currentTarget.style.background='transparent'} onMouseDown={e => e.currentTarget.style.transform='scale(0.96)'} onMouseUp={e => e.currentTarget.style.transform='scale(1)'}>
                      Export CSV
                    </button>
                    <button onClick={exportExcel} style={{ flex: 1, background: '#ea580c', color: '#fff', border: 'none', padding: '12px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.1s' }} onMouseEnter={e => e.currentTarget.style.background='#c2410c'} onMouseLeave={e => e.currentTarget.style.background='#ea580c'} onMouseDown={e => e.currentTarget.style.transform='scale(0.96)'} onMouseUp={e => e.currentTarget.style.transform='scale(1)'}>
                      Export CSV
                    </button>
                  </div>
                  
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {showCreateModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1200,
            padding: 16,
          }}
        >
          <form onSubmit={createReservation} style={{ width: '100%', maxWidth: 480, background: '#fff', borderRadius: 14, border: '1px solid #eae7e0', boxShadow: '0 12px 40px rgba(0,0,0,0.2)', overflow: 'hidden' }}>
            <div style={{ padding: '18px 20px', borderBottom: '1px solid #eee', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#1a1a1a' }}>Create Reservation</h3>
              <button type="button" onClick={() => setShowCreateModal(false)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 20, color: '#666' }}>×</button>
            </div>

            <div style={{ padding: 20, display: 'grid', gap: 12 }}>
              <input
                value={newReservation.customerName}
                onChange={(e) => setNewReservation((prev) => ({ ...prev, customerName: e.target.value }))}
                placeholder="Customer name"
                style={{ height: 42, border: '1px solid #ddd', borderRadius: 8, padding: '0 12px', fontSize: 14, outline: 'none' }}
                required
              />
              <input
                value={newReservation.phone}
                onChange={(e) => setNewReservation((prev) => ({ ...prev, phone: e.target.value }))}
                placeholder="Phone number"
                style={{ height: 42, border: '1px solid #ddd', borderRadius: 8, padding: '0 12px', fontSize: 14, outline: 'none' }}
              />
              <input
                value={newReservation.partySize}
                onChange={(e) => setNewReservation((prev) => ({ ...prev, partySize: e.target.value }))}
                type="number"
                min={1}
                placeholder="Party size"
                style={{ height: 42, border: '1px solid #ddd', borderRadius: 8, padding: '0 12px', fontSize: 14, outline: 'none' }}
              />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#666' }}>Reservation Date</label>
                  <input
                    type="date"
                    value={newReservation.date}
                    onChange={(e) => setNewReservation((prev) => ({ ...prev, date: e.target.value }))}
                    style={{ height: 42, border: '1px solid #ddd', borderRadius: 8, padding: '0 12px', fontSize: 14, outline: 'none' }}
                    required
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#666' }}>Time</label>
                  <input
                    type="time"
                    value={newReservation.time}
                    onChange={(e) => setNewReservation((prev) => ({ ...prev, time: e.target.value }))}
                    style={{ height: 42, border: '1px solid #ddd', borderRadius: 8, padding: '0 12px', fontSize: 14, outline: 'none' }}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#666' }}>Dining Area / Type</label>
                <select
                  value={newReservation.diningArea}
                  onChange={(e) => setNewReservation((prev) => ({ ...prev, diningArea: e.target.value }))}
                  style={{ height: 42, border: '1px solid #ddd', borderRadius: 8, padding: '0 12px', fontSize: 14, outline: 'none', background: '#fff' }}
                >
                  <option value="Indoor">Indoor Dining</option>
                  <option value="Outdoor">Outdoor Terrace</option>
                  <option value="Private Room">Private Dining Room</option>
                  <option value="Rooftop">Rooftop Seating</option>
                </select>
              </div>

              <textarea
                value={newReservation.notes}
                onChange={(e) => setNewReservation((prev) => ({ ...prev, notes: e.target.value }))}
                placeholder="Special requests (e.g., Anniversary, Allergy)"
                rows={3}
                style={{ border: '1px solid #ddd', borderRadius: 8, padding: 10, fontSize: 14, outline: 'none', resize: 'vertical' }}
              />
            </div>

            <div style={{ padding: 20, borderTop: '1px solid #eee', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button type="button" onClick={() => setShowCreateModal(false)} style={ghostBtn}>Cancel</button>
              <button type="submit" disabled={creatingReservation} style={{ ...primaryBtn, opacity: creatingReservation ? 0.7 : 1, cursor: creatingReservation ? 'not-allowed' : 'pointer' }}>
                {creatingReservation ? 'Creating...' : 'Create Reservation'}
              </button>
            </div>
          </form>
        </div>
      )}

      <ToastContainer toasts={toasts} onDismiss={id => setToasts(p => p.filter(x => x.id !== id))} />
    </div>
  );
}

const ghostBtn: React.CSSProperties = {
  background: '#fff', border: '1px solid #eae7e0', color: '#333',
  padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer'
};

const primaryBtn: React.CSSProperties = {
  background: '#ea580c', color: '#fff', border: 'none',
  padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer'
};

const filterChip: React.CSSProperties = {
  background: '#eae7e0', border: '1px solid transparent', color: '#333',
  padding: '6px 16px', borderRadius: 20, fontSize: 13, cursor: 'pointer'
};

const paginBtn: React.CSSProperties = {
  padding: '6px 12px', borderRadius: 6, color: '#666', cursor: 'pointer', fontSize: 13, transition: 'all 0.15s'
};
