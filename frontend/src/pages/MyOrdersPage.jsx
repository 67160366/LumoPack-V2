/**
 * MyOrdersPage — รายการคำสั่งซื้อของลูกค้า (Light Purple Theme)
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
    if (!supabase || !user) { setLoading(false); return; }

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

    const timeout = setTimeout(() => {
      if (!cancelled) { cancelled = true; setLoading(false); }
    }, 8000);

    fetchOrders().then(() => clearTimeout(timeout));

    return () => { cancelled = true; clearTimeout(timeout); };
  }, [user]);

  return (
    <div className="min-h-screen bg-purple-50">
      {/* Header */}
      <div className="border-b border-purple-100 bg-white shadow-sm">
        <div className="max-w-3xl mx-auto px-8 sm:px-12 py-5 flex items-center justify-between">
          <div>
            <h1 className="font-display font-bold text-lg text-purple-700">My Orders</h1>
            <p className="text-purple-400 text-xs mt-0.5">ติดตามสถานะคำสั่งซื้อ</p>
          </div>
          <Link to="/" className="text-xs text-purple-500 hover:text-purple-700 transition-colors">
            กลับหน้าหลัก
          </Link>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-8 sm:px-12 py-8">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-7 h-7 border-2 border-purple-200 border-t-purple-600 rounded-full animate-spin" />
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-purple-400 text-sm mb-4">ยังไม่มีคำสั่งซื้อ</p>
            <Link to="/" className="text-sm text-purple-600 hover:text-purple-800 font-medium">
              เริ่มออกแบบกล่อง →
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((order) => (
              <Link
                key={order.id}
                to={`/orders/${order.id}`}
                className="block bg-white rounded-xl border border-purple-100 p-4 hover:border-purple-300 hover:shadow-md transition-all"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-mono text-purple-400">
                    #{order.id.slice(0, 8)}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_COLORS[order.status] || 'text-purple-400'}`}>
                    {STATUS_LABELS[order.status] || order.status}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-xs text-purple-500">
                    {new Date(order.created_at).toLocaleDateString('th-TH', {
                      day: 'numeric', month: 'short', year: 'numeric',
                    })}
                  </div>
                  <div className="text-sm font-semibold text-purple-700">
                    ฿{order.grand_total?.toLocaleString()}
                  </div>
                </div>
                {order.collected_data?.dimensions && (
                  <div className="text-xs text-purple-400 mt-1">
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
