"""
PDF Quote Generator
สร้างใบเสนอราคา PDF อย่างเป็นทางการ
"""

import os
import io
from datetime import datetime
from typing import Dict, Any, Optional
from fpdf import FPDF

# ===================================
# Paths
# ===================================
_BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_LOGO_PATH = os.path.join(_BASE_DIR, "..", "frontend", "public", "logo.png")
_FONT_PATH = "C:/Windows/Fonts/tahoma.ttf"
_FONT_BOLD_PATH = "C:/Windows/Fonts/tahomabd.ttf"

# Thai box type names
BOX_TYPE_TH = {
    "rsc": "RSC (มาตรฐาน)",
    "die_cut": "Die-cut (ฝาเสียบ)",
    "heart": "Heart (หัวใจ)",
    "tube_lock": "Tube Lock",
    "self_lock": "Self-Lock",
}

MATERIAL_TH = {
    "kraft": "Kraft (คราฟท์)",
    "white": "White (ขาว)",
    "red": "Red (แดง)",
    "corrugated_2layer": "ลูกฟูก 2 ชั้น",
    "kraft_200gsm": "คราฟท์ 200 GSM",
    "whiteboard_350gsm": "กล่องขาว 350 GSM",
    "cardboard": "กระดาษแข็ง",
    "art_300gsm": "อาร์ต 300 GSM",
}


class QuotePDF(FPDF):
    """Custom PDF with header/footer for LumoPack quotes."""

    def __init__(self, quote_no: str):
        super().__init__()
        self.quote_no = quote_no
        self._setup_fonts()

    def _setup_fonts(self):
        if os.path.exists(_FONT_PATH):
            self.add_font("Thai", "", _FONT_PATH, uni=True)
        if os.path.exists(_FONT_BOLD_PATH):
            self.add_font("Thai", "B", _FONT_BOLD_PATH, uni=True)

    # ── Header ──
    def header(self):
        # Logo
        if os.path.exists(_LOGO_PATH):
            self.image(_LOGO_PATH, x=10, y=8, w=25)
        # Company name
        self.set_font("Thai", "B", 16)
        self.set_xy(38, 10)
        self.cell(0, 8, "LumoPack", ln=False)
        self.set_font("Thai", "", 9)
        self.set_xy(38, 18)
        self.cell(0, 5, "บริษัท ลูโม่แพค จำกัด", ln=True)
        # Quote title (right)
        self.set_font("Thai", "B", 14)
        self.set_xy(-80, 10)
        self.cell(70, 8, "ใบเสนอราคา", align="R", ln=True)
        self.set_font("Thai", "", 9)
        self.set_xy(-80, 18)
        self.cell(70, 5, f"เลขที่: {self.quote_no}", align="R", ln=True)
        self.set_xy(-80, 23)
        self.cell(70, 5, f"วันที่: {datetime.now().strftime('%d/%m/%Y')}", align="R", ln=True)
        # Line
        self.set_draw_color(120, 80, 200)
        self.set_line_width(0.5)
        self.line(10, 32, 200, 32)
        self.ln(20)

    # ── Footer ──
    def footer(self):
        self.set_y(-20)
        self.set_font("Thai", "", 8)
        self.set_text_color(120, 120, 120)
        self.cell(0, 5, "ใบเสนอราคานี้มีอายุ 30 วันนับจากวันที่ออก", align="C", ln=True)
        self.cell(0, 5, f"หน้า {self.page_no()}/{{nb}}", align="C")

    # ── Helpers ──
    def _section_title(self, title: str):
        self.set_font("Thai", "B", 11)
        self.set_fill_color(245, 240, 255)
        self.set_text_color(60, 30, 120)
        self.cell(0, 8, f"  {title}", fill=True, ln=True)
        self.set_text_color(0, 0, 0)
        self.ln(2)

    def _row(self, label: str, value: str, bold_value: bool = False):
        self.set_font("Thai", "", 10)
        self.cell(60, 6, f"  {label}", ln=False)
        self.set_font("Thai", "B" if bold_value else "", 10)
        self.cell(0, 6, value, ln=True)

    def _table_header(self, cols):
        self.set_font("Thai", "B", 9)
        self.set_fill_color(100, 60, 180)
        self.set_text_color(255, 255, 255)
        for label, w in cols:
            self.cell(w, 7, label, border=1, align="C", fill=True)
        self.ln()
        self.set_text_color(0, 0, 0)

    def _table_row(self, values, widths, aligns=None):
        self.set_font("Thai", "", 9)
        aligns = aligns or ["L"] * len(values)
        for val, w, a in zip(values, widths, aligns):
            self.cell(w, 6, str(val), border=1, align=a)
        self.ln()

    def _table_total_row(self, label: str, amount: str, widths_before: int):
        self.set_font("Thai", "B", 10)
        self.cell(widths_before, 7, label, border=1, align="R")
        self.cell(190 - widths_before, 7, amount, border=1, align="R")
        self.ln()


