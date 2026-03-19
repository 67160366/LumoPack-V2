/**
 * AdminDashboard — จัดการคำสั่งซื้อ + อนุมัติสลิป (Light Purple Theme)
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
  const [activeTab, setActiveTab] = useState('orders');
  const [filterStatus, setFilterStatus] = useState('all');

  const fetchData = useCallback(async () => {
    if (!supabase) return;
    const [ordersRes, paymentsRes] = await Promise.all([
      supabase.from('orders').select('*, profiles(email, full_name)').order('created_at', { ascending: false }),
      supabase.from('payments').select('*, orders(id, grand_total, status)').eq('status', 'pending').order('created_at', { ascending: false }),
    ]);
    if (ordersRes.data) setOrders(ordersRes.data);
    if (paymentsRes.data) setPayments(paymentsRes.data);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleStatusChange = async (orderId, newStatus) => {
    if (!supabase) return;
    await supabase.from('orders').update({ status: newStatus }).eq('id', orderId);
    fetchData();
  };

  const handlePaymentAction = async (paymentId, action) => {
    if (!supabase) return;
    await supabase.from('payments').update({ status: action }).eq('id', paymentId);

    if (action === 'approved') {
      const payment = payments.find(p => p.id === paymentId);
      if (payment?.orders?.id) {
        await supabase.from('orders').update({ status: 'deposit_paid' }).eq('id', payment.orders.id);
      }
    }
    fetchData();
  };

  const filteredOrders = filterStatus === 'all' ? orders : orders.filter(o => o.status === filterStatus);

  return (
    <div className="min-h-screen bg-purple-50">
      {/* Header */}
      <div className="border-b border-purple-100 bg-white shadow-sm">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="font-display font-bold text-lg text-purple-700">Admin Dashboard</h1>
            <p className="text-purple-400 text-xs mt-0.5">จัดการคำสั่งซื้อ</p>
          </div>
          <Link to="/" className="text-xs text-purple-500 hover:text-purple-700 transition-colors">กลับหน้าหลัก</Link>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-6">
        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-white rounded-xl p-1 w-fit border border-purple-100 shadow-sm">
          <button
            onClick={() => setActiveTab('orders')}
            className={`px-4 py-2 rounded-lg text-xs font-display font-medium transition-colors ${
              activeTab === 'orders' ? 'bg-purple-100 text-purple-700' : 'text-purple-400 hover:text-purple-600'
            }`}
          >
            Orders ({orders.length})
          </button>
          <button
            onClick={() => setActiveTab('payments')}
            className={`px-4 py-2 rounded-lg text-xs font-display font-medium transition-colors ${
              activeTab === 'payments' ? 'bg-purple-100 text-purple-700' : 'text-purple-400 hover:text-purple-600'
            }`}
          >
            Pending Slips ({payments.length})
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-7 h-7 border-2 border-purple-200 border-t-purple-600 rounded-full animate-spin" />
          </div>
        ) : activeTab === 'orders' ? (
          <div>
            {/* Filter */}
            <div className="flex gap-2 mb-4 flex-wrap">
              <button
                onClick={() => setFilterStatus('all')}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                  filterStatus === 'all' ? 'border-purple-400 text-purple-700 bg-purple-50' : 'border-purple-200 text-purple-400 hover:border-purple-300'
                }`}
              >
                All
              </button>
              {ALL_STATUSES.map(s => (
                <button
                  key={s}
                  onClick={() => setFilterStatus(s)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                    filterStatus === s ? STATUS_COLORS[s] : 'border-purple-200 text-purple-400 hover:border-purple-300'
                  }`}
                >
                  {STATUS_LABELS[s]}
                </button>
              ))}
            </div>

            {/* Table */}
            <div className="space-y-2">
              {filteredOrders.map((order) => (
                <div key={order.id} className="bg-white rounded-xl border border-purple-100 p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono text-purple-400">#{order.id.slice(0, 8)}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_COLORS[order.status]}`}>
                          {STATUS_LABELS[order.status]}
                        </span>
                      </div>
                      <div className="text-xs text-purple-700">
                        {order.profiles?.full_name || 'N/A'}
                      </div>
                      {order.profiles?.email && (
                        <div className="text-xs text-purple-500 mt-0.5">{order.profiles.email}</div>
                      )}
                      <div className="text-xs text-purple-400 mt-0.5">
                        {new Date(order.created_at).toLocaleDateString('th-TH')}
                      </div>
                    </div>

                    <div className="text-right flex-shrink-0">
                      <div className="text-sm font-semibold text-purple-700 mb-2">
                        ฿{order.grand_total?.toLocaleString()}
                      </div>
                      <select
                        value={order.status}
                        onChange={(e) => handleStatusChange(order.id, e.target.value)}
                        className="bg-purple-50/50 border border-purple-200 rounded-xl px-3 py-1.5 text-xs text-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-colors duration-200 appearance-none cursor-pointer"
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
                <p className="text-purple-400 text-xs text-center py-8">ไม่มีรายการ</p>
              )}
            </div>
          </div>
        ) : (
          /* Payments Tab */
          <div className="space-y-3">
            {payments.length === 0 ? (
              <p className="text-purple-400 text-xs text-center py-8">ไม่มีสลิปรออนุมัติ</p>
            ) : (
              payments.map((payment) => (
                <div key={payment.id} className="bg-white rounded-xl border border-purple-100 p-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs text-purple-700 font-medium">
                        Order #{payment.orders?.id?.slice(0, 8)}
                      </div>
                      <div className="text-xs text-purple-400 mt-0.5">
                        {payment.type === 'deposit' ? 'มัดจำ' : 'ชำระเพิ่ม'}{' — '}฿{payment.amount?.toLocaleString()}
                      </div>
                      <div className="text-xs text-purple-300 mt-0.5">
                        {new Date(payment.created_at).toLocaleString('th-TH')}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {payment.slip_url && (
                        <button
                          onClick={async () => {
                            const { data } = await supabase.storage.from('payment-slips').createSignedUrl(payment.slip_url, 3600);
                            if (data?.signedUrl) window.open(data.signedUrl, '_blank');
                          }}
                          className="text-xs text-blue-600 hover:text-blue-800 underline"
                        >
                          ดูสลิป
                        </button>
                      )}
                      <button
                        onClick={() => handlePaymentAction(payment.id, 'approved')}
                        className="text-xs px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors"
                      >
                        อนุมัติ
                      </button>
                      <button
                        onClick={() => handlePaymentAction(payment.id, 'rejected')}
                        className="text-xs px-3 py-1.5 rounded-lg bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 transition-colors"
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
