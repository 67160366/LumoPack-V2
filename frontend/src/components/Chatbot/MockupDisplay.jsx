/**
 * MockupDisplay — Card แสดงพรีวิวรูปทรงกล่องใน chat
 */
const BOX_TYPE_LABELS = {
  rsc: 'RSC (กล่องลูกฟูก)',
  die_cut: 'Die-cut (ฝาเสียบ)',
  tube_lock: 'Tube Lock',
  self_lock: 'Self-Lock',
  heart: 'Heart (หัวใจ)',
};

export default function MockupDisplay({ boxType, dimensions }) {
  const dims = dimensions && dimensions.width && dimensions.length && dimensions.height
    ? dimensions
    : null;

  return (
    <div className="w-full max-w-[300px] bg-white rounded-xl border border-purple-100 overflow-hidden animate-slide-up">
      <div className="px-4 py-3 flex items-center justify-between">
        <h4 className="font-display font-semibold text-purple-800 text-xs">พรีวิวรูปทรงกล่อง</h4>
        <span className="text-xs text-purple-400 font-mono">
          {BOX_TYPE_LABELS[boxType] || boxType || 'standard'}
        </span>
      </div>

      <div className="px-4 pb-4 space-y-3">
        <div className="flex items-center gap-3 py-2">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8 text-purple-400 flex-shrink-0">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
            <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
            <line x1="12" y1="22.08" x2="12" y2="12"></line>
          </svg>
          <div>
            <p className="text-sm font-medium text-purple-800">
              {boxType ? `ทรง ${BOX_TYPE_LABELS[boxType] || boxType}` : 'ทรงกล่องมาตรฐาน'}
            </p>
            {dims ? (
              <p className="text-xs text-purple-500 font-mono mt-0.5">
                {dims.width} x {dims.length} x {dims.height} cm
              </p>
            ) : (
              <p className="text-xs text-purple-400 mt-0.5">รอการระบุขนาด...</p>
            )}
          </div>
        </div>

        <p className="text-xs text-purple-400 border-t border-purple-50 pt-2.5">
          หมุนดู 3D แบบเต็มๆ ได้ที่จอตรงกลาง
        </p>
      </div>
    </div>
  );
}
