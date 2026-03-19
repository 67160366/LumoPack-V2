/**
 * SummaryPanel — แสดง Requirement Summary (Light Purple Theme)
 */

import React from 'react';
import { useChatbot, STEP_LABELS } from '../../contexts/ChatbotContext';

export default function SummaryPanel() {
  const { collectedData, currentStep, sessionId, isComplete } = useChatbot();

  const hasData = Object.keys(collectedData).length > 0;

  return (
    <div className="h-full overflow-y-auto scrollbar-thin space-y-4 px-6 py-5">
      {/* Header */}
      <div>
        <h4 className="text-xs font-display font-semibold text-purple-600 uppercase tracking-wider mb-1">
          Requirement Summary
        </h4>
        <p className="text-xs text-purple-400 font-body">
          {sessionId ? `Session: ${sessionId.slice(0, 16)}...` : 'ยังไม่มี session'}
        </p>
      </div>

      {/* Step Progress */}
      <StepProgress currentStep={currentStep} />

      <hr className="border-purple-100" />

      {/* Collected Data */}
      {!hasData ? (
        <div className="text-center py-8">
          <div className="text-2xl mb-2">📋</div>
          <p className="text-xs text-purple-400">
            เริ่มแชทเพื่อเก็บข้อมูล Requirement
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <SummarySection title="📦 โครงสร้างกล่อง" step="1-6">
            <DataRow label="ประเภทสินค้า" value={formatProductType(collectedData.product_type)} />
            <DataRow label="ประเภทกล่อง" value={formatBoxType(collectedData.box_type)} />
            <DataRow label="วัสดุ" value={formatMaterial(collectedData.material)} />
            <DataRow label="Inner" value={formatInner(collectedData.inner)} />
            <DataRow label="ขนาด" value={formatDimensions(collectedData.dimensions)} />
            <DataRow label="จำนวนผลิต" value={collectedData.quantity ? `${collectedData.quantity.toLocaleString()} ชิ้น` : null} />
          </SummarySection>

          {currentStep >= 7 && (
            <SummarySection title="🎨 การออกแบบ" step="7-10">
              <DataRow label="Mood & Tone" value={collectedData.mood_tone} />
              <DataRow label="โลโก้" value={collectedData.has_logo === true ? 'มี' : collectedData.has_logo === false ? 'ไม่มี' : null} />
              <DataRow label="ตำแหน่งโลโก้" value={formatLogoPositions(collectedData.logo_positions)} />
              <DataRow label="ลูกเล่นพิเศษ" value={formatEffects(collectedData.special_effects)} />
            </SummarySection>
          )}

          {currentStep >= 12 && collectedData.pricing && (
            <SummarySection title="💰 ราคา" step="12">
              <DataRow label="ราคารวม" value={collectedData.pricing?.grand_total ? `฿${collectedData.pricing.grand_total.toLocaleString()}` : null} />
            </SummarySection>
          )}
        </div>
      )}

      {/* Complete badge */}
      {isComplete && (
        <div className="mt-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-center">
          <div className="text-emerald-600 text-sm font-display font-semibold">
            ✅ คำสั่งซื้อยืนยันแล้ว
          </div>
          <div className="text-emerald-500 text-xs mt-1">
            ทีมงานจะติดต่อกลับภายใน 24 ชั่วโมง
          </div>
        </div>
      )}
    </div>
  );
}


// ===================================
// Sub-components
// ===================================

function StepProgress({ currentStep }) {
  const phases = [
    { label: 'โครงสร้าง', steps: [1, 2, 3, 4, 5, 6], num: '1' },
    { label: 'ออกแบบ', steps: [7, 8, 9, 10], num: '2' },
    { label: 'สรุป', steps: [11, 12, 13, 14], num: '3' },
  ];

  return (
    <div className="flex items-center gap-1">
      {phases.map((phase, i) => {
        const isActive = phase.steps.includes(currentStep);
        const isDone = currentStep > Math.max(...phase.steps);

        return (
          <React.Fragment key={i}>
            <div
              className={`
                flex-1 py-2 px-2 rounded-lg text-center text-xs font-display font-medium transition-colors duration-200
                ${isDone
                  ? 'bg-purple-100 text-purple-700'
                  : isActive
                    ? 'bg-purple-50 text-purple-600 border border-purple-200'
                    : 'bg-purple-50/30 text-purple-300'
                }
              `}
            >
              <span className="block text-xs font-mono mb-0.5">{phase.num}</span>
              {phase.label}
            </div>
            {i < phases.length - 1 && (
              <div className={`w-3 h-px ${isDone ? 'bg-purple-300' : 'bg-purple-100'}`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

function SummarySection({ title, step, children }) {
  return (
    <div className="bg-purple-50 rounded-xl p-3 border border-purple-100">
      <div className="flex items-center justify-between mb-2">
        <h5 className="text-xs font-display font-semibold text-purple-700">{title}</h5>
        <span className="text-xs text-purple-400 font-mono">Step {step}</span>
      </div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function DataRow({ label, value }) {
  if (!value) return null;
  return (
    <div className="flex justify-between items-start gap-2">
      <span className="text-xs text-purple-400 flex-shrink-0">{label}</span>
      <span className="text-xs text-purple-800 text-right font-medium">{value}</span>
    </div>
  );
}


// ===================================
// Formatters
// ===================================

function formatProductType(val) {
  const map = { general: 'สินค้าทั่วไป', non_food: 'Non-Food', food_grade: 'Food Grade', cosmetic: 'เครื่องสำอาง' };
  return map[val] || val || null;
}

function formatBoxType(val) {
  const map = {
    rsc: 'RSC (กล่องลูกฟูก)', die_cut: 'Die-cut (ฝาเสียบ)',
    heart: 'Heart (หัวใจ)', star: 'Star (ดาว)', bear: 'Bear (หมี)',
    circle: 'Circle (ทรงกลม)', bow: 'Bow (ซัพพอร์ท)',
  };
  return map[val] || val || null;
}

function formatMaterial(val) {
  if (!val) return null;
  const map = {
    corrugated_3layer: 'ลูกฟูก 3 ชั้น', corrugated_5layer: 'ลูกฟูก 5 ชั้น',
    art_300gsm: 'อาร์ต 300 แกรม', art_350gsm: 'อาร์ต 350 แกรม',
    duplex_300gsm: 'ดูเพล็กซ์ 300 แกรม', kraft_250gsm: 'คราฟต์ 250 แกรม',
  };
  return map[val] || val;
}

function formatInner(val) {
  if (!val) return null;
  if (typeof val === 'string') return val === 'none' ? 'ไม่มี' : val;
  if (val?.type) return val.type;
  return null;
}

function formatDimensions(dims) {
  if (!dims) return null;
  return `${dims.width || '?'} × ${dims.length || '?'} × ${dims.height || '?'} cm`;
}

function formatLogoPositions(positions) {
  if (!positions || positions.length === 0) return null;
  return positions.join(', ');
}

function formatEffects(effects) {
  if (!effects || effects.length === 0) return null;
  if (typeof effects === 'string') return effects === 'none' ? 'ไม่มี' : effects;
  return effects.map(e => e.type || e).join(', ');
}
