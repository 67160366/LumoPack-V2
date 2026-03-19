/**
 * CheckoutPage — สรุปสเปค + ราคา + อัปโหลดสลิปมัดจำ 50% (Light Purple Theme)
 */

import { useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

const STATUS_COLORS = {
  pending: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  deposit_paid: 'bg-blue-50 text-blue-700 border-blue-200',
  production: 'bg-orange-50 text-orange-700 border-orange-200',
  qc: 'bg-purple-50 text-purple-700 border-purple-200',
  shipped: 'bg-teal-50 text-teal-700 border-teal-200',
  completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  cancelled: 'bg-red-50 text-red-700 border-red-200',
};

export { STATUS_COLORS };

const BOX_TYPE_LABELS = {
  rsc: 'RSC (กล่องลูกฟูก)', die_cut: 'Die-cut (ฝาเสียบ)',
  heart: 'Heart (หัวใจ)', star: 'Star (ดาว)', bear: 'Bear (หมี)',
  circle: 'Circle (ทรงกลม)', bow: 'Bow (ซัพพอร์ท)',
};

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
      <div className="min-h-screen bg-purple-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-purple-400 text-sm mb-4">ไม่พบข้อมูลสำหรับ Checkout</p>
          <Link to="/" className="text-purple-600 hover:text-purple-800 text-sm font-semibold">
            กลับหน้าหลัก
          </Link>
        </div>
      </div>
    );
  }

  const grandTotal = pricing.grand_total || 0;
  const depositAmount = Math.ceil(grandTotal * 0.5);

  const handleSubmit = async () => {
    if (!slipFile) { setError('กรุณาอัปโหลดสลิปโอนเงิน'); return; }
    if (!supabase) { setError('Supabase ยังไม่ได้ตั้งค่า'); return; }

    setUploading(true);
    setError(null);

    try {
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

      navigate(`/orders/${order.id}`, { replace: true });
    } catch (err) {
      setError(err.message || 'เกิดข้อผิดพลาด กรุณาลองใหม่');
    }
    setUploading(false);
  };

  return (
    <div className="min-h-screen bg-purple-50">
      {/* Header */}
      <div className="border-b border-purple-100 bg-white shadow-sm">
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="font-display font-bold text-lg text-purple-700">Checkout</h1>
            <p className="text-purple-400 text-xs mt-0.5">สรุปคำสั่งซื้อและชำระมัดจำ</p>
          </div>
          <Link to="/" className="text-xs text-purple-500 hover:text-purple-700 transition-colors">
            กลับ
          </Link>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">
        {/* Specs Summary */}
        <div className="bg-white rounded-2xl border border-purple-100 p-6 shadow-sm">
          <h3 className="text-sm font-display font-semibold text-purple-700 mb-4">สรุปสเปคกล่อง</h3>
          <div className="space-y-2 text-xs">
            {collectedData.product_type && <Row label="ประเภทสินค้า" value={collectedData.product_type} />}
            {collectedData.box_type && <Row label="ประเภทกล่อง" value={BOX_TYPE_LABELS[collectedData.box_type] || collectedData.box_type} />}
            {collectedData.material && <Row label="วัสดุ" value={collectedData.material} />}
            {collectedData.dimensions && (
              <Row label="ขนาด" value={`${collectedData.dimensions.width} x ${collectedData.dimensions.length} x ${collectedData.dimensions.height} cm`} />
            )}
            {collectedData.quantity && <Row label="จำนวน" value={`${collectedData.quantity.toLocaleString()} ชิ้น`} />}
            {collectedData.flute_type && <Row label="ลอน" value={collectedData.flute_type} />}
          </div>
        </div>

        {/* Pricing */}
        <div className="bg-white rounded-2xl border border-purple-100 p-6 shadow-sm">
          <h3 className="text-sm font-display font-semibold text-purple-700 mb-4">ราคา</h3>
          <div className="space-y-2 text-xs">
            {pricing.box_base != null && <Row label="ค่ากล่อง" value={`฿${pricing.box_base.toLocaleString()}`} />}
            {pricing.inner != null && pricing.inner > 0 && <Row label="Inner" value={`฿${pricing.inner.toLocaleString()}`} />}
            {pricing.coatings != null && pricing.coatings > 0 && <Row label="Coatings" value={`฿${pricing.coatings.toLocaleString()}`} />}
            {pricing.stampings != null && pricing.stampings > 0 && <Row label="Stampings" value={`฿${pricing.stampings.toLocaleString()}`} />}
            <hr className="border-purple-100 my-2" />
            <Row label="Subtotal" value={`฿${pricing.subtotal?.toLocaleString()}`} />
            <Row label="VAT 7%" value={`฿${pricing.vat?.toLocaleString()}`} />
            <div className="flex justify-between items-center pt-2">
              <span className="text-purple-700 font-semibold">รวมทั้งสิ้น</span>
              <span className="text-purple-700 font-bold text-base">฿{grandTotal.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Deposit */}
        <div className="bg-purple-50 rounded-2xl border border-purple-200 p-6">
          <h3 className="text-sm font-display font-semibold text-purple-700 mb-2">มัดจำ 50%</h3>
          <p className="text-2xl font-bold text-purple-700 mb-4">฿{depositAmount.toLocaleString()}</p>

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
                    {slipFile ? `${slipFile.name}` : 'คลิกเพื่ออัปโหลดสลิป'}
                  </div>
                </div>
                <input type="file" accept="image/*" onChange={(e) => setSlipFile(e.target.files[0])} className="hidden" />
              </label>
            </div>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-xs">
            {error}
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={uploading}
          className="w-full py-3.5 rounded-xl bg-purple-700 hover:bg-purple-800 text-white font-display font-semibold transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] shadow-sm"
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
      <span className="text-purple-400">{label}</span>
      <span className="text-purple-800 font-medium">{value}</span>
    </div>
  );
}
