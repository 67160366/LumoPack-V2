/**
 * PricingQuote — Card ใบเสนอราคาเบื้องต้นใน chat
 */

export default function PricingQuote({ pricing }) {
  if (!pricing) return null;

  const formatPrice = (price) => {
    if (price === null || price === undefined) return '฿0.00';
    const num = typeof price === 'object' ? (price.total_price || price.total || 0) : price;
    return `฿${Number(num).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <div className="w-full max-w-[300px] bg-white rounded-xl border border-teal-100 overflow-hidden animate-slide-up">
      <div className="px-4 py-3 border-b border-teal-50">
        <h4 className="font-display font-semibold text-teal-800 text-xs">ใบเสนอราคาเบื้องต้น</h4>
      </div>

      <div className="p-4 space-y-2">
        {pricing.box_base && <Row label="ค่าโครงสร้างกล่อง" value={formatPrice(pricing.box_base)} />}
        {pricing.inner && <Row label="ไส้กล่อง (Inner)" value={formatPrice(pricing.inner)} />}

        {pricing.coatings && pricing.coatings.length > 0 && pricing.coatings.map((c, idx) => (
          <Row key={`coat-${idx}`} label={`เคลือบ${c.name || ''}`} value={formatPrice(c)} />
        ))}
        {pricing.stampings && pricing.stampings.length > 0 && pricing.stampings.map((s, idx) => (
          <Row key={`stamp-${idx}`} label={`ปั๊ม${s.name || ''}`} value={formatPrice(s)} />
        ))}

        <div className="border-t border-dashed border-teal-100 my-1" />

        <Row label="ราคาก่อนรวมภาษี" value={formatPrice(pricing.subtotal)} />
        <Row label="VAT 7%" value={formatPrice(pricing.vat)} muted />
      </div>

      <div className="bg-teal-600 px-4 py-3 flex justify-between items-center text-white">
        <span className="text-sm text-teal-100">ราคาสุทธิ</span>
        <span className="font-display font-bold text-lg">{formatPrice(pricing.grand_total)}</span>
      </div>
    </div>
  );
}

function Row({ label, value, muted }) {
  return (
    <div className="flex justify-between items-center text-sm">
      <span className={muted ? 'text-teal-400' : 'text-teal-600'}>{label}</span>
      <span className={`font-medium ${muted ? 'text-teal-500' : 'text-teal-800'}`}>{value}</span>
    </div>
  );
}
