/**
 * CheckoutPage — สรุปสเปค + ราคา + อัปโหลดสลิปมัดจำ 50%
 */

import { useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

// Status badges reusable
const STATUS_COLORS = {
  pending: 'bg-yellow-900/30 text-yellow-300 border-yellow-800/40',
  deposit_paid: 'bg-blue-900/30 text-blue-300 border-blue-800/40',
  production: 'bg-orange-900/30 text-orange-300 border-orange-800/40',
  qc: 'bg-purple-900/30 text-purple-300 border-purple-800/40',
  shipped: 'bg-teal-900/30 text-teal-300 border-teal-800/40',
  completed: 'bg-emerald-900/30 text-emerald-300 border-emerald-800/40',
  cancelled: 'bg-red-900/30 text-red-300 border-red-800/40',
};

export { STATUS_COLORS };

export default function CheckoutPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const collectedData = location.state?.collectedData;
  const pricing = collectedData?.pricing;

  const [slipFile, setSlipFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);

  if (!collectedData || !pricing) {
    return (
      <div className="min-h-screen bg-panel-darker flex items-center justify-center">
        <div className="text-center">
          <p className="text-zinc-400 text-sm mb-4">ไม่พบข้อมูลสำหรับ Checkout</p>
          <Link to="/" className="text-lumo-400 hover:text-lumo-300 text-sm">
            กลับหน้าหลัก
          </Link>
        </div>
      </div>
    );
  }

  const grandTotal = pricing.grand_total || 0;
  const depositAmount = Math.ceil(grandTotal * 0.5);

  const handleSubmit = async () => {
    if (!slipFile) {
      setError('กรุณาอัปโหลดสลิปโอนเงิน');
      return;
    }
    if (!supabase) {
      setError('Supabase ยังไม่ได้ตั้งค่า');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      // 1. Upload slip to Supabase Storage
      const fileExt = slipFile.name.split('.').pop();
      const filePath = `${user.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('payment-slips')
        .upload(filePath, slipFile);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('payment-slips')
        .getPublicUrl(filePath);

      const slipUrl = urlData.publicUrl;

      // 2. Create order
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          user_id: user.id,
          session_id: collectedData.session_id || null,
          status: 'pending',
          collected_data: collectedData,
          pricing: pricing,
          grand_total: grandTotal,
          deposit_amount: depositAmount,
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // 3. Create payment record
      const { error: paymentError } = await supabase
        .from('payments')
        .insert({
          order_id: order.id,
          amount: depositAmount,
          type: 'deposit',
          slip_url: slipUrl,
          status: 'pending',
        });

      if (paymentError) throw paymentError;

      // 4. Navigate to order detail
      navigate(`/orders/${order.id}`, { replace: true });

    } catch (err) {
      setError(err.message || 'เกิดข้อผิดพลาด กรุณาลองใหม่');
    }

    setUploading(false);
  };

  return (
    <div className="min-h-screen bg-panel-darker">
      {/* Header */}
      <div className="border-b border-panel-border bg-panel-dark">
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="font-display font-bold text-lg text-gradient-lumo">Checkout</h1>
            <p className="text-zinc-500 text-xs mt-0.5">สรุปคำสั่งซื้อและชำระมัดจำ</p>
          </div>
          <Link to="/" className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
            กลับ
          </Link>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">
        {/* Specs Summary */}
        <div className="bg-panel-dark rounded-2xl border border-panel-border p-6">
          <h3 className="text-sm font-display font-semibold text-zinc-300 mb-4">สรุปสเปคกล่อง</h3>
          <div className="space-y-2 text-xs">
            {collectedData.product_type && (
              <Row label="ประเภทสินค้า" value={collectedData.product_type} />
            )}
            {collectedData.box_type && (
              <Row label="ประเภทกล่อง" value={collectedData.box_type} />
            )}
            {collectedData.material && (
              <Row label="วัสดุ" value={collectedData.material} />
            )}
            {collectedData.dimensions && (
              <Row
                label="ขนาด"
                value={`${collectedData.dimensions.width} x ${collectedData.dimensions.length} x ${collectedData.dimensions.height} cm`}
              />
            )}
            {collectedData.quantity && (
              <Row label="จำนวน" value={`${collectedData.quantity.toLocaleString()} ชิ้น`} />
            )}
            {collectedData.flute_type && (
              <Row label="ลอน" value={collectedData.flute_type} />
            )}
          </div>
        </div>

        {/* Pricing */}
        <div className="bg-panel-dark rounded-2xl border border-panel-border p-6">
          <h3 className="text-sm font-display font-semibold text-zinc-300 mb-4">ราคา</h3>
          <div className="space-y-2 text-xs">
            {pricing.box_base != null && <Row label="ค่ากล่อง" value={`฿${pricing.box_base.toLocaleString()}`} />}
            {pricing.inner != null && pricing.inner > 0 && <Row label="Inner" value={`฿${pricing.inner.toLocaleString()}`} />}
            {pricing.coatings != null && pricing.coatings > 0 && <Row label="Coatings" value={`฿${pricing.coatings.toLocaleString()}`} />}
            {pricing.stampings != null && pricing.stampings > 0 && <Row label="Stampings" value={`฿${pricing.stampings.toLocaleString()}`} />}
            <hr className="border-panel-border my-2" />
            <Row label="Subtotal" value={`฿${pricing.subtotal?.toLocaleString()}`} />
            <Row label="VAT 7%" value={`฿${pricing.vat?.toLocaleString()}`} />
            <div className="flex justify-between items-center pt-2">
              <span className="text-zinc-300 font-semibold">รวมทั้งสิ้น</span>
              <span className="text-lumo-400 font-bold text-base">฿{grandTotal.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Deposit */}
        <div className="bg-lumo-400/5 rounded-2xl border border-lumo-400/20 p-6">
          <h3 className="text-sm font-display font-semibold text-lumo-400 mb-2">มัดจำ 50%</h3>
          <p className="text-2xl font-bold text-lumo-400 mb-4">฿{depositAmount.toLocaleString()}</p>

          <div className="space-y-3">
            <div>
              <p className="text-xs text-zinc-400 mb-2">โอนเงินมาที่:</p>
              <div className="bg-panel-darker rounded-lg p-3 text-xs text-zinc-300 space-y-1">
                <div>ธนาคารกสิกรไทย</div>
                <div className="font-mono">XXX-X-XXXXX-X</div>
                <div>บจก. ลูโม่แพค</div>
              </div>
            </div>

            {/* Slip Upload */}
            <div>
              <p className="text-xs text-zinc-400 mb-2">อัปโหลดสลิปโอนเงิน:</p>
              <label className="block w-full cursor-pointer">
                <div className="border border-dashed border-panel-border rounded-lg p-4 text-center hover:border-lumo-400/40 transition-colors">
                  <div className="text-zinc-500 text-xs">
                    {slipFile ? `${slipFile.name}` : 'คลิกเพื่ออัปโหลดสลิป'}
                  </div>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setSlipFile(e.target.files[0])}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="p-3 rounded-lg bg-red-900/30 border border-red-800/40 text-red-300 text-xs">
            {error}
          </div>
        )}

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={uploading}
          className="w-full py-3.5 rounded-xl bg-lumo-400 hover:bg-lumo-300 text-panel-darker font-display font-semibold transition-colors disabled:opacity-50 active:scale-[0.98]"
        >
          {uploading ? 'กำลังส่งคำสั่งซื้อ...' : 'ยืนยันคำสั่งซื้อ'}
        </button>
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
