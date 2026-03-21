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

_FONT_CANDIDATES = [
    ("C:/Windows/Fonts/tahoma.ttf", "C:/Windows/Fonts/tahomabd.ttf"),
    ("/usr/share/fonts/truetype/thai/TH Sarabun New.ttf", "/usr/share/fonts/truetype/thai/TH Sarabun New Bold.ttf"),
    ("/usr/share/fonts/truetype/noto/NotoSansThai-Regular.ttf", "/usr/share/fonts/truetype/noto/NotoSansThai-Bold.ttf"),
    ("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"),
]

BOX_TYPE_LABELS = {
    "rsc": "RSC (Standard)",
    "die_cut": "Die-cut (Tuck End)",
    "heart": "Heart Box",
    "tube_lock": "Tube Lock",
    "self_lock": "Self-Lock",
}

MATERIAL_LABELS = {
    "kraft": "Kraft",
    "white": "White Cardboard",
    "red": "Red",
    "corrugated_2layer": "Corrugated 2-Layer",
    "kraft_200gsm": "Kraft 200 GSM",
    "whiteboard_350gsm": "White Board 350 GSM",
    "cardboard": "Cardboard",
    "art_300gsm": "Art Paper 300 GSM",
}


class QuotePDF(FPDF):
    """Custom PDF with header/footer for LumoPack quotes."""

    def __init__(self, quote_no: str):
        super().__init__()
        self.quote_no = quote_no
        self._fn = "Helvetica"
        self._setup_fonts()

    def _setup_fonts(self):
        for reg_path, bold_path in _FONT_CANDIDATES:
            if os.path.exists(reg_path):
                try:
                    self.add_font("Thai", "", reg_path, uni=True)
                    if os.path.exists(bold_path):
                        self.add_font("Thai", "B", bold_path, uni=True)
                    else:
                        self.add_font("Thai", "B", reg_path, uni=True)
                    self._fn = "Thai"
                    return
                except Exception:
                    continue
        self._fn = "Helvetica"

    # ── Header ──
    def header(self):
        f = self._fn
        if os.path.exists(_LOGO_PATH):
            self.image(_LOGO_PATH, x=10, y=8, w=25)
        self.set_font(f, "B", 16)
        self.set_xy(38, 10)
        self.cell(0, 8, "LumoPack", ln=False)
        self.set_font(f, "", 9)
        self.set_xy(38, 18)
        self.cell(0, 5, "LumoPack Co., Ltd.", ln=True)
        self.set_font(f, "B", 14)
        self.set_xy(-80, 10)
        self.cell(70, 8, "Quotation", align="R", ln=True)
        self.set_font(f, "", 9)
        self.set_xy(-80, 18)
        self.cell(70, 5, f"No: {self.quote_no}", align="R", ln=True)
        self.set_xy(-80, 23)
        self.cell(70, 5, f"Date: {datetime.now().strftime('%d/%m/%Y')}", align="R", ln=True)
        # Line
        self.set_draw_color(120, 80, 200)
        self.set_line_width(0.5)
        self.line(10, 32, 200, 32)
        self.ln(20)

    # ── Footer ──
    def footer(self):
        f = self._fn
        self.set_y(-20)
        self.set_font(f, "", 8)
        self.set_text_color(120, 120, 120)
        self.cell(0, 5, "Valid for 30 days from issue date", align="C", ln=True)
        self.cell(0, 5, f"Page {self.page_no()}/{{nb}}", align="C")

    # ── Helpers ──
    def _section_title(self, title: str):
        self.set_font(self._fn, "B", 11)
        self.set_fill_color(245, 240, 255)
        self.set_text_color(60, 30, 120)
        self.cell(0, 8, f"  {title}", fill=True, ln=True)
        self.set_text_color(0, 0, 0)
        self.ln(2)

    def _row(self, label: str, value: str, bold_value: bool = False):
        self.set_font(self._fn, "", 10)
        self.cell(60, 6, f"  {label}", ln=False)
        self.set_font(self._fn, "B" if bold_value else "", 10)
        self.cell(0, 6, value, ln=True)

    def _table_header(self, cols):
        self.set_font(self._fn, "B", 9)
        self.set_fill_color(100, 60, 180)
        self.set_text_color(255, 255, 255)
        for label, w in cols:
            self.cell(w, 7, label, border=1, align="C", fill=True)
        self.ln()
        self.set_text_color(0, 0, 0)

    def _table_row(self, values, widths, aligns=None):
        self.set_font(self._fn, "", 9)
        aligns = aligns or ["L"] * len(values)
        for val, w, a in zip(values, widths, aligns):
            self.cell(w, 6, str(val), border=1, align=a)
        self.ln()

    def _table_total_row(self, label: str, amount: str, widths_before: int):
        self.set_font(self._fn, "B", 10)
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
    pdf._section_title("Product Information")
    pdf._row("Product type:", product_type or "-")
    pdf._row("Box type:", BOX_TYPE_LABELS.get(box_type, box_type))
    pdf._row("Material:", MATERIAL_LABELS.get(material, material))
    pdf._row("Size (W x L x H):",
             f"{dims.get('width', 0)} x {dims.get('length', 0)} x {dims.get('height', 0)} cm")
    pdf._row("Quantity:", f"{quantity:,} pcs")

    flute = collected_data.get("flute_type")
    if flute:
        pdf._row("Flute type:", flute)

    support = collected_data.get("support_required")
    if support is not None:
        pdf._row("Support insert:", "Yes" if support else "No")

    inner = collected_data.get("inner")
    if inner and inner != "skip":
        if isinstance(inner, list):
            names = [i.get("name", str(i)) if isinstance(i, dict) else str(i) for i in inner]
            pdf._row("Inner material:", ", ".join(names))
        else:
            pdf._row("Inner material:", str(inner))

    pdf.ln(4)

    # ── 2. Design Info ──
    has_logo = collected_data.get("has_logo")
    logo_pos = collected_data.get("logo_positions")
    effects = collected_data.get("special_effects")
    if has_logo or logo_pos or effects:
        pdf._section_title("Design Details")
        if has_logo:
            pdf._row("Logo:", "Yes")
            if logo_pos:
                pdf._row("Logo position:", ", ".join(logo_pos) if isinstance(logo_pos, list) else str(logo_pos))
        if effects and isinstance(effects, list):
            effect_names = [e.get("name", e.get("type", str(e))) if isinstance(e, dict) else str(e) for e in effects]
            pdf._row("Special effects:", ", ".join(effect_names))
        pdf.ln(4)

    # ── 3. Pricing Table ──
    pdf._section_title("Pricing Details")

    cols = [("Item", 80), ("Price/pc (THB)", 40), ("Qty", 30), ("Total (THB)", 40)]
    pdf._table_header(cols)
    widths = [80, 40, 30, 40]
    aligns = ["L", "R", "R", "R"]

    box_base = pricing_data.get("box_base", {})
    pdf._table_row(
        [f"Box {BOX_TYPE_LABELS.get(box_type, box_type)}",
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
                block_note = f" (incl. block {stamp['block_cost']:,.0f})"
            pdf._table_row(
                [f"Stamping{block_note}",
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

    pdf._table_total_row("Subtotal", f"{subtotal:,.2f} THB", 150)
    pdf._table_total_row("VAT 7%", f"{vat:,.2f} THB", 150)
    pdf.set_fill_color(245, 240, 255)
    pdf.set_font(pdf._fn, "B", 11)
    pdf.cell(150, 8, "Grand Total", border=1, align="R", fill=True)
    pdf.cell(40, 8, f"{grand_total:,.2f} THB", border=1, align="R", fill=True)
    pdf.ln(8)

    # ── 4. Terms ──
    pdf._section_title("Terms & Conditions")
    pdf.set_font(pdf._fn, "", 9)
    terms = [
        "1. Price excludes shipping",
        "2. 50% deposit before production, remaining before delivery",
        f"3. Deposit: {grand_total * 0.5:,.2f} THB",
        "4. Production time approx. 7-14 business days",
        "5. Quotation valid for 30 days from issue date",
    ]
    for t in terms:
        pdf.cell(0, 5, f"  {t}", ln=True)

    pdf.ln(10)
    pdf.set_font(pdf._fn, "", 9)
    pdf.cell(0, 5, f"Ref: {session_id}", ln=True)

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
