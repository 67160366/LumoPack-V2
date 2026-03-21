import { useState, useEffect } from 'react';
import * as THREE from 'three';

/**
 * Load a THREE.Texture from a blob/data URL.
 * @param {string|null} url
 * @param {boolean} [flipY=true] - false for BoxGeometry -y face (outer)
 * @returns {THREE.Texture|null}
 */
export default function useImageTexture(url, flipY = true) {
  const [tex, setTex] = useState(null);
  useEffect(() => {
    if (!url) { setTex(null); return; }
    const img = new Image();
    let cancelled = false;
    img.onload = () => {
      if (cancelled) return;
      const t = new THREE.Texture(img);
      t.flipY = flipY;
      t.needsUpdate = true;
      t.colorSpace = THREE.SRGBColorSpace;
      setTex(t);
    };
    img.src = url;
    return () => { cancelled = true; img.onload = null; };
  }, [url, flipY]);
  return tex;
}
