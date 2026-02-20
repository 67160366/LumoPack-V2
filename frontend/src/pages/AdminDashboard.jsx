/**
 * AdminDashboard — จัดการคำสั่งซื้อ + อนุมัติสลิป + เปลี่ยนสถานะ
 */

import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { STATUS_COLORS } from './CheckoutPage';
import { STATUS_LABELS } from './MyOrdersPage';

const ALL_STATUSES = ['pending', 'deposit_paid', 'production', 'qc', 'shipped', 'completed', 'cancelled'];

export default function AdminDashboard() {
  const [orders, setOrders] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('orders'); // 'orders' | 'payments'
  const [filterStatus, setFilterStatus] = useState('all');

  const fetchData = useCallback(async () => {
    if (!supabase) return;

    const [ordersRes, paymentsRes] = await Promise.all([
      supabase.from('orders').select('*, profiles(full_name, phone, company)').order('created_at', { ascending: false }),
      supabase.from('payments').select('*, orders(id, grand_total, status)').eq('status', 'pending').order('created_at', { ascending: false }),
    ]);

    if (ordersRes.data) setOrders(ordersRes.data);
    if (paymentsRes.data) setPayments(paymentsRes.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleStatusChange = async (orderId, newStatus) => {
    if (!supabase) return;
    await supabase
      .from('orders')
      .update({ status: newStatus })
      .eq('id', orderId);
    fetchData();
  };

  const handlePaymentAction = async (paymentId, action) => {
    if (!supabase) return;
    const updates = { status: action };

    await supabase
      .from('payments')
      .update(updates)
      .eq('id', paymentId);

    // If approved, update order status to deposit_paid
    if (action === 'approved') {
      const payment = payments.find(p => p.id === paymentId);
      if (payment?.orders?.id) {
        await supabase
          .from('orders')
          .update({ status: 'deposit_paid' })
          .eq('id', payment.orders.id);
      }
    }

    fetchData();
  };

  const filteredOrders = filterStatus === 'all'
    ? orders
    : orders.filter(o => o.status === filterStatus);

  return (
    <div className="min-h-screen bg-panel-darker">
      {/* Header */}
      <div className="border-b border-panel-border bg-panel-dark">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="font-display font-bold text-lg text-gradient-lumo">Admin Dashboard</h1>
            <p className="text-zinc-500 text-xs mt-0.5">จัดการคำสั่งซื้อ</p>
          </div>
          <Link to="/" className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
            กลับหน้าหลัก
          </Link>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-6">
        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-panel-dark rounded-lg p-1 w-fit">
          <button
            onClick={() => setActiveTab('orders')}
            className={`px-4 py-2 rounded-md text-xs font-display font-medium transition-colors ${
              activeTab === 'orders' ? 'bg-lumo-400/20 text-lumo-400' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            Orders ({orders.length})
          </button>
          <button
            onClick={() => setActiveTab('payments')}
            className={`px-4 py-2 rounded-md text-xs font-display font-medium transition-colors ${
              activeTab === 'payments' ? 'bg-lumo-400/20 text-lumo-400' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            Pending Slips ({payments.length})
          </button>
        </div>

        {loading ? (
          <p className="text-zinc-500 text-sm text-center py-12">Loading...</p>
        ) : activeTab === 'orders' ? (
          /* Orders Tab */
          <div>
            {/* Filter */}
            <div className="flex gap-2 mb-4 flex-wrap">
              <button
                onClick={() => setFilterStatus('all')}
                className={`text-[10px] px-2.5 py-1 rounded-full border transition-colors ${
                  filterStatus === 'all' ? 'border-lumo-400/40 text-lumo-400' : 'border-panel-border text-zinc-500'
                }`}
              >
                All
              </button>
              {ALL_STATUSES.map(s => (
                <button
                  key={s}
                  onClick={() => setFilterStatus(s)}
                  className={`text-[10px] px-2.5 py-1 rounded-full border transition-colors ${
                    filterStatus === s ? STATUS_COLORS[s] : 'border-panel-border text-zinc-500'
                  }`}
                >
                  {STATUS_LABELS[s]}
                </button>
              ))}
            </div>

            {/* Table */}
            <div className="space-y-2">
              {filteredOrders.map((order) => (
                <div key={order.id} className="bg-panel-dark rounded-xl border border-panel-border p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[11px] font-mono text-zinc-500">#{order.id.slice(0, 8)}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full border ${STATUS_COLORS[order.status]}`}>
                          {STATUS_LABELS[order.status]}
                        </span>
                      </div>
                      <div className="text-xs text-zinc-300">
                        {order.profiles?.full_name || 'N/A'}
                        {order.profiles?.company && ` — ${order.profiles.company}`}
                      </div>
                      <div className="text-[11px] text-zinc-600 mt-0.5">
                        {order.profiles?.phone || ''}
                        {' | '}
                        {new Date(order.created_at).toLocaleDateString('th-TH')}
                      </div>
                    </div>

                    <div className="text-right flex-shrink-0">
                      <div className="text-sm font-semibold text-lumo-400 mb-2">
                        ฿{order.grand_total?.toLocaleString()}
                      </div>
                      <select
                        value={order.status}
                        onChange={(e) => handleStatusChange(order.id, e.target.value)}
                        className="bg-panel-darker border border-panel-border rounded-lg px-2 py-1 text-[11px] text-zinc-300 focus:outline-none focus:border-lumo-400/50"
                      >
                        {ALL_STATUSES.map(s => (
                          <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              ))}
              {filteredOrders.length === 0 && (
                <p className="text-zinc-600 text-xs text-center py-8">ไม่มีรายการ</p>
              )}
            </div>
          </div>
        ) : (
          /* Payments Tab */
          <div className="space-y-3">
            {payments.length === 0 ? (
              <p className="text-zinc-600 text-xs text-center py-8">ไม่มีสลิปรออนุมัติ</p>
            ) : (
              payments.map((payment) => (
                <div key={payment.id} className="bg-panel-dark rounded-xl border border-panel-border p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs text-zinc-300 font-medium">
                        Order #{payment.orders?.id?.slice(0, 8)}
                      </div>
                      <div className="text-[11px] text-zinc-500 mt-0.5">
                        {payment.type === 'deposit' ? 'มัดจำ' : 'ชำระเพิ่ม'}
                        {' — '}
                        ฿{payment.amount?.toLocaleString()}
                      </div>
                      <div className="text-[10px] text-zinc-600 mt-0.5">
                        {new Date(payment.created_at).toLocaleString('th-TH')}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {payment.slip_url && (
                        <a
                          href={payment.slip_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] text-blue-400 hover:text-blue-300 underline"
                        >
                          ดูสลิป
                        </a>
                      )}
                      <button
                        onClick={() => handlePaymentAction(payment.id, 'approved')}
                        className="text-[10px] px-3 py-1.5 rounded-lg bg-emerald-900/40 text-emerald-300 border border-emerald-800/40 hover:bg-emerald-900/60 transition-colors"
                      >
                        อนุมัติ
                      </button>
                      <button
                        onClick={() => handlePaymentAction(payment.id, 'rejected')}
                        className="text-[10px] px-3 py-1.5 rounded-lg bg-red-900/40 text-red-300 border border-red-800/40 hover:bg-red-900/60 transition-colors"
                      >
                        ปฏิเสธ
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
