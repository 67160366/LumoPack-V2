/**
 * useCardboardNoise — Shared procedural cardboard noise texture
 *
 * Canvas-generated paper grain noise (no image file needed).
 * Cached at module level so all Panel instances share one texture.
 */

import { useState, useEffect, useMemo } from 'react';
import * as THREE from 'three';

const SIZE = 512;

// Parse hex color to [r, g, b]
function hexToRGB(hex) {
  const c = hex.replace('#', '');
  return [
    parseInt(c.substring(0, 2), 16),
    parseInt(c.substring(2, 4), 16),
    parseInt(c.substring(4, 6), 16),
  ];
}

function generateCardboardCanvas(baseColor = '#c4a882') {
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d');

  const [br, bg, bb] = hexToRGB(baseColor);

  // Fill base
  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, SIZE, SIZE);

  // Subtle horizontal fiber lines (corrugated grain)
  for (let y = 0; y < SIZE; y++) {
    const fiberStrength = Math.sin(y * 0.8) * 4 + Math.sin(y * 2.3) * 2;
    const rr = Math.min(255, Math.max(0, br + fiberStrength));
    const gg = Math.min(255, Math.max(0, bg + fiberStrength));
    const bbb = Math.min(255, Math.max(0, bb + fiberStrength));
    ctx.fillStyle = `rgb(${rr},${gg},${bbb})`;
    ctx.fillRect(0, y, SIZE, 1);
  }

  // Paper grain noise
  const imageData = ctx.getImageData(0, 0, SIZE, SIZE);
  const pixels = imageData.data;
  for (let i = 0; i < pixels.length; i += 4) {
    const noise = (Math.random() - 0.5) * 22;
    pixels[i] = Math.min(255, Math.max(0, pixels[i] + noise));
    pixels[i + 1] = Math.min(255, Math.max(0, pixels[i + 1] + noise));
    pixels[i + 2] = Math.min(255, Math.max(0, pixels[i + 2] + noise));
  }
  ctx.putImageData(imageData, 0, 0);

  return canvas;
}

// Module-level cache per base color
const _cache = {};

function getOrCreate(baseColor) {
  if (_cache[baseColor]) return _cache[baseColor];
  const canvas = generateCardboardCanvas(baseColor);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  _cache[baseColor] = tex;
  return tex;
}

/**
 * Returns a shared procedural cardboard noise CanvasTexture.
 * @param {string} baseColor - hex color (default warm brown)
 * @param {number} repeatX - texture repeat X based on panel size
 * @param {number} repeatY - texture repeat Y based on panel size
 */
export default function useCardboardNoise(baseColor = '#c4a882', repeatX = 2, repeatY = 2) {
  const baseTex = useMemo(() => getOrCreate(baseColor), [baseColor]);

  // Clone repeat settings per panel (sharing the same canvas source)
  const tex = useMemo(() => {
    const t = baseTex.clone();
    t.source = baseTex.source;
    t.repeat.set(repeatX, repeatY);
    t.needsUpdate = true;
    return t;
  }, [baseTex, repeatX, repeatY]);

  return tex;
}

/**
 * Non-hook version for use in useMemo or non-component contexts.
 */
export function getCardboardNoiseTexture(baseColor = '#c4a882') {
  return getOrCreate(baseColor);
}
