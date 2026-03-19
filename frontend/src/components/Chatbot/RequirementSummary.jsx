/**
 * RequirementSummary — Card สรุปสเปคเบื้องต้นใน chat
 */

export default function RequirementSummary({ data }) {
  if (!data) return null;

  const formatDimensions = (dims) => {
    if (!dims) return 'ยังไม่ระบุ';
    return `${dims.width || '?'} x ${dims.length || '?'} x ${dims.height || '?'} cm`;
  };

  return (
    <div className="w-full max-w-[300px] bg-white rounded-xl border border-purple-100 overflow-hidden animate-slide-up">
      <div className="px-4 py-3 border-b border-purple-50">
        <h4 className="font-display font-semibold text-purple-800 text-xs">สรุปสเปคเบื้องต้น</h4>
      </div>

      <div className="p-4 space-y-2.5">
        <SummaryRow label="ประเภทสินค้า" value={data.product_type || '-'} />
        <SummaryRow label="ทรงกล่อง" value={data.box_type || '-'} />
        <SummaryRow label="ขนาด (กxยxส)" value={formatDimensions(data.dimensions)} />
        <SummaryRow label="วัสดุ" value={data.material || '-'} />
        <SummaryRow label="จำนวนผลิต" value={data.quantity ? `${data.quantity.toLocaleString()} ชิ้น` : '-'} />
      </div>
    </div>
  );
}

function SummaryRow({ label, value }) {
  return (
    <div className="flex justify-between items-start gap-4 text-sm">
      <span className="text-purple-400 shrink-0">{label}</span>
      <span className="text-purple-800 font-medium text-right break-words">{value}</span>
    </div>
  );
}
