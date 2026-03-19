/**
 * OrderDetailPage — รายละเอียดคำสั่งซื้อ (Light Purple Theme)
 */

import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { STATUS_COLORS } from './CheckoutPage';
import { STATUS_LABELS } from './MyOrdersPage';

const BOX_TYPE_LABELS = {
  rsc: 'RSC (กล่องลูกฟูก)', die_cut: 'Die-cut (ฝาเสียบ)',
  heart: 'Heart (หัวใจ)', star: 'Star (ดาว)', bear: 'Bear (หมี)',
  circle: 'Circle (ทรงกลม)', bow: 'Bow (ซัพพอร์ท)',
};

const TIMELINE_STEPS = [
  { key: 'pending', label: 'รอตรวจสอบ' },
  { key: 'deposit_paid', label: 'ชำระมัดจำ' },
  { key: 'production', label: 'ผลิต' },
  { key: 'qc', label: 'QC' },
  { key: 'shipped', label: 'จัดส่ง' },
  { key: 'completed', label: 'เสร็จสิ้น' },
];

export default function OrderDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [order, setOrder] = useState(null);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [slipFile, setSlipFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);

  const fetchData = async () => {
    if (!supabase || !user || !id) return;
    const [orderRes, paymentRes] = await Promise.all([
      supabase.from('orders').select('*').eq('id', id).single(),
      supabase.from('payments').select('*').eq('order_id', id).order('created_at', { ascending: true }),
    ]);
    if (orderRes.data) setOrder(orderRes.data);
    if (paymentRes.data) setPayments(paymentRes.data);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [id, user]);

  const handleUploadSlip = async () => {
    if (!slipFile || !supabase || !order) return;
    setUploading(true);
    setUploadError(null);

    try {
      const fileExt = slipFile.name.split('.').pop();
      const filePath = `${user.id}/${Date.now()}.${fileExt}`;

      const { error: uploadErr } = await supabase.storage.from('payment-slips').upload(filePath, slipFile);
      if (uploadErr) throw uploadErr;

      const { error: paymentErr } = await supabase.from('payments').insert({
        order_id: order.id,
        amount: order.deposit_amount || Math.ceil((order.grand_total || 0) * 0.5),
        type: 'deposit',
        slip_url: filePath,
        status: 'pending',
      });
      if (paymentErr) throw paymentErr;

      setSlipFile(null);
      await fetchData();
    } catch (err) {
      setUploadError(err.message || err.error || 'อัปโหลดไม่สำเร็จ กรุณาลองใหม่');
    }
    setUploading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-purple-50 flex items-center justify-center">
        <div className="w-7 h-7 border-2 border-purple-200 border-t-purple-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-purple-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-purple-400 text-sm mb-4">ไม่พบคำสั่งซื้อ</p>
          <Link to="/orders" className="text-purple-600 hover:text-purple-800 text-sm font-semibold">กลับรายการ</Link>
        </div>
      </div>
    );
  }

  const currentStepIndex = TIMELINE_STEPS.findIndex(s => s.key === order.status);

  return (
    <div className="min-h-screen bg-purple-50">
      {/* Header */}
      <div className="border-b border-purple-100 bg-white shadow-sm">
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="font-display font-bold text-lg text-purple-700">Order Detail</h1>
            <p className="text-purple-400 text-xs font-mono mt-0.5">#{order.id.slice(0, 8)}</p>
          </div>
          <Link to="/orders" className="text-xs text-purple-500 hover:text-purple-700 transition-colors">กลับรายการ</Link>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">
        {/* Status Badge */}
        <div className="text-center">
          <span className={`inline-block text-xs px-4 py-1.5 rounded-full border ${STATUS_COLORS[order.status]}`}>
            {STATUS_LABELS[order.status] || order.status}
          </span>
        </div>

        {/* Timeline */}
        <div className="bg-white rounded-2xl border border-purple-100 p-6 shadow-sm">
          <h3 className="text-xs font-display font-semibold text-purple-600 uppercase tracking-wider mb-4">สถานะการผลิต</h3>
          <div className="flex items-center justify-between">
            {TIMELINE_STEPS.map((step, i) => {
              const isCompleted = i <= currentStepIndex;
              const isCurrent = i === currentStepIndex;
              return (
                <div key={step.key} className="flex-1 flex flex-col items-center relative">
                  {i > 0 && (
                    <div className={`absolute top-3 right-1/2 w-full h-0.5 -translate-y-1/2 ${i <= currentStepIndex ? 'bg-purple-500' : 'bg-purple-100'}`} />
                  )}
                  <div className={`relative z-10 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold
                    ${isCurrent
                      ? 'bg-purple-600 text-white ring-4 ring-purple-200'
                      : isCompleted
                        ? 'bg-purple-400 text-white'
                        : 'bg-purple-100 text-purple-400'
                    }
                  `}>
                    {isCompleted ? '✓' : i + 1}
                  </div>
                  <span className={`text-xs mt-1.5 ${isCurrent ? 'text-purple-700 font-semibold' : 'text-purple-400'}`}>
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Order Info */}
        <div className="bg-white rounded-2xl border border-purple-100 p-6 shadow-sm">
          <h3 className="text-xs font-display font-semibold text-purple-600 uppercase tracking-wider mb-3">รายละเอียดคำสั่งซื้อ</h3>
          <div className="space-y-2 text-xs">
            <Row label="วันที่สั่ง" value={new Date(order.created_at).toLocaleString('th-TH')} />
            <Row label="ราคารวม" value={`฿${order.grand_total?.toLocaleString()}`} />
            <Row label="มัดจำ 50%" value={`฿${order.deposit_amount?.toLocaleString()}`} />
            {order.collected_data?.dimensions && (
              <Row label="ขนาด" value={`${order.collected_data.dimensions.width} x ${order.collected_data.dimensions.length} x ${order.collected_data.dimensions.height} cm`} />
            )}
            {order.collected_data?.quantity && <Row label="จำนวน" value={`${order.collected_data.quantity.toLocaleString()} ชิ้น`} />}
            {order.collected_data?.box_type && <Row label="ประเภทกล่อง" value={BOX_TYPE_LABELS[order.collected_data.box_type] || order.collected_data.box_type} />}
            {order.collected_data?.material && <Row label="วัสดุ" value={order.collected_data.material} />}
          </div>
        </div>

        {/* Upload Slip */}
        {order.status === 'pending' && !payments.some(p => p.type === 'deposit') && (
          <div className="bg-purple-50 rounded-2xl border border-purple-200 p-6">
            <h3 className="text-sm font-display font-semibold text-purple-700 mb-2">ชำระมัดจำ 50%</h3>
            <p className="text-2xl font-bold text-purple-700 mb-4">
              ฿{(order.deposit_amount || Math.ceil((order.grand_total || 0) * 0.5)).toLocaleString()}
            </p>

            <div className="space-y-3">
              <div>
                <p className="text-xs text-purple-500 mb-2">โอนเงินมาที่:</p>
                <div className="bg-white rounded-xl p-3 text-xs text-purple-700 space-y-1 border border-purple-100">
                  <div>ธนาคารกสิกรไทย</div>
                  <div className="font-mono">XXX-X-XXXXX-X</div>
                  <div>บจก. ลูโม่แพค</div>
                </div>
              </div>

              <div>
                <p className="text-xs text-purple-500 mb-2">อัปโหลดสลิปโอนเงิน:</p>
                <label className="block w-full cursor-pointer">
                  <div className="border border-dashed border-purple-300 rounded-xl p-4 text-center hover:border-purple-500 transition-colors duration-200 bg-white">
                    <div className="text-purple-400 text-xs">
                      {slipFile ? slipFile.name : 'คลิกเพื่อเลือกไฟล์สลิป'}
                    </div>
                  </div>
                  <input type="file" accept="image/*" onChange={(e) => { setSlipFile(e.target.files[0]); setUploadError(null); }} className="hidden" />
                </label>
              </div>

              {uploadError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-xs">{uploadError}</div>
              )}

              <button
                onClick={handleUploadSlip}
                disabled={!slipFile || uploading}
                className="w-full py-3 rounded-xl bg-purple-700 hover:bg-purple-800 text-white text-sm font-display font-semibold transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] shadow-sm"
              >
                {uploading ? 'กำลังอัปโหลด...' : 'ส่งสลิปมัดจำ'}
              </button>
            </div>
          </div>
        )}

        {/* Payment History */}
        <div className="bg-white rounded-2xl border border-purple-100 p-6 shadow-sm">
          <h3 className="text-xs font-display font-semibold text-purple-600 uppercase tracking-wider mb-3">ประวัติการชำระเงิน</h3>
          {payments.length === 0 ? (
            <p className="text-xs text-purple-400">ยังไม่มีรายการ</p>
          ) : (
            <div className="space-y-3">
              {payments.map((payment) => (
                <div key={payment.id} className="flex items-center justify-between bg-purple-50 rounded-lg p-3">
                  <div>
                    <div className="text-xs text-purple-700 font-medium">
                      {payment.type === 'deposit' ? 'มัดจำ' : payment.type === 'remaining' ? 'ชำระส่วนที่เหลือ' : 'คืนเงิน'}
                    </div>
                    <div className="text-xs text-purple-400 mt-0.5">
                      {new Date(payment.created_at).toLocaleString('th-TH')}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-semibold text-purple-800">฿{payment.amount?.toLocaleString()}</div>
                    <span className={`text-xs px-1.5 py-0.5 rounded border ${STATUS_COLORS[payment.status] || 'text-purple-400'}`}>
                      {payment.status === 'pending' ? 'รอตรวจสอบ' : payment.status === 'approved' ? 'อนุมัติ' : 'ปฏิเสธ'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between">
      <span className="text-purple-400">{label}</span>
      <span className="text-purple-800 font-medium">{value}</span>
    </div>
  );
}
