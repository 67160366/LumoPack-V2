/**
 * Generate per-panel texture data URLs from placed images.
 *
 * @param {Array} placedImages - [{id, url, x, y, w, h, side}]
 * @param {Array} panelZones - [{id, x, y, w, h}] in dieline coords (Y up)
 * @param {Object} dielineBounds - {minX, maxX, minY, maxY}
 * @param {Object} [options]
 * @param {number} [options.pixelsPerMm=3]
 * @param {string} [options.bgColor='#c4a882']
 * @returns {Promise<Object>} { [panelId]: { outer?: dataUrl, inner?: dataUrl } }
 */
export async function generatePanelTextures(placedImages, panelZones, dielineBounds, options = {}) {
  const { pixelsPerMm = 3, bgColor = '#c4a882' } = options;
  const PX = pixelsPerMm;
  const { minX, maxX, minY, maxY } = dielineBounds;
  const cW = Math.round((maxX - minX) * PX);
  const cH = Math.round((maxY - minY) * PX);

  const result = {};

  for (const side of ['outer', 'inner']) {
    const imgs = placedImages.filter(i => i.side === side);
    if (!imgs.length) continue;

    // Draw all images for this side onto one canvas
    const canvas = document.createElement('canvas');
    canvas.width = cW;
    canvas.height = cH;
    const ctx = canvas.getContext('2d');

    for (const im of imgs) {
      const el = await new Promise((res, rej) => {
        const i = new Image();
        i.onload = () => res(i);
        i.onerror = rej;
        i.src = im.url;
      });
      // Dieline → canvas coords (flip Y)
      const px = (im.x - minX) * PX;
      const py = (maxY - im.y - im.h) * PX;
      ctx.drawImage(el, px, py, im.w * PX, im.h * PX);
    }

    // Extract per zone
    for (const zone of panelZones) {
      const hasOverlap = imgs.some(im =>
        im.x < zone.x + zone.w && im.x + im.w > zone.x &&
        im.y < zone.y + zone.h && im.y + im.h > zone.y
      );
      if (!hasOverlap) continue;

      const zx = Math.round((zone.x - minX) * PX);
      const zy = Math.round((maxY - zone.y - zone.h) * PX);
      const zw = Math.round(zone.w * PX);
      const zh = Math.round(zone.h * PX);

      const pc = document.createElement('canvas');
      pc.width = Math.max(1, zw);
      pc.height = Math.max(1, zh);
      const pctx = pc.getContext('2d');
      // Fill with cardboard color so empty areas aren't black
      pctx.fillStyle = bgColor;
      pctx.fillRect(0, 0, pc.width, pc.height);
      pctx.drawImage(canvas, zx, zy, zw, zh, 0, 0, pc.width, pc.height);

      if (!result[zone.id]) result[zone.id] = {};
      result[zone.id][side] = pc.toDataURL();
    }
  }

  return result;
}
