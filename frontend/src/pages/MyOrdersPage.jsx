/**
 * MyOrdersPage — รายการคำสั่งซื้อของลูกค้า
 */

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { STATUS_COLORS } from './CheckoutPage';

const STATUS_LABELS = {
  pending: 'รอตรวจสอบ',
  deposit_paid: 'ชำระมัดจำแล้ว',
  production: 'กำลังผลิต',
  qc: 'ตรวจสอบคุณภาพ',
  shipped: 'จัดส่งแล้ว',
  completed: 'เสร็จสิ้น',
  cancelled: 'ยกเลิก',
};

export { STATUS_LABELS };

export default function MyOrdersPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase || !user) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function fetchOrders() {
      try {
        const { data, error } = await supabase
          .from('orders')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (!cancelled) {
          if (!error && data) setOrders(data);
          setLoading(false);
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    }

    // Timeout fallback — ถ้า query ค้างเกิน 8 วินาที ให้หยุด loading
    const timeout = setTimeout(() => {
      if (!cancelled) {
        cancelled = true;
        setLoading(false);
      }
    }, 8000);

    fetchOrders().then(() => clearTimeout(timeout));

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [user]);

  return (
    <div className="min-h-screen bg-panel-darker">
      {/* Header */}
      <div className="border-b border-panel-border bg-panel-dark">
        <div className="max-w-3xl mx-auto px-8 sm:px-12 py-5 flex items-center justify-between">
          <div>
            <h1 className="font-display font-bold text-lg text-gradient-lumo">My Orders</h1>
            <p className="text-zinc-500 text-xs mt-0.5">ติดตามสถานะคำสั่งซื้อ</p>
          </div>
          <Link to="/" className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
            กลับหน้าหลัก
          </Link>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-8 sm:px-12 py-8">
        {loading ? (
          <div className="text-center py-12">
            <p className="text-zinc-500 text-sm">Loading...</p>
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-3xl mb-3">📦</div>
            <p className="text-zinc-400 text-sm mb-4">ยังไม่มีคำสั่งซื้อ</p>
            <Link to="/" className="text-lumo-400 hover:text-lumo-300 text-sm">
              เริ่มออกแบบกล่อง
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((order) => (
              <Link
                key={order.id}
                to={`/orders/${order.id}`}
                className="block bg-panel-dark rounded-xl border border-panel-border p-4 hover:border-lumo-400/30 transition-colors"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-mono text-zinc-500">
                    #{order.id.slice(0, 8)}
                  </span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border ${STATUS_COLORS[order.status] || 'text-zinc-400'}`}>
                    {STATUS_LABELS[order.status] || order.status}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-xs text-zinc-400">
                    {new Date(order.created_at).toLocaleDateString('th-TH', {
                      day: 'numeric', month: 'short', year: 'numeric',
                    })}
                  </div>
                  <div className="text-sm font-semibold text-lumo-400">
                    ฿{order.grand_total?.toLocaleString()}
                  </div>
                </div>
                {order.collected_data?.dimensions && (
                  <div className="text-[11px] text-zinc-600 mt-1">
                    {order.collected_data.dimensions.width} x {order.collected_data.dimensions.length} x {order.collected_data.dimensions.height} cm
                    {order.collected_data.quantity && ` | ${order.collected_data.quantity.toLocaleString()} ชิ้น`}
                  </div>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
