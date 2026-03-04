/**
 * OrderDetailPage — รายละเอียดคำสั่งซื้อ + Timeline + Payment History + Upload Slip
 */

import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { STATUS_COLORS } from './CheckoutPage';
import { STATUS_LABELS } from './MyOrdersPage';

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

  useEffect(() => {
    fetchData();
  }, [id, user]);

  // Upload slip and create payment record
  const handleUploadSlip = async () => {
    if (!slipFile || !supabase || !order) return;
    setUploading(true);
    setUploadError(null);

    try {
      const fileExt = slipFile.name.split('.').pop();
      const filePath = `${user.id}/${Date.now()}.${fileExt}`;

      console.log('[slip] uploading to:', filePath);
      const { error: uploadErr } = await supabase.storage
        .from('payment-slips')
        .upload(filePath, slipFile);

      if (uploadErr) {
        console.error('[slip] upload error:', uploadErr);
        throw uploadErr;
      }
      console.log('[slip] upload OK');

      // Store file path (private bucket — use signed URL to view)
      const { error: paymentErr } = await supabase
        .from('payments')
        .insert({
          order_id: order.id,
          amount: order.deposit_amount || Math.ceil((order.grand_total || 0) * 0.5),
          type: 'deposit',
          slip_url: filePath,
          status: 'pending',
        });

      if (paymentErr) {
        console.error('[slip] payment insert error:', paymentErr);
        throw paymentErr;
      }
      console.log('[slip] payment record created');

      setSlipFile(null);
      await fetchData();
    } catch (err) {
      console.error('[slip] error:', err);
      setUploadError(err.message || err.error || 'อัปโหลดไม่สำเร็จ กรุณาลองใหม่');
    }
    setUploading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-panel-darker flex items-center justify-center">
        <p className="text-zinc-500 text-sm">Loading...</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-panel-darker flex items-center justify-center">
        <div className="text-center">
          <p className="text-zinc-400 text-sm mb-4">ไม่พบคำสั่งซื้อ</p>
          <Link to="/orders" className="text-lumo-400 hover:text-lumo-300 text-sm">
            กลับรายการ
          </Link>
        </div>
      </div>
    );
  }

  const currentStepIndex = TIMELINE_STEPS.findIndex(s => s.key === order.status);

  return (
    <div className="min-h-screen bg-panel-darker">
      {/* Header */}
      <div className="border-b border-panel-border bg-panel-dark">
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="font-display font-bold text-lg text-gradient-lumo">Order Detail</h1>
            <p className="text-zinc-600 text-[11px] font-mono mt-0.5">#{order.id.slice(0, 8)}</p>
          </div>
          <Link to="/orders" className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
            กลับรายการ
          </Link>
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
        <div className="bg-panel-dark rounded-2xl border border-panel-border p-6">
          <h3 className="text-xs font-display font-semibold text-zinc-400 uppercase tracking-wider mb-4">
            สถานะการผลิต
          </h3>
          <div className="flex items-center justify-between">
            {TIMELINE_STEPS.map((step, i) => {
              const isCompleted = i <= currentStepIndex;
              const isCurrent = i === currentStepIndex;
              return (
                <div key={step.key} className="flex-1 flex flex-col items-center relative">
                  {/* Connector line */}
                  {i > 0 && (
                    <div
                      className={`absolute top-3 right-1/2 w-full h-0.5 -translate-y-1/2 ${
                        i <= currentStepIndex ? 'bg-lumo-400' : 'bg-panel-border'
                      }`}
                    />
                  )}
                  {/* Dot */}
                  <div
                    className={`relative z-10 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold
                      ${isCurrent
                        ? 'bg-lumo-400 text-panel-darker ring-4 ring-lumo-400/20'
                        : isCompleted
                          ? 'bg-lumo-400/60 text-panel-darker'
                          : 'bg-panel-border text-zinc-600'
                      }
                    `}
                  >
                    {isCompleted ? '✓' : i + 1}
                  </div>
                  {/* Label */}
                  <span className={`text-[10px] mt-1.5 ${isCurrent ? 'text-lumo-400 font-semibold' : 'text-zinc-600'}`}>
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Order Info */}
        <div className="bg-panel-dark rounded-2xl border border-panel-border p-6">
          <h3 className="text-xs font-display font-semibold text-zinc-400 uppercase tracking-wider mb-3">
            รายละเอียดคำสั่งซื้อ
          </h3>
          <div className="space-y-2 text-xs">
            <Row label="วันที่สั่ง" value={new Date(order.created_at).toLocaleString('th-TH')} />
            <Row label="ราคารวม" value={`฿${order.grand_total?.toLocaleString()}`} />
            <Row label="มัดจำ 50%" value={`฿${order.deposit_amount?.toLocaleString()}`} />
            {order.collected_data?.dimensions && (
              <Row
                label="ขนาด"
                value={`${order.collected_data.dimensions.width} x ${order.collected_data.dimensions.length} x ${order.collected_data.dimensions.height} cm`}
              />
            )}
            {order.collected_data?.quantity && (
              <Row label="จำนวน" value={`${order.collected_data.quantity.toLocaleString()} ชิ้น`} />
            )}
            {order.collected_data?.box_type && (
              <Row label="ประเภทกล่อง" value={order.collected_data.box_type} />
            )}
            {order.collected_data?.material && (
              <Row label="วัสดุ" value={order.collected_data.material} />
            )}
          </div>
        </div>

        {/* Upload Slip — show when status is pending and no deposit payment yet */}
        {order.status === 'pending' && !payments.some(p => p.type === 'deposit') && (
          <div className="bg-lumo-400/5 rounded-2xl border border-lumo-400/20 p-6">
            <h3 className="text-sm font-display font-semibold text-lumo-400 mb-2">ชำระมัดจำ 50%</h3>
            <p className="text-2xl font-bold text-lumo-400 mb-4">
              ฿{(order.deposit_amount || Math.ceil((order.grand_total || 0) * 0.5)).toLocaleString()}
            </p>

            <div className="space-y-3">
              <div>
                <p className="text-xs text-zinc-400 mb-2">โอนเงินมาที่:</p>
                <div className="bg-panel-darker rounded-lg p-3 text-xs text-zinc-300 space-y-1">
                  <div>ธนาคารกสิกรไทย</div>
                  <div className="font-mono">XXX-X-XXXXX-X</div>
                  <div>บจก. ลูโม่แพค</div>
                </div>
              </div>

              <div>
                <p className="text-xs text-zinc-400 mb-2">อัปโหลดสลิปโอนเงิน:</p>
                <label className="block w-full cursor-pointer">
                  <div className="border border-dashed border-panel-border rounded-lg p-4 text-center hover:border-lumo-400/40 transition-colors">
                    <div className="text-zinc-500 text-xs">
                      {slipFile ? slipFile.name : 'คลิกเพื่อเลือกไฟล์สลิป'}
                    </div>
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => { setSlipFile(e.target.files[0]); setUploadError(null); }}
                    className="hidden"
                  />
                </label>
              </div>

              {uploadError && (
                <div className="p-3 rounded-lg bg-red-900/30 border border-red-800/40 text-red-300 text-xs">
                  {uploadError}
                </div>
              )}

              <button
                onClick={handleUploadSlip}
                disabled={!slipFile || uploading}
                className="w-full py-3 rounded-xl bg-lumo-400 hover:bg-lumo-300 text-panel-darker text-sm font-display font-semibold transition-colors disabled:opacity-50 active:scale-[0.98]"
              >
                {uploading ? 'กำลังอัปโหลด...' : 'ส่งสลิปมัดจำ'}
              </button>
            </div>
          </div>
        )}

        {/* Payment History */}
        <div className="bg-panel-dark rounded-2xl border border-panel-border p-6">
          <h3 className="text-xs font-display font-semibold text-zinc-400 uppercase tracking-wider mb-3">
            ประวัติการชำระเงิน
          </h3>
          {payments.length === 0 ? (
            <p className="text-xs text-zinc-600">ยังไม่มีรายการ</p>
          ) : (
            <div className="space-y-3">
              {payments.map((payment) => (
                <div key={payment.id} className="flex items-center justify-between bg-panel-darker rounded-lg p-3">
                  <div>
                    <div className="text-xs text-zinc-300 font-medium">
                      {payment.type === 'deposit' ? 'มัดจำ' : payment.type === 'remaining' ? 'ชำระส่วนที่เหลือ' : 'คืนเงิน'}
                    </div>
                    <div className="text-[10px] text-zinc-600 mt-0.5">
                      {new Date(payment.created_at).toLocaleString('th-TH')}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-semibold text-zinc-200">฿{payment.amount?.toLocaleString()}</div>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border ${STATUS_COLORS[payment.status] || 'text-zinc-400'}`}>
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
      <span className="text-zinc-500">{label}</span>
      <span className="text-zinc-200 font-medium">{value}</span>
    </div>
  );
}
