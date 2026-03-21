/**
 * Sidebar UI for image upload, gallery, inner/outer toggle, placed images list.
 *
 * @param {Object} props
 * @param {Object} props.placement - return value from useImagePlacement()
 * @param {string} [props.accentColor='#7c3aed']
 * @param {Function} [props.onViewIn3D] - callback for "View in 3D" button
 * @param {boolean} [props.show3DButton=true]
 * @param {string} [props.currentView='2d'] - '2d' | '3d'
 */
export default function ImageUploadPanel({
  placement,
  accentColor = '#7c3aed',
  onViewIn3D,
  show3DButton = true,
  currentView = '2d',
}) {
  const {
    uploadedImages, selectedImageId, setSelectedImageId,
    handleImageUpload, removeUploadedImage, fileInputRef,
    placedImages, activeImgId, setActiveImgId,
    activeSide, setActiveSide,
    removePlacedImage, clearAllPlaced,
  } = placement;

  return (
    <div style={{ fontSize: 11, background: '#fff', border: '1px solid #ccc', borderRadius: 8, overflow: 'visible', flexShrink: 0 }}>
      <div style={{ padding: '6px 10px', background: accentColor, color: '#fff', fontWeight: 700, fontSize: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>วางรูปบนกล่อง</span>
        {placedImages.length > 0 && (
          <button onClick={clearAllPlaced} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', fontSize: 9, padding: '2px 8px', borderRadius: 4, cursor: 'pointer' }}>
            ล้างทั้งหมด
          </button>
        )}
      </div>
      <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {/* Upload */}
        <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleImageUpload} style={{ display: 'none' }} />
        <button onClick={() => fileInputRef.current?.click()} style={{ padding: 10, border: '2px dashed #bbb', borderRadius: 8, cursor: 'pointer', background: '#fafafa', fontSize: 12, fontWeight: 600, color: '#666' }}>
          + อัปโหลดรูป
        </button>

        {/* Image gallery */}
        {uploadedImages.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {uploadedImages.map(img => (
              <div key={img.id} style={{ position: 'relative' }}>
                <div
                  onClick={() => setSelectedImageId(selectedImageId === img.id ? null : img.id)}
                  style={{
                    width: 72, height: 72, flexShrink: 0, borderRadius: 6, overflow: 'hidden', cursor: 'pointer',
                    background: '#e5e7eb',
                    border: selectedImageId === img.id ? `3px solid ${accentColor}` : '2px solid #ddd',
                    boxShadow: selectedImageId === img.id ? `0 0 0 2px ${accentColor}40` : 'none',
                  }}
                >
                  <img src={img.url} alt={img.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); removeUploadedImage(img.id); }}
                  style={{ position: 'absolute', top: -5, right: -5, width: 18, height: 18, borderRadius: 9, border: 'none', background: '#ef4444', color: '#fff', fontSize: 10, cursor: 'pointer', lineHeight: '18px', padding: 0 }}
                >
                  x
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Inner/Outer toggle */}
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={() => setActiveSide('outer')} style={{ flex: 1, padding: 6, border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 700, background: activeSide === 'outer' ? accentColor : '#e5e7eb', color: activeSide === 'outer' ? '#fff' : '#333' }}>
            ด้านนอก
          </button>
          <button onClick={() => setActiveSide('inner')} style={{ flex: 1, padding: 6, border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 700, background: activeSide === 'inner' ? accentColor : '#e5e7eb', color: activeSide === 'inner' ? '#fff' : '#333' }}>
            ด้านใน
          </button>
        </div>

        {selectedImageId ? (
          <div style={{ fontSize: 11, color: accentColor, fontWeight: 600, background: `${accentColor}15`, borderRadius: 6, padding: 8, textAlign: 'center' }}>
            คลิกบน dieline เพื่อวางรูป
          </div>
        ) : activeImgId ? (
          <div style={{ fontSize: 10, color: '#666', background: `${accentColor}15`, borderRadius: 6, padding: 6 }}>
            ลากเลื่อน · Scroll ย่อ/ขยาย · ลากมุมปรับขนาด
          </div>
        ) : uploadedImages.length > 0 ? (
          <div style={{ fontSize: 10, color: '#888' }}>เลือกรูปก่อน แล้วคลิกบน dieline</div>
        ) : null}

        {/* Placed images list */}
        {placedImages.filter(i => i.side === activeSide).length > 0 && (
          <div style={{ fontSize: 10, background: '#f8f9fa', borderRadius: 6, padding: 6 }}>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>วางแล้ว ({activeSide === 'outer' ? 'นอก' : 'ใน'}):</div>
            {placedImages.filter(i => i.side === activeSide).map(img => (
              <div key={img.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '3px 4px', background: activeImgId === img.id ? `${accentColor}15` : 'transparent', borderRadius: 4 }}>
                <span onClick={() => setActiveImgId(img.id)} style={{ cursor: 'pointer', flex: 1 }}>
                  {Math.round(img.w)}x{Math.round(img.h)} mm
                </span>
                <button onClick={() => removePlacedImage(img.id)} style={{ border: 'none', background: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 12, padding: '0 4px' }}>x</button>
              </div>
            ))}
          </div>
        )}

        {/* Save → switch to 3D */}
        {show3DButton && placedImages.length > 0 && currentView === '2d' && onViewIn3D && (
          <button
            onClick={onViewIn3D}
            style={{ padding: 8, border: 'none', borderRadius: 8, cursor: 'pointer', background: '#43a047', color: '#fff', fontWeight: 700, fontSize: 12 }}
          >
            ดูบน 3D →
          </button>
        )}
      </div>
    </div>
  );
}
