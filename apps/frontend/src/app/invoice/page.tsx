'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Sidebar, IconCash, IconCard, IconQR } from '../components/shared';
import { API_BASE, apiRequest } from '../lib/api';

interface OrderData {
  id: string;
  items: Array<{
    id: string;
    menuItem?: {
      name?: string;
    };
    quantity: number;
    priceAtOrder?: number;
    price?: number;
    notes?: string;
  }>;
  customerName?: string;
  customerPhone?: string;
  bill?: {
    id: string;
    totalAmount: number;
    subTotal: number;
    taxAmount: number;
    serviceCharge: number;
    discountAmount: number;
    isPaid: boolean;
  } | null;
}

interface BillData {
  id: string;
  orderId: string;
  totalAmount: number;
  billNumber?: string;
  createdAt: string;
  order?: {
    table?: {
      number?: string;
    };
    customerName?: string;
  };
}

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
  const [pendingBills, setPendingBills] = useState<BillData[]>([]);
  const [paidBills, setPaidBills] = useState<BillData[]>([]);
  const [isLoadingBills, setIsLoadingBills] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [billFilter, setBillFilter] = useState<'pending' | 'paid' | 'all'>('pending');
  const [orderData, setOrderData] = useState<OrderData | null>(null);

  useEffect(() => {
    if (!orderId) {
      fetchPendingBills();
      const interval = setInterval(fetchPendingBills, 10000); // refresh every 10s
      return () => clearInterval(interval);
    }
  }, [orderId]);

  // Also refresh bills when coming back to the main view
  useEffect(() => {
    if (!orderId) {
      fetchPendingBills();
    }
  }, [orderId]);

  const fetchPendingBills = async () => {
    setIsLoadingBills(true);
    try {
      const [pendingData, paidData] = await Promise.all([
        apiRequest('/bills?isPaid=false'),
        apiRequest('/bills?isPaid=true')
      ]);
      setPendingBills(Array.isArray(pendingData) ? pendingData : []);
      setPaidBills(Array.isArray(paidData) ? paidData : []);
    } catch (err) {
      console.error('Failed to fetch bills:', err);
    } finally {
      setIsLoadingBills(false);
    }
  };

  useEffect(() => {
    if (!orderId) {
      setItems([]);
      return;
    }
    
    const fetchOrderDetails = async () => {
      try {
        const data = await apiRequest(`/orders/${orderId}`) as OrderData;
        if (data && data.items) {
          setItems(data.items.map((i: any) => ({
            id: i.id,
            name: i.menuItem?.name || 'Item',
            addons: i.notes || 'No add ons',
            qty: i.quantity,
            amount: (i.priceAtOrder || i.price || 0) * i.quantity
          })));
          setCustomerInfo({
            name: data.customerName || 'Walk-in Customer',
            phone: data.customerPhone || '+91 98765 43210'
          });
          setOrderData(data);
        }
      } catch (err) {
        console.error('Failed to fetch order detail:', err);
      }
    };
    
    fetchOrderDetails();
  }, [orderId]);

  // Use bill data from backend if available, otherwise fallback to frontend calculation
  const subtotal = orderData?.bill ? orderData.bill.subTotal : items.reduce((sum, item) => sum + item.amount, 0);
  const tax = orderData?.bill ? orderData.bill.taxAmount : subtotal * 0.05;
  const serviceCharge = orderData?.bill ? orderData.bill.serviceCharge : (items.length > 0 ? 30 : 0);
  
  // Total logic: Use backend total if present, BUT subtract any NEW frontend discount if applied
  // Actually, better to just use backend bill as ground truth if it exists.
  const backendDiscount = orderData?.bill?.discountAmount || 0;
  const effectiveDiscount = Math.max(discountApplied, backendDiscount);
  const total = orderData?.bill 
    ? (discountApplied > backendDiscount ? (orderData.bill.totalAmount - (discountApplied - backendDiscount)) : orderData.bill.totalAmount)
    : (subtotal + tax + serviceCharge - discountApplied);

  const handleApplyCoupon = () => {
    if (coupon.trim().toUpperCase() === 'BHOJ20') {
      setDiscountApplied(subtotal * 0.2); // 20% off
    } else {
      alert('Invalid coupon code. Try BHOJ20');
      setDiscountApplied(0);
    }
  };

  const handleConfirmPayment = async () => {
    if (!orderId) return;
    setIsProcessing(true);
    try {
      const paymentAmount = total;
      
      // 1. Process the payment
      const paymentData = await apiRequest(`/orders/${orderId}/payment`, {
        method: 'POST',
        body: {
          amount: paymentAmount,
          method: paymentMethod,
          transactionId: `TXN-${Date.now()}`
        },
      });

      // 2. Explicitly mark the order as COMPLETED to ensure it moves out of "Pending"
      // This is crucial if the paid amount is slightly different from the bill due to rounding or manual discounts
      try {
        await apiRequest(`/orders/${orderId}/status`, {
          method: 'PATCH',
          body: { status: 'COMPLETED' }
        });
      } catch (statusErr) {
        console.warn('Failed to update order status to COMPLETED, but payment was recorded:', statusErr);
      }

      console.log('Payment successful:', paymentData);
      
      alert(`Payment of Rs.${paymentAmount.toFixed(2)} successful via ${paymentMethod}! Invoice generated.`);
      
      // Refresh the bills list to show the payment in the correct list
      setTimeout(() => {
        // Fetch updated bills to refresh the lists
        fetchPendingBills();
        // Redirect to bills page to show the updated payment status
        router.push('/pos/bills');
      }, 1000);
      
    } catch (err: any) {
      console.error('Payment failed:', err);
      alert(err.message || 'Payment failed');
    } finally {
      setIsProcessing(false);
    }
  };

  const allBills = billFilter === 'pending' ? pendingBills : 
                  billFilter === 'paid' ? paidBills : 
                  [...pendingBills, ...paidBills];

  const filteredBills = allBills.filter(bill => {
    const search = searchTerm.toLowerCase();
    const customer = (bill.order?.customerName || '').toLowerCase();
    const billNum = (bill.billNumber || '').toLowerCase();
    const tableNum = (bill.order?.table?.number || '').toLowerCase();
    
    return customer.includes(search) || 
           billNum.includes(search) || 
           tableNum.includes(search);
  });


  return (
    <div className="pos-layout" style={{ background: '#f6f4f1' }}>
      <Sidebar activePath="/invoice" />

      <main style={{ flex: 1, padding: '32px 40px', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {orderId && (
              <button 
                onClick={() => router.push('/invoice')} 
                style={{ width: 40, height: 40, borderRadius: '50%', background: '#fff', border: '1px solid #eae7e0', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
              >
                ←
              </button>
            )}
            <div>
              <h1 style={{ fontSize: 24, fontWeight: 800, color: '#1a1a1a', letterSpacing: '-0.5px', marginBottom: 4 }}>
                {orderId ? 'Checkout / Generate Invoice' : 'Billing Dashboard'}
              </h1>
              <div style={{ fontSize: 13, color: '#666', fontWeight: 500 }}>
                {orderId ? `Order #${orderId?.slice(-6).toUpperCase()}` : `${allBills.length} total invoices`}
              </div>
            </div>
          </div>
          
          {!orderId && (
            <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: 8, background: '#fff', padding: '4px', borderRadius: 12, border: '1px solid #eae7e0' }}>
                <button
                  onClick={() => setBillFilter('pending')}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 8,
                    border: 'none',
                    background: billFilter === 'pending' ? '#ea580c' : 'transparent',
                    color: billFilter === 'pending' ? '#fff' : '#666',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Pending ({pendingBills.length})
                </button>
                <button
                  onClick={() => setBillFilter('paid')}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 8,
                    border: 'none',
                    background: billFilter === 'paid' ? '#ea580c' : 'transparent',
                    color: billFilter === 'paid' ? '#fff' : '#666',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Paid ({paidBills.length})
                </button>
                <button
                  onClick={() => setBillFilter('all')}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 8,
                    border: 'none',
                    background: billFilter === 'all' ? '#ea580c' : 'transparent',
                    color: billFilter === 'all' ? '#fff' : '#666',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  All ({allBills.length})
                </button>
              </div>
              <div style={{ position: 'relative' }}>
                <input 
                  type="text" 
                  placeholder="Search bills, tables..." 
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  style={{ padding: '12px 16px 12px 44px', borderRadius: 12, border: '1px solid #eae7e0', outline: 'none', width: 280, fontSize: 14 }}
                />
                <span style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', opacity: 0.4 }}>🔍</span>
              </div>
              <button onClick={fetchPendingBills} style={{ background: '#fff', border: '1px solid #eae7e0', padding: '0 16px', borderRadius: 12, cursor: 'pointer' }}>
                {isLoadingBills ? '...' : '🔄'}
              </button>
            </div>
          )}
        </div>

        {!orderId ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 24 }}>
            {filteredBills.map(bill => (
              <div 
                key={bill.id} 
                onClick={() => router.push(`/invoice?orderId=${bill.orderId}`)}
                style={{ 
                  background: '#fff', padding: 24, borderRadius: 24, border: '1px solid #eae7e0', cursor: 'pointer', transition: 'all 0.2s',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.02)'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'translateY(-4px)';
                  e.currentTarget.style.boxShadow = '0 12px 24px rgba(0,0,0,0.06)';
                  e.currentTarget.style.borderColor = '#ea580c';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.02)';
                  e.currentTarget.style.borderColor = '#eae7e0';
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
                  <div style={{ background: '#f8fafc', padding: '8px 12px', borderRadius: 12, fontSize: 12, fontWeight: 700, color: '#475569' }}>
                    Table {bill.order?.table?.number || 'Walk-in'}
                  </div>
                  <div style={{ color: '#ea580c', fontWeight: 800, fontSize: 18 }}>
                    Rs.{(bill.totalAmount || 0).toFixed(2)}
                  </div>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                  <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#fff7ec', color: '#ea580c', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, border: '2px solid #fff' }}>
                    👤
                  </div>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#1a1a1a' }}>{bill.order?.customerName || 'Walk-in Customer'}</div>
                    <div style={{ fontSize: 12, color: '#666' }}>Bill: {bill.billNumber}</div>
                  </div>
                </div>

                <div style={{ borderTop: '1px dashed #eae7e0', paddingTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: '#94a3b8' }}>
                    {new Date(bill.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {paidBills.some(pb => pb.id === bill.id) ? (
                      <>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981' }} />
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#047857', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Paid</span>
                      </>
                    ) : (
                      <>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#fbbf24' }} />
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#b45309', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Pending Payment</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {filteredBills.length === 0 && !isLoadingBills && (
              <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '80px 0', background: '#fff', borderRadius: 24, border: '1px dashed #ccc' }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>🎉</div>
                <h3 style={{ fontSize: 18, fontWeight: 700, color: '#1a1a1a' }}>No pending payments</h3>
                <p style={{ color: '#666', fontSize: 14 }}>All caught up! New unpaid bills will appear here.</p>
              </div>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 32 }}>
            {/* Left Panel: Order Details */}
            <div style={{ flex: 1.5, display: 'flex', flexDirection: 'column', gap: 24 }}>
              
              {/* Customer Info Box */}
              <div style={{ background: '#fff', padding: 24, borderRadius: 20, border: '1px solid #eae7e0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <img src={`https://i.pravatar.cc/100?u=${orderId}`} alt="Customer" style={{ width: 48, height: 48, borderRadius: '50%' }} />
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
                        <div style={{ width: 40, height: 40, background: '#f5f4ef', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🍽️</div>
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
                    Apply discount coupons for special discount on current cart value.
                  </p>
                  <div style={{ display: 'flex', gap: 12, marginTop: 'auto' }}>
                    <input 
                      type="text" 
                      placeholder="Enter code (BHOJ20)" 
                      value={coupon}
                      onChange={e => setCoupon(e.target.value)}
                      style={{ flex: 1, padding: '12px 16px', borderRadius: 12, border: '1px solid #ccc', outline: 'none', fontSize: 14 }}
                    />
                    <button 
                      onClick={handleApplyCoupon}
                      style={{ background: '#ea580c', color: '#fff', border: 'none', padding: '0 20px', borderRadius: 12, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
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
                    <span>Restaurant tax (5%)</span>
                    <span style={{ fontWeight: 600, color: '#1a1a1a' }}>+ ₹{tax.toFixed(2)}</span>
                  </div>
                  {(discountApplied > 0 || backendDiscount > 0) && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, fontSize: 14, color: '#e53935' }}>
                      <span>Applied Discount</span>
                      <span style={{ fontWeight: 600 }}>- ₹{effectiveDiscount.toFixed(2)}</span>
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
                Choose a payment method to complete the checkout process.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 40 }}>
                <button 
                  onClick={() => setPaymentMethod('UPI')}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 16, padding: '20px', borderRadius: 12, width: '100%', cursor: 'pointer',
                    border: paymentMethod === 'UPI' ? '2px solid #ea580c' : '1px solid #f0ede8',
                    background: paymentMethod === 'UPI' ? '#fff7ed' : '#fff',
                    textAlign: 'left', transition: 'all 0.2s'
                  }}
                >
                  <div style={{ padding: 12, borderRadius: 8, background: '#f8fafc', color: '#64748b' }}>
                    <IconQR style={{ width: 24, height: 24 }} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, color: '#1a1a1a', fontSize: 16 }}>Pay using UPI</div>
                    <div style={{ fontSize: 13, color: '#666' }}>Scan QR code or use UPI ID</div>
                  </div>
                </button>

                <button 
                  onClick={() => setPaymentMethod('CASH')}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 16, padding: '20px', borderRadius: 12, width: '100%', cursor: 'pointer',
                    border: paymentMethod === 'CASH' ? '2px solid #ea580c' : '1px solid #f0ede8',
                    background: paymentMethod === 'CASH' ? '#fff7ed' : '#fff',
                    textAlign: 'left', transition: 'all 0.2s'
                  }}
                >
                  <div style={{ padding: 12, borderRadius: 8, background: '#f8fafc', color: '#64748b' }}>
                    <IconCash style={{ width: 24, height: 24 }} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, color: '#1a1a1a', fontSize: 16 }}>Cash Payment</div>
                    <div style={{ fontSize: 13, color: '#666' }}>Receive physical cash for the order</div>
                  </div>
                </button>

                <button 
                  onClick={() => setPaymentMethod('CARD')}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 16, padding: '20px', borderRadius: 12, width: '100%', cursor: 'pointer',
                    border: paymentMethod === 'CARD' ? '2px solid #ea580c' : '1px solid #f0ede8',
                    background: paymentMethod === 'CARD' ? '#fff7ed' : '#fff',
                    textAlign: 'left', transition: 'all 0.2s'
                  }}
                >
                  <div style={{ padding: 12, borderRadius: 8, background: '#f8fafc', color: '#64748b' }}>
                    <IconCard style={{ width: 24, height: 24 }} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, color: '#1a1a1a', fontSize: 16 }}>Card Terminal</div>
                    <div style={{ fontSize: 13, color: '#666' }}>Swipe or Dip credit/debit card</div>
                  </div>
                </button>
              </div>

              <button 
                onClick={handleConfirmPayment}
                disabled={isProcessing}
                style={{ 
                  marginTop: 'auto', background: isProcessing ? '#888' : '#ea580c', color: '#fff', border: 'none', 
                  padding: '20px', borderRadius: 16, fontSize: 18, fontWeight: 800, cursor: isProcessing ? 'not-allowed' : 'pointer', 
                  transition: 'all 0.15s', boxShadow: '0 8px 24px rgba(234, 88, 12, 0.2)'
                }}
              >
                {isProcessing ? 'Processing...' : 'Confirm payment'}
              </button>
            </div>
          </div>
        )}
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
