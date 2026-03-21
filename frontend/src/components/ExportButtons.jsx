/**
 * ExportButtons — DXF / SVG / PDF download toolbar for dieline views
 */

import { useCallback } from 'react';
import { generateDxf, downloadDxf } from '../engine/dxfWriter';
import { generateSvg, downloadSvg } from '../engine/svgExporter';

const FONT = "'Plus Jakarta Sans', 'DM Sans', -apple-system, sans-serif";

export default function ExportButtons({ dieline, W, H, D, prefix = 'dieline' }) {
  const fname = `${prefix}-${W}x${H}x${D}mm`;

  const handleDxf = useCallback(() => {
    const content = generateDxf(dieline, W, H, D);
    downloadDxf(content, `${fname}.dxf`);
  }, [dieline, W, H, D, fname]);

  const handleSvg = useCallback(() => {
    const content = generateSvg(dieline, W, H, D);
    downloadSvg(content, `${fname}.svg`);
  }, [dieline, W, H, D, fname]);

  const handlePdf = useCallback(() => {
    // Generate SVG then convert to PDF via jsPDF
    import('jspdf').then(({ default: jsPDF }) => {
      const svg = generateSvg(dieline, W, H, D);
      const b = dieline.bounds;
      const pad = Math.max(b.width, b.height) * 0.05;
      const totalW = b.width + pad * 2;
      const totalH = b.height + pad * 2;

      // Landscape or portrait based on dieline aspect
      const isLandscape = totalW > totalH;
      const doc = new jsPDF({
        orientation: isLandscape ? 'landscape' : 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pageW = doc.internal.pageSize.getWidth() - 20;
      const pageH = doc.internal.pageSize.getHeight() - 30;
      const scale = Math.min(pageW / totalW, pageH / totalH);
      const imgW = totalW * scale;
      const imgH = totalH * scale;
      const x = (doc.internal.pageSize.getWidth() - imgW) / 2;

      // Title
      doc.setFontSize(14);
      doc.text(`LumoPack Dieline — ${W} x ${H} x ${D} mm`, 10, 12);
      doc.setFontSize(9);
      doc.setTextColor(120);
      doc.text('Red = Cut line  |  Green = Crease/Fold line', 10, 18);
      doc.setTextColor(0);

      // SVG → image via canvas
      const img = new Image();
      const blob = new Blob([svg], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = totalW * 4;
        canvas.height = totalH * 4;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/png');
        doc.addImage(dataUrl, 'PNG', x, 22, imgW, imgH);
        doc.save(`${fname}.pdf`);
        URL.revokeObjectURL(url);
      };
      img.src = url;
    });
  }, [dieline, W, H, D, fname]);

  const btnStyle = {
    padding: '6px 12px', borderRadius: 8, border: 'none',
    fontSize: 11, fontWeight: 700, fontFamily: FONT,
    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
    transition: 'all 0.15s',
  };

  return (
    <div style={{
      position: 'absolute', bottom: 52, left: 16, zIndex: 10,
      display: 'flex', gap: 6,
    }}>
      <button
        onClick={handleDxf}
        style={{ ...btnStyle, background: '#7c3aed', color: '#fff' }}
        title="Download DXF (CAD)"
      >
        <DownloadIcon />
        DXF
      </button>
      <button
        onClick={handleSvg}
        style={{ ...btnStyle, background: '#0d9488', color: '#fff' }}
        title="Download SVG"
      >
        <DownloadIcon />
        SVG
      </button>
      <button
        onClick={handlePdf}
        style={{ ...btnStyle, background: '#1e40af', color: '#fff' }}
        title="Download PDF"
      >
        <DownloadIcon />
        PDF
      </button>
    </div>
  );
}

function DownloadIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}
