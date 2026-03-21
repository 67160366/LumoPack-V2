/**
 * SVG overlay for placed images on a dieline.
 * Renders inside an <svg> — returns a <g> group.
 *
 * @param {Object} props
 * @param {Object} props.placement - return value from useImagePlacement()
 * @param {Object} props.viewBox - current SVG viewBox {x, y, w, h} for stroke scaling
 * @param {string} [props.accentColor='#7c3aed']
 */
export default function DielineImageOverlay({ placement, viewBox: vb, accentColor = '#7c3aed' }) {
  const { placedImages, activeImgId, activeSide, dragState, startDrag, handleImageWheel } = placement;
  const hs = vb.w * 0.005;

  return (
    <g>
      {placedImages.filter(im => im.side === activeSide).map(im => {
        const isActive = activeImgId === im.id;
        const sx = im.x;
        const sy = -(im.y + im.h); // dieline Y → SVG Y

        return (
          <g key={im.id}>
            <image
              x={sx} y={sy} width={im.w} height={im.h}
              href={im.url}
              preserveAspectRatio="none"
              opacity={isActive ? 0.9 : 0.8}
              style={{ cursor: dragState?.id === im.id ? 'grabbing' : 'grab' }}
              onMouseDown={(e) => startDrag(e, im.id, 'move')}
              onWheel={(e) => handleImageWheel(e, im.id)}
            />

            {isActive && (
              <>
                <rect x={sx} y={sy} width={im.w} height={im.h}
                  fill="none" stroke={accentColor} strokeWidth={vb.w * 0.002}
                  style={{ pointerEvents: 'none' }}
                />
                {[
                  { cx: sx, cy: sy, cur: 'nwse-resize' },
                  { cx: sx + im.w, cy: sy, cur: 'nesw-resize' },
                  { cx: sx, cy: sy + im.h, cur: 'nesw-resize' },
                  { cx: sx + im.w, cy: sy + im.h, cur: 'nwse-resize' },
                ].map(({ cx, cy, cur }, i) => (
                  <circle key={i} cx={cx} cy={cy} r={hs}
                    fill="#fff" stroke={accentColor} strokeWidth={hs * 0.4}
                    style={{ cursor: cur }}
                    onMouseDown={(e) => startDrag(e, im.id, 'resize')}
                  />
                ))}
                <text
                  x={sx + im.w / 2} y={sy - hs * 2}
                  textAnchor="middle" fill={accentColor} fontSize={vb.w * 0.01}
                  fontFamily="monospace" fontWeight="700"
                  style={{ pointerEvents: 'none' }}
                >
                  {Math.round(im.w)}x{Math.round(im.h)}
                </text>
              </>
            )}
          </g>
        );
      })}
    </g>
  );
}
