import { useState, useRef, useCallback, useEffect } from 'react';

/**
 * Core state machine for image upload, placement, drag, resize on an SVG dieline.
 *
 * @param {Object} options
 * @param {React.RefObject} options.svgRef - ref to the <svg> element
 * @param {Object|null} options.viewBox - current SVG viewBox {x, y, w, h}
 * @param {number} [options.defaultPlaceWidth=300] - default width (mm) when placing
 */
export default function useImagePlacement({ svgRef, viewBox, defaultPlaceWidth = 300 }) {
  const [uploadedImages, setUploadedImages] = useState([]);
  const [selectedImageId, setSelectedImageId] = useState(null);
  const [placedImages, setPlacedImages] = useState([]);
  const [activeImgId, setActiveImgId] = useState(null);
  const [activeSide, setActiveSide] = useState('outer');
  const [dragState, setDragState] = useState(null);
  const fileInputRef = useRef(null);

  // Upload with natural dimensions preload
  const handleImageUpload = useCallback((e) => {
    Array.from(e.target.files).forEach(f => {
      const url = URL.createObjectURL(f);
      const im = new Image();
      im.onload = () => {
        const entry = {
          id: Date.now() + '_' + Math.random().toString(36).slice(2),
          name: f.name, url, natW: im.naturalWidth, natH: im.naturalHeight,
        };
        setUploadedImages(prev => [...prev, entry]);
        setSelectedImageId(entry.id);
      };
      im.src = url;
    });
    e.target.value = '';
  }, []);

  const removeUploadedImage = useCallback((imgId) => {
    setUploadedImages(prev => prev.filter(i => i.id !== imgId));
    setSelectedImageId(prev => prev === imgId ? null : prev);
  }, []);

  // SVG coords helper
  const svgToLocal = useCallback((e) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    const v = viewBox || { x: 0, y: 0, w: 1, h: 1 };
    return {
      x: v.x + (e.clientX - rect.left) / rect.width * v.w,
      y: v.y + (e.clientY - rect.top) / rect.height * v.h,
    };
  }, [svgRef, viewBox]);

  // Place a gallery image on dieline at click position
  const handleDielinePlace = useCallback((e) => {
    const gallery = uploadedImages.find(i => i.id === selectedImageId);
    if (!gallery) return;
    e.stopPropagation();
    const pt = svgToLocal(e);
    const placeW = defaultPlaceWidth;
    const placeH = placeW * (gallery.natH / gallery.natW);
    const placed = {
      id: Date.now() + '_' + Math.random().toString(36).slice(2),
      url: gallery.url,
      x: pt.x - placeW / 2,
      y: -pt.y - placeH / 2,
      w: placeW, h: placeH,
      side: activeSide,
      natW: gallery.natW, natH: gallery.natH,
    };
    setPlacedImages(prev => [...prev, placed]);
    setActiveImgId(placed.id);
    setSelectedImageId(null);
  }, [uploadedImages, selectedImageId, svgToLocal, activeSide, defaultPlaceWidth]);

  // Start drag (move or resize)
  const startDrag = useCallback((e, imgId, mode) => {
    e.stopPropagation();
    e.preventDefault();
    setActiveImgId(imgId);
    const pt = svgToLocal(e);
    const img = placedImages.find(i => i.id === imgId);
    if (!img) return;
    setDragState({
      id: imgId, mode,
      startX: pt.x, startY: pt.y,
      origX: img.x, origY: img.y, origW: img.w, origH: img.h,
    });
  }, [svgToLocal, placedImages]);

  // Drag move/resize
  const onDragMove = useCallback((e) => {
    if (!dragState) return;
    const pt = svgToLocal(e);
    const svgDx = pt.x - dragState.startX;
    const svgDy = pt.y - dragState.startY;
    setPlacedImages(prev => prev.map(img => {
      if (img.id !== dragState.id) return img;
      if (dragState.mode === 'move') {
        return { ...img, x: dragState.origX + svgDx, y: dragState.origY - svgDy };
      }
      if (dragState.mode === 'resize') {
        const ratio = img.natH / img.natW;
        const newW = Math.max(30, dragState.origW + svgDx);
        const newH = newW * ratio;
        return { ...img, w: newW, h: newH, y: dragState.origY + dragState.origH - newH };
      }
      return img;
    }));
  }, [dragState, svgToLocal]);

  const onDragEnd = useCallback(() => { setDragState(null); }, []);

  // Window-level drag listeners
  useEffect(() => {
    if (!dragState) return;
    const move = (e) => onDragMove(e);
    const up = () => onDragEnd();
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
  }, [dragState, onDragMove, onDragEnd]);

  // Scroll to resize (zoom from center, aspect ratio locked)
  const handleImageWheel = useCallback((e, imgId) => {
    e.stopPropagation();
    e.preventDefault();
    const factor = e.deltaY > 0 ? 0.93 : 1.07;
    setPlacedImages(prev => prev.map(img => {
      if (img.id !== imgId) return img;
      const ratio = img.natH / img.natW;
      const newW = Math.max(30, Math.min(3000, img.w * factor));
      const newH = newW * ratio;
      const cx = img.x + img.w / 2, cy = img.y + img.h / 2;
      return { ...img, w: newW, h: newH, x: cx - newW / 2, y: cy - newH / 2 };
    }));
  }, []);

  const removePlacedImage = useCallback((imgId) => {
    setPlacedImages(prev => prev.filter(i => i.id !== imgId));
    setActiveImgId(prev => prev === imgId ? null : prev);
  }, []);

  const clearAllPlaced = useCallback(() => {
    setPlacedImages([]);
    setActiveImgId(null);
  }, []);

  return {
    uploadedImages, selectedImageId, setSelectedImageId,
    handleImageUpload, removeUploadedImage, fileInputRef,
    placedImages, setPlacedImages, activeImgId, setActiveImgId,
    activeSide, setActiveSide, dragState,
    handleDielinePlace, startDrag, onDragMove, onDragEnd,
    handleImageWheel, removePlacedImage, clearAllPlaced,
  };
}
