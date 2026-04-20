'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Sidebar } from '../../components/shared';

// Simulated items fallback
const DEMO_ITEMS = [
  { id: '1', name: 'Pepper Barbecue Pizza', addons: 'Less Spicy', qty: 1, amount: 220 },
  { id: '2', name: 'Chicken Fiesta', addons: 'Extra Cheese', qty: 1, amount: 270 },
];

function ReceiptContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderId = searchParams.get('orderId');
  const discountQuery = searchParams.get('discount');
  const discountValue = discountQuery ? parseFloat(discountQuery) : 0;

  const [items, setItems] = useState<any[]>([]);
  const [customerInfo, setCustomerInfo] = useState({ name: 'Walk-in Customer', phone: '+91 98765 43210' });
  const [isGenerated, setIsGenerated] = useState(false);

  useEffect(() => {
    if (!orderId) {
      setItems(DEMO_ITEMS);
      return;
    }
    const token = localStorage.getItem('auth.token') || '';
    const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3333/api';
    fetch(`${API_BASE}/orders/${orderId}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    })
      .then(res => res.json())
      .then(data => {
        if (data && data.items) {
          setItems(data.items.map((i: any) => ({
            id: i.id,
            name: i.menuItem?.name || 'Item',
            addons: i.notes || 'No add ons',
            qty: i.quantity,
            amount: i.price * i.quantity
          })));
          setCustomerInfo({
            name: data.customerName || 'Walk-in Customer',
            phone: data.customerPhone || '+91 98765 43210'
          });
        } else {
          setItems(DEMO_ITEMS);
        }
      })
      .catch(() => setItems(DEMO_ITEMS));
  }, [orderId]);

  const handleQtyChange = (id: string, delta: number) => {
    setItems(prev => prev.map(item => {
      if (item.id === id) {
        const newQty = Math.max(1, item.qty + delta);
        const unitPrice = item.amount / item.qty;
        return { ...item, qty: newQty, amount: unitPrice * newQty };
      }
      return item;
    }));
  };

  const subtotal = items.reduce((sum, item) => sum + item.amount, 0);
  const tax = subtotal * 0.18; // 18% GST
  const serviceCharge = 0;
  const total = subtotal + tax + serviceCharge - discountValue;

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = () => {
    // In a real app we'd use html2pdf, but triggering print dialog allows 'Save as PDF'
    window.print();
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: 'Sales Invoice',
        text: `Invoice #${Math.floor(Math.random() * 1000) + 500} for ₹${total.toFixed(2)}`,
        url: window.location.href,
      }).catch(console.error);
    } else {
      alert('Sharing is not supported on this browser.');
    }
  };

  return (
    <>
    <style dangerouslySetInnerHTML={{__html: `
      @media print {
        body { margin: 0; padding: 0; background: white; }
        .pos-layout > aside, /* Sidebar */
        .pos-layout main > div:first-child, /* Left Panel */
        button {
          display: none !important;
        }
        .pos-layout main {
          padding: 0 !important;
          display: block !important;
          background: white !important;
        }
        #receipt-print-area {
          box-shadow: none !important;
          margin: 0 auto !important;
          width: 80mm !important; /* Standard thermal receipt width */
          padding: 0 !important;
          border: none !important;
        }
        /* Hide faint shadow box */
        #receipt-print-area > div:first-child { display: none !important; }
      }
    `}} />
    <div className="pos-layout" style={{ background: '#f6f4f1' }}>
      <Sidebar activePath="/invoice" />
      
      <main style={{ flex: 1, padding: '32px 40px', overflowY: 'auto', display: 'flex', gap: 40 }}>
        
        {/* Left Panel: Create Sales Invoice */}
        <div style={{ flex: 1, maxWidth: 500, background: 'transparent', padding: '0 32px 32px 0', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button onClick={() => router.back()} style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 20 }}>←</button>
              <h2 style={{ fontSize: 22, fontWeight: 700, color: '#1a1a1a' }}>Create Sales Invoice</h2>
            </div>
            <button onClick={() => router.push('/settings')} style={{ border: '1px solid #eae7e0', background: '#fff', padding: '8px 12px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
              Settings ⚙️
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 24 }}>
            {items.map(item => (
              <div key={item.id} style={{ background: 'linear-gradient(135deg, #ea580c 0%, #c2410c 100%)', borderRadius: 16, padding: 20, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 8px 16px rgba(234, 88, 12, 0.2)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>🍕</div>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{item.name}</div>
                    <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 8 }}>{item.addons}</div>
                    <div style={{ fontSize: 18, fontWeight: 800 }}>₹ {item.amount.toFixed(2)}</div>
                  </div>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(255,255,255,0.2)', padding: '6px', borderRadius: 12 }}>
                  <button onClick={() => handleQtyChange(item.id, 1)} style={{ width: 28, height: 28, borderRadius: 8, background: '#fff', border: 'none', color: '#ea580c', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                  <span style={{ fontSize: 16, fontWeight: 700, minWidth: 20, textAlign: 'center' }}>{item.qty}</span>
                  <button onClick={() => handleQtyChange(item.id, -1)} style={{ width: 28, height: 28, borderRadius: 8, background: '#fff', border: 'none', color: '#ea580c', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>-</button>
                </div>
              </div>
            ))}
          </div>

          <button onClick={() => router.push(orderId ? `/pos/order?orderId=${orderId}` : '/pos/order')} style={{ width: '100%', padding: 16, border: '1px dashed #ea580c', background: '#fff7ec', color: '#ea580c', borderRadius: 12, fontWeight: 600, fontSize: 14, cursor: 'pointer', marginBottom: 32, transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.background='#ffedd5'} onMouseLeave={e => e.currentTarget.style.background='#fff7ec'}>
            + Add Items
          </button>

          <div style={{ marginTop: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, fontSize: 14, color: '#666', fontWeight: 500 }}>
              <span>Subtotal</span>
              <span style={{ color: '#1a1a1a', fontWeight: 700 }}>₹ {subtotal.toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, fontSize: 14, color: '#666', fontWeight: 500 }}>
              <span>Tax 18%</span>
              <span style={{ color: '#1a1a1a', fontWeight: 700 }}>₹ {tax.toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24, fontSize: 14, color: '#666', fontWeight: 500 }}>
              <span>Discount</span>
              <span style={{ color: '#1a1a1a', fontWeight: 700 }}>- ₹ {discountValue.toFixed(2)}</span>
            </div>
            
            <div style={{ borderTop: '1px dashed #eae7e0', margin: '0 0 24px 0' }} />
            
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 32, alignItems: 'center' }}>
              <span style={{ fontSize: 18, fontWeight: 700, color: '#1a1a1a' }}>Total Amount</span>
              <span style={{ fontSize: 24, fontWeight: 800, color: '#ea580c' }}>₹ {total.toFixed(2)}</span>
            </div>

            <button 
              onClick={() => setIsGenerated(true)}
              style={{ width: '100%', background: '#ea580c', color: '#fff', border: 'none', padding: 20, borderRadius: 16, fontSize: 18, fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s', boxShadow: '0 8px 24px rgba(234, 88, 12, 0.2)' }}
              onMouseEnter={e => e.currentTarget.style.transform='translateY(-2px)'}
              onMouseLeave={e => e.currentTarget.style.transform='translateY(0)'}
            >
              Generate Invoice
            </button>
          </div>
        </div>

        {/* Right Panel: Receipt Preview */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          
          <div id="receipt-print-area" style={{ background: '#fdf9f1', width: 400, padding: 32, borderRadius: 8, boxShadow: '0 20px 40px rgba(0,0,0,0.08)', position: 'relative', fontFamily: 'monospace' }}>
            {/* Faint background shadow to mimic stack of paper */}
            <div style={{ position: 'absolute', top: -10, left: 10, right: -10, bottom: 10, background: '#fcf6eb', borderRadius: 8, zIndex: -1, boxShadow: '0 20px 40px rgba(0,0,0,0.05)' }} />
            
            {isGenerated ? (
              <>
                <div style={{ textAlign: 'center', marginBottom: 24 }}>
                  <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8, fontFamily: 'sans-serif' }}>BhojAI Restaurant</h3>
                  <div style={{ fontSize: 12, color: '#666' }}>Marthahalli, Bangalore</div>
                  <div style={{ fontSize: 12, color: '#666' }}>Mobile : 9876543210</div>
                  <div style={{ fontSize: 12, color: '#666', marginTop: 8 }}>Invoice No. : {Math.floor(Math.random() * 1000) + 500}</div>
                  <div style={{ fontSize: 12, color: '#666' }}>Date : {new Date().toLocaleDateString('en-IN')}</div>
                  <div style={{ fontSize: 12, color: '#666' }}>Bill To : {customerInfo.name}</div>
                </div>

                <div style={{ borderTop: '1px dashed #ccc', borderBottom: '1px dashed #ccc', padding: '12px 0', marginBottom: 12 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', fontSize: 12, fontWeight: 700, marginBottom: 8 }}>
                    <div>Item</div>
                    <div style={{ textAlign: 'center' }}>Qty</div>
                    <div style={{ textAlign: 'right' }}>Rate</div>
                    <div style={{ textAlign: 'right' }}>Amount</div>
                  </div>
                  
                  {items.map(item => (
                    <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', fontSize: 12, marginBottom: 8, color: '#333' }}>
                      <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</div>
                      <div style={{ textAlign: 'center' }}>{item.qty}.0</div>
                      <div style={{ textAlign: 'right' }}>{Math.round(item.amount / item.qty)}</div>
                      <div style={{ textAlign: 'right' }}>{item.amount}</div>
                    </div>
                  ))}
                </div>

                <div style={{ padding: '0 0 12px 0', borderBottom: '1px dashed #ccc', marginBottom: 12, fontSize: 12, color: '#333' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span>SGST 9%</span>
                    <span>{(tax / 2).toFixed(1)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span>CGST 9%</span>
                    <span>{(tax / 2).toFixed(1)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span>Service Charge</span>
                    <span>{serviceCharge.toFixed(1)}</span>
                  </div>
                  {discountValue > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Discount</span>
                      <span>-{discountValue.toFixed(1)}</span>
                    </div>
                  )}
                </div>

                <div style={{ fontSize: 12, color: '#333', marginBottom: 24 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, marginBottom: 4 }}>
                    <span>Total</span>
                    <span>{total.toFixed(1)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span>Amount Paid</span>
                    <span>{total.toFixed(1)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Balance Amount</span>
                    <span>0.0</span>
                  </div>
                </div>

                <div style={{ fontSize: 10, color: '#666', textAlign: 'center', marginBottom: 16 }}>
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>Terms and Conditions</div>
                  <div>Items are for immediate consumption purpose only</div>
                </div>

                <div style={{ background: '#e8f5e9', border: '1px solid #2e7d32', color: '#2e7d32', padding: '8px 16px', borderRadius: 8, textAlign: 'center', fontWeight: 800, fontSize: 16, letterSpacing: '1px' }}>
                  ✓ BILL PAID
                </div>
              </>
            ) : (
              <div style={{ height: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999', fontFamily: 'sans-serif' }}>
                Click "Generate Invoice" to preview receipt
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: 16, marginTop: 32 }}>
            <button onClick={handleDownload} disabled={!isGenerated} style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: '1px solid #eae7e0', padding: '12px 20px', borderRadius: 8, fontSize: 14, fontWeight: 600, color: isGenerated ? '#333' : '#aaa', cursor: isGenerated ? 'pointer' : 'not-allowed' }}>
              📥 Download 
            </button>
            <button onClick={handlePrint} disabled={!isGenerated} style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: '1px solid #eae7e0', padding: '12px 20px', borderRadius: 8, fontSize: 14, fontWeight: 600, color: isGenerated ? '#ea580c' : '#aaa', cursor: isGenerated ? 'pointer' : 'not-allowed' }}>
              🖨️ Print 
            </button>
            <button onClick={handleShare} disabled={!isGenerated} style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: '1px solid #eae7e0', padding: '12px 20px', borderRadius: 8, fontSize: 14, fontWeight: 600, color: isGenerated ? '#333' : '#aaa', cursor: isGenerated ? 'pointer' : 'not-allowed' }}>
              🔗 Share 
            </button>
          </div>

        </div>

      </main>
    </div>
    </>
  );
}

export default function ReceiptPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ReceiptContent />
    </Suspense>
  );
}