def generate_quote_pdf(
    session_id: str,
    collected_data: Dict[str, Any],
    pricing_data: Dict[str, Any],
) -> bytes:
    """
    Generate a formal PDF quote.

    Args:
        session_id: session/order reference
        collected_data: chatbot collected data
        pricing_data: output from pricing calculator

    Returns:
        PDF bytes
    """
    quote_no = f"QT-{datetime.now().strftime('%Y%m%d')}-{session_id[:8].upper()}"
    pdf = QuotePDF(quote_no)
    pdf.alias_nb_pages()
    pdf.add_page()

    dims = collected_data.get("dimensions", {})
    box_type = collected_data.get("box_type", "")
    material = collected_data.get("material", "")
    quantity = collected_data.get("quantity", 0)
    product_type = collected_data.get("product_type", "")

    # ── 1. Product Info ──
    pdf._section_title("ข้อมูลสินค้า")
    pdf._row("ประเภทสินค้า:", product_type or "-")
    pdf._row("ประเภทกล่อง:", BOX_TYPE_TH.get(box_type, box_type))
    pdf._row("วัสดุ:", MATERIAL_TH.get(material, material))
    pdf._row("ขนาด (กว้าง x ยาว x สูง):",
             f"{dims.get('width', 0)} x {dims.get('length', 0)} x {dims.get('height', 0)} ซม.")
    pdf._row("จำนวนสั่งผลิต:", f"{quantity:,} ชิ้น")

    flute = collected_data.get("flute_type")
    if flute:
        pdf._row("ลอนกระดาษ:", flute)

    support = collected_data.get("support_required")
    if support is not None:
        pdf._row("ซัพพอร์ตภายใน:", "ต้องการ" if support else "ไม่ต้องการ")

    inner = collected_data.get("inner")
    if inner and inner != "skip":
        if isinstance(inner, list):
            names = [i.get("name", str(i)) if isinstance(i, dict) else str(i) for i in inner]
            pdf._row("วัสดุกันกระแทก/เคลือบ:", ", ".join(names))
        else:
            pdf._row("วัสดุกันกระแทก/เคลือบ:", str(inner))

    pdf.ln(4)

    # ── 2. Design Info ──
    has_logo = collected_data.get("has_logo")
    logo_pos = collected_data.get("logo_positions")
    effects = collected_data.get("special_effects")
    if has_logo or logo_pos or effects:
        pdf._section_title("รายละเอียดการออกแบบ")
        if has_logo:
            pdf._row("โลโก้:", "มี")
            if logo_pos:
                pdf._row("ตำแหน่งโลโก้:", ", ".join(logo_pos) if isinstance(logo_pos, list) else str(logo_pos))
        if effects and isinstance(effects, list):
            effect_names = [e.get("name", e.get("type", str(e))) if isinstance(e, dict) else str(e) for e in effects]
            pdf._row("ลูกเล่นพิเศษ:", ", ".join(effect_names))
        pdf.ln(4)

    # ── 3. Pricing Table ──
    pdf._section_title("รายละเอียดราคา")

    cols = [("รายการ", 80), ("ราคา/ชิ้น (บาท)", 40), ("จำนวน", 30), ("รวม (บาท)", 40)]
    pdf._table_header(cols)
    widths = [80, 40, 30, 40]
    aligns = ["L", "R", "R", "R"]

    box_base = pricing_data.get("box_base", {})
    pdf._table_row(
        [f"กล่อง {BOX_TYPE_TH.get(box_type, box_type)}",
         f"{box_base.get('price_per_box', 0):.2f}",
         f"{quantity:,}",
         f"{box_base.get('total_price', 0):,.2f}"],
        widths, aligns
    )

    inner_pricing = pricing_data.get("inner", {})
    if inner_pricing.get("total_price", 0) > 0:
        pdf._table_row(
            [f"Inner ({inner_pricing.get('name', '')})",
             f"{inner_pricing.get('price_per_box', 0):.2f}",
             f"{quantity:,}",
             f"{inner_pricing.get('total_price', 0):,.2f}"],
            widths, aligns
        )

    for coat in pricing_data.get("coatings", []):
        if coat.get("total_price", 0) > 0:
            pdf._table_row(
                [coat.get("name", "Coating"),
                 f"{coat.get('price_per_box', 0):.2f}",
                 f"{quantity:,}",
                 f"{coat.get('total_price', 0):,.2f}"],
                widths, aligns
            )

    for stamp in pricing_data.get("stampings", []):
        if stamp.get("total", 0) > 0:
            block_note = ""
            if stamp.get("block_cost", 0) > 0:
                block_note = f" (รวมบล็อก {stamp['block_cost']:,.0f})"
            pdf._table_row(
                [f"ป๊ัม{block_note}",
                 f"{stamp.get('stamp_cost_per_box', 0):.2f}",
                 f"{quantity:,}",
                 f"{stamp.get('total', 0):,.2f}"],
                widths, aligns
            )

    pdf.ln(2)

    # Totals
    subtotal = pricing_data.get("subtotal", 0)
    vat = pricing_data.get("vat", 0)
    grand_total = pricing_data.get("grand_total", 0)

    pdf._table_total_row("รวมก่อน VAT", f"{subtotal:,.2f} บาท", 150)
    pdf._table_total_row("VAT 7%", f"{vat:,.2f} บาท", 150)
    pdf.set_fill_color(245, 240, 255)
    pdf.set_font("Thai", "B", 11)
    pdf.cell(150, 8, "รวมทั้งสิ้น", border=1, align="R", fill=True)
    pdf.cell(40, 8, f"{grand_total:,.2f} บาท", border=1, align="R", fill=True)
    pdf.ln(8)

    # ── 4. Terms ──
    pdf._section_title("เงื่อนไข")
    pdf.set_font("Thai", "", 9)
    terms = [
        "1. ราคานี้ยังไม่รวมค่าขนส่ง",
        "2. ชำระมัดจำ 50% ก่อนเริ่มผลิต ส่วนที่เหลือชำระก่อนจัดส่ง",
        f"3. มัดจำ: {grand_total * 0.5:,.2f} บาท",
        "4. ระยะเวลาผลิตประมาณ 7-14 วันทำการ",
        "5. ใบเสนอราคามีอายุ 30 วันนับจากวันที่ออก",
    ]
    for t in terms:
        pdf.cell(0, 5, f"  {t}", ln=True)

    pdf.ln(10)
    pdf.set_font("Thai", "", 9)
    pdf.cell(0, 5, f"อ้างอิง: {session_id}", ln=True)

    return pdf.output()


def pdf_bytes_from_project_row(project: Dict[str, Any]) -> bytes:
    """สร้าง PDF ใบเสนอราคาจากแถวตาราง projects (collected_data + pricing หรือคำนวณใหม่)"""
    from models.requirement import CompleteRequirement
    from services.pricing_calculator import get_price_estimate

    collected = project.get("collected_data") or {}
    sid = project.get("session_id") or project.get("id")
    session_id = str(sid) if sid is not None else "unknown"

    pricing_data = project.get("pricing")
    if not pricing_data:
        if not collected.get("dimensions") or not collected.get("box_type"):
            raise ValueError("ข้อมูลยังไม่ครบ ไม่สามารถออกใบเสนอราคาได้")
        requirement = CompleteRequirement.from_collected_data(
            session_id=session_id,
            collected_data=collected,
        )
        pricing_request = requirement.to_pricing_request()
        pricing_data = get_price_estimate(pricing_request)

    return generate_quote_pdf(session_id, collected, pricing_data)
