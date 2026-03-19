/**
 * Animation phases & easing utilities
 * Shared across all box types (contour-based and panel-based)
 */

/** Smoothstep easing: t^2 * (3 - 2t) */
export function getStage(p, start, end) {
  if (p <= start) return 0;
  if (p >= end) return 1;
  const t = (p - start) / (end - start);
  return t * t * (3 - 2 * t);
}

/**
 * Contour-based box animation phases (heart, star, bear, circle)
 * 5 phases with support, 4 without
 */
export function getContourPhases(progress, hasSupport = false) {
  if (hasSupport) {
    return {
      fold:    getStage(progress, 0.00, 0.20),
      roll:    getStage(progress, 0.20, 0.40),
      support: getStage(progress, 0.40, 0.60),
      lift:    getStage(progress, 0.60, 0.80),
      close:   getStage(progress, 0.80, 1.00),
    };
  }
  return {
    fold:    getStage(progress, 0.00, 0.25),
    roll:    getStage(progress, 0.25, 0.50),
    support: 0,
    lift:    getStage(progress, 0.50, 0.75),
    close:   getStage(progress, 0.75, 1.00),
  };
}

/**
 * Panel-based box animation phases (bow/mailer with support)
 */
export function getBowPhases(progress, hasSupport = false) {
  if (hasSupport) {
    return {
      side:     getStage(progress, 0.05, 0.15),
      tab:      getStage(progress, 0.15, 0.25),
      fb:       getStage(progress, 0.25, 0.35),
      suppFold: getStage(progress, 0.35, 0.45),
      suppDrop: getStage(progress, 0.45, 0.55),
      ear:      getStage(progress, 0.55, 0.65),
      lid:      getStage(progress, 0.65, 0.85),
      tuck:     getStage(progress, 0.85, 1.00),
      lift:     getStage(progress, 0.00, 0.10) * 0.05,
    };
  }
  return {
    side:     getStage(progress, 0.05, 0.20),
    tab:      getStage(progress, 0.20, 0.40),
    fb:       getStage(progress, 0.35, 0.55),
    suppFold: 0,
    suppDrop: 0,
    ear:      getStage(progress, 0.50, 0.70),
    lid:      getStage(progress, 0.65, 0.85),
    tuck:     getStage(progress, 0.85, 1.00),
    lift:     getStage(progress, 0.00, 0.10) * 0.05,
  };
}

/** Fold step labels for contour shapes */
export function getContourSteps(hasSupport) {
  const steps = [
    'พับตั้งผนังกล่อง',
    'ม้วนเข้าเป็นรูปทรง',
  ];
  if (hasSupport) steps.push('ใส่แผ่นซัพพอร์ท');
  steps.push('ยกและพลิกฝา', 'สวมฝาปิดกล่อง');
  return steps;
}

/** Fold step labels for bow box */
export function getBowSteps(hasSupport) {
  const steps = [
    'กางกล่องแบนราบ',
    'ตั้งผนังด้านข้าง',
    'พับปีกยึดด้านข้าง',
    'พับผนังหน้า-หลัง',
  ];
  if (hasSupport) steps.push('ใส่ซัพพอร์ทเจาะรู');
  steps.push('พับปีกฝากล่อง', 'ปิดฝากล่อง', 'เสียบตัวล็อค');
  return steps;
}

/** Get active step index from progress */
export function getContourStepIndex(progress, hasSupport) {
  const count = hasSupport ? 5 : 4;
  const segSize = 1 / count;
  return Math.min(count - 1, Math.floor(progress / segSize));
}

export function getBowStepIndex(progress, hasSupport) {
  if (hasSupport) {
    if (progress === 0) return 0;
    if (progress < 0.15) return 1;
    if (progress < 0.25) return 2;
    if (progress < 0.35) return 3;
    if (progress < 0.55) return 4;
    if (progress < 0.65) return 5;
    if (progress < 0.85) return 6;
    return 7;
  }
  if (progress === 0) return 0;
  if (progress < 0.20) return 1;
  if (progress < 0.40) return 2;
  if (progress < 0.55) return 3;
  if (progress < 0.70) return 4;
  if (progress < 0.85) return 5;
  return 6;
}
