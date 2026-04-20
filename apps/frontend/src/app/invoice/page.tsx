'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Sidebar } from '../components/shared';

// Simulated items fallback
const DEMO_ITEMS = [
  { id: '1', name: 'Mexican tacos', addons: '7 Delicious add ons', qty: 2, amount: 250 },
  { id: '2', name: 'Submarine sandwich', addons: '3 Delicious add ons', qty: 2, amount: 380 },
  { id: '3', name: 'Garlic toast', addons: '2 Delicious add ons', qty: 2, amount: 160 },
];

function InvoiceContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderId = searchParams.get('orderId');

  const [items, setItems] = useState<any[]>([]);
  const [customerInfo, setCustomerInfo] = useState({ name: 'Walk-in Customer', phone: '+91 98765 43210' });
  const [coupon, setCoupon] = useState('');
  const [discountApplied, setDiscountApplied] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<'CARD' | 'CASH' | 'UPI'>('CARD');
  const [isProcessing, setIsProcessing] = useState(false);

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

  const subtotal = items.reduce((sum, item) => sum + item.amount, 0);
  const tax = subtotal * 0.18; // 18% GST
  const serviceCharge = 50;
  const total = subtotal + tax + serviceCharge - discountApplied;

  const handleApplyCoupon = () => {
    if (coupon.trim().toUpperCase() === 'BHOJ20') {
      setDiscountApplied(subtotal * 0.2); // 20% off
    } else {
      alert('Invalid coupon code. Try BHOJ20');
      setDiscountApplied(0);
    }
  };

  const handleConfirmPayment = () => {
    setIsProcessing(true);
    // Real API call to post payment could go here
    setTimeout(() => {
      // Redirect to the newly requested receipt page
      router.push(`/invoice/receipt?orderId=${orderId || 'demo'}&discount=${discountApplied}`);
    }, 800);
  };

  return (
    <div className="pos-layout" style={{ background: '#f6f4f1' }}>
      <Sidebar activePath="/invoice" />

      <main style={{ flex: 1, padding: '32px 40px', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 32 }}>
          <button onClick={() => router.back()} style={{ width: 40, height: 40, borderRadius: '50%', background: '#fff', border: '1px solid #eae7e0', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.15s' }} onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'} onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}>
            ←
          </button>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#1a1a1a', letterSpacing: '-0.5px' }}>Checkout / Generate Invoice</h1>
        </div>

        <div style={{ display: 'flex', gap: 32 }}>
          {/* Left Panel: Order Details */}
          <div style={{ flex: 1.5, display: 'flex', flexDirection: 'column', gap: 24 }}>

            {/* Customer Info Box */}
            <div style={{ background: '#fff', padding: 24, borderRadius: 20, border: '1px solid #eae7e0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <img src="https://i.pravatar.cc/100?u=customer" alt="Customer" style={{ width: 48, height: 48, borderRadius: '50%' }} />
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#1a1a1a' }}>{customerInfo.name}</div>
                  <div style={{ fontSize: 13, color: '#666', display: 'flex', alignItems: 'center', gap: 6 }}>
                    📞 {customerInfo.phone}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <span style={{ background: '#fff7ec', color: '#ea580c', padding: '6px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700 }}>15% Discount offer</span>
                <span style={{ border: '1px solid #eae7e0', padding: '6px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, color: '#666' }}>Regular</span>
              </div>
            </div>

            {/* Order Items */}
            <div style={{ background: '#fff', padding: '24px 32px', borderRadius: 20, border: '1px solid #eae7e0' }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 24 }}>Order details</h2>

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr 1fr 1fr', fontSize: 13, fontWeight: 600, color: '#888', marginBottom: 16, paddingBottom: 16, borderBottom: '1px dashed #eae7e0' }}>
                <div>Dish name</div>
                <div>Add ons</div>
                <div>Quantity</div>
                <div style={{ textAlign: 'right' }}>Amount</div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {items.map(item => (
                  <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr 1fr 1fr', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 40, height: 40, background: '#f5f4ef', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🍕</div>
                      <span style={{ fontSize: 15, fontWeight: 600, color: '#1a1a1a' }}>{item.name}</span>
                    </div>
                    <div>
                      <span style={{ background: '#f5f4ef', color: '#666', padding: '4px 10px', borderRadius: 20, fontSize: 12 }}>{item.addons}</span>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#666' }}>x{item.qty}</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#1a1a1a', textAlign: 'right' }}>₹{item.amount.toFixed(2)}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Bottom Section: Coupon & Totals */}
            <div style={{ display: 'flex', gap: 24 }}>

              {/* Coupon Box */}
              <div style={{ flex: 1, background: '#fff', padding: 24, borderRadius: 20, border: '1px solid #eae7e0', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                  <span style={{ fontSize: 20 }}>🎁</span>
                  <span style={{ fontSize: 16, fontWeight: 700 }}>Discount coupon</span>
                </div>
                <p style={{ fontSize: 13, color: '#666', marginBottom: 20, lineHeight: 1.5 }}>
                  Apply the offered discount coupons or customer provided coupons for special discount on current cart value.
                </p>
                <div style={{ display: 'flex', gap: 12, marginTop: 'auto' }}>
                  <input
                    type="text"
                    placeholder="Enter code (e.g. BHOJ20)"
                    value={coupon}
                    onChange={e => setCoupon(e.target.value)}
                    style={{ flex: 1, padding: '12px 16px', borderRadius: 12, border: '1px solid #ccc', outline: 'none', fontSize: 14 }}
                  />
                  <button
                    onClick={handleApplyCoupon}
                    style={{ background: '#ea580c', color: '#fff', border: 'none', padding: '0 24px', borderRadius: 12, fontWeight: 700, fontSize: 14, cursor: 'pointer', transition: 'all 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#c2410c'}
                    onMouseLeave={e => e.currentTarget.style.background = '#ea580c'}
                  >
                    Apply
                  </button>
                </div>
              </div>

              {/* Totals Box */}
              <div style={{ flex: 1, background: '#fff', padding: 24, borderRadius: 20, border: '1px solid #eae7e0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, fontSize: 14, color: '#666' }}>
                  <span>Subtotal</span>
                  <span style={{ fontWeight: 600, color: '#1a1a1a' }}>₹{subtotal.toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, fontSize: 14, color: '#666' }}>
                  <span>Service charges</span>
                  <span style={{ fontWeight: 600, color: '#1a1a1a' }}>+ ₹{serviceCharge.toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, fontSize: 14, color: '#666' }}>
                  <span>Restaurant tax (18%)</span>
                  <span style={{ fontWeight: 600, color: '#1a1a1a' }}>+ ₹{tax.toFixed(2)}</span>
                </div>
                {discountApplied > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, fontSize: 14, color: '#e53935' }}>
                    <span>Special discount</span>
                    <span style={{ fontWeight: 600 }}>- ₹{discountApplied.toFixed(2)}</span>
                  </div>
                )}
                <div style={{ borderTop: '1px dashed #eae7e0', margin: '16px 0' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 18, fontWeight: 700 }}>Total</span>
                  <span style={{ fontSize: 24, fontWeight: 800, color: '#1a1a1a' }}>₹{total.toFixed(2)}</span>
                </div>
              </div>
            </div>

          </div>

          {/* Right Panel: Payment Selection */}
          <div style={{ flex: 1, background: '#fff', padding: 32, borderRadius: 20, border: '1px solid #eae7e0', display: 'flex', flexDirection: 'column' }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Select payment mode</h2>
            <p style={{ fontSize: 13, color: '#666', marginBottom: 32, lineHeight: 1.5 }}>
              Select a payment method that helps our customers to feel seamless experience during checkout
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 40 }}>

              {/* Card Option */}
              <div
                onClick={() => setPaymentMethod('CARD')}
                style={{
                  padding: 20, borderRadius: 16, border: paymentMethod === 'CARD' ? '2px solid #ea580c' : '1px solid #eae7e0',
                  background: paymentMethod === 'CARD' ? '#fff7ec' : '#fff', cursor: 'pointer', transition: 'all 0.2s',
                  display: 'flex', gap: 16, alignItems: 'center'
                }}
              >
                <div style={{ fontSize: 24, color: paymentMethod === 'CARD' ? '#ea580c' : '#888' }}>💳</div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#1a1a1a', marginBottom: 4 }}>Pay using card</div>
                  <div style={{ fontSize: 12, color: '#666', lineHeight: 1.4 }}>Complete the payment using credit or debit card, using swipe machine</div>
                </div>
              </div>

              {/* Cash Option */}
              <div
                onClick={() => setPaymentMethod('CASH')}
                style={{
                  padding: 20, borderRadius: 16, border: paymentMethod === 'CASH' ? '2px solid #ea580c' : '1px solid #eae7e0',
                  background: paymentMethod === 'CASH' ? '#fff7ec' : '#fff', cursor: 'pointer', transition: 'all 0.2s',
                  display: 'flex', gap: 16, alignItems: 'center'
                }}
              >
                <div style={{ fontSize: 24, color: paymentMethod === 'CASH' ? '#ea580c' : '#888' }}>💵</div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#1a1a1a', marginBottom: 4 }}>Pay on cash</div>
                  <div style={{ fontSize: 12, color: '#666', lineHeight: 1.4 }}>Complete order payment using cash on hand from customers easy and simple</div>
                </div>
              </div>

              {/* UPI Option */}
              <div
                onClick={() => setPaymentMethod('UPI')}
                style={{
                  padding: 20, borderRadius: 16, border: paymentMethod === 'UPI' ? '2px solid #ea580c' : '1px solid #eae7e0',
                  background: paymentMethod === 'UPI' ? '#fff7ec' : '#fff', cursor: 'pointer', transition: 'all 0.2s',
                  display: 'flex', gap: 16, alignItems: 'center'
                }}
              >
                <div style={{ fontSize: 24, color: paymentMethod === 'UPI' ? '#ea580c' : '#888' }}>📱</div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#1a1a1a', marginBottom: 4 }}>Pay using UPI or scan</div>
                  <div style={{ fontSize: 12, color: '#666', lineHeight: 1.4 }}>Ask customer to complete the payment using by scanning QR code or upi id</div>
                </div>
              </div>

            </div>

            {/* Confirm Button */}
            <button
              onClick={handleConfirmPayment}
              disabled={isProcessing}
              style={{
                marginTop: 'auto', background: isProcessing ? '#888' : '#ea580c', color: '#fff', border: 'none',
                padding: '20px', borderRadius: 16, fontSize: 18, fontWeight: 800, cursor: isProcessing ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s', boxShadow: '0 8px 24px rgba(234, 88, 12, 0.2)'
              }}
              onMouseEnter={e => !isProcessing && (e.currentTarget.style.transform = 'translateY(-2px)')}
              onMouseLeave={e => !isProcessing && (e.currentTarget.style.transform = 'translateY(0)')}
              onMouseDown={e => !isProcessing && (e.currentTarget.style.transform = 'scale(0.98)')}
              onMouseUp={e => !isProcessing && (e.currentTarget.style.transform = 'translateY(-2px)')}
            >
              {isProcessing ? 'Processing...' : 'Confirm payment'}
            </button>
            <div style={{ textAlign: 'center', marginTop: 16, fontSize: 13, color: '#888', fontWeight: 500 }}>
              Generates sales invoice instantly.
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}

export default function InvoicePage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <InvoiceContent />
    </Suspense>
  );
}
