/**
 * useCorrugatedTexture — Procedural corrugated paper texture
 *
 * สร้าง texture ลูกฟูกด้วย Canvas API (ไม่ต้องใช้ไฟล์รูป)
 * - แถบลอน (flute ridges) สลับสว่าง/มืด
 * - noise เล็กน้อยให้ดูเหมือนกระดาษจริง
 */

import { useMemo } from 'react';
import * as THREE from 'three';

const SIZE = 512;

function generateCorrugatedCanvas(baseColor = '#c9a06c') {
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d');

  // Fill base color
  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, SIZE, SIZE);

  // Parse base color to manipulate brightness
  const temp = document.createElement('canvas').getContext('2d');
  temp.fillStyle = baseColor;
  temp.fillRect(0, 0, 1, 1);
  const [r, g, b] = temp.getImageData(0, 0, 1, 1).data;

  // Flute ridges — alternating light/dark horizontal bands
  const fluteHeight = 8; // px per ridge
  for (let y = 0; y < SIZE; y++) {
    const band = Math.floor(y / fluteHeight);
    const t = (y % fluteHeight) / fluteHeight;
    // Sine curve for smooth ridge shading
    const factor = Math.sin(t * Math.PI) * 0.12;
    const sign = band % 2 === 0 ? 1 : -1;
    const brightness = sign * factor;

    const rr = Math.min(255, Math.max(0, r + brightness * 255));
    const gg = Math.min(255, Math.max(0, g + brightness * 255));
    const bb = Math.min(255, Math.max(0, b + brightness * 255));

    ctx.fillStyle = `rgb(${rr},${gg},${bb})`;
    ctx.fillRect(0, y, SIZE, 1);
  }

  // Paper grain noise
  const imageData = ctx.getImageData(0, 0, SIZE, SIZE);
  const pixels = imageData.data;
  for (let i = 0; i < pixels.length; i += 4) {
    const noise = (Math.random() - 0.5) * 18;
    pixels[i] = Math.min(255, Math.max(0, pixels[i] + noise));
    pixels[i + 1] = Math.min(255, Math.max(0, pixels[i + 1] + noise));
    pixels[i + 2] = Math.min(255, Math.max(0, pixels[i + 2] + noise));
  }
  ctx.putImageData(imageData, 0, 0);

  return canvas;
}

export default function useCorrugatedTexture(baseColor = '#c9a06c') {
  const texture = useMemo(() => {
    const canvas = generateCorrugatedCanvas(baseColor);
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(2, 2);
    return tex;
  }, [baseColor]);

  return texture;
}
