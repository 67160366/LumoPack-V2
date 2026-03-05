# Prompt: สร้าง DieCutBox Component (React Three Fiber)

## บริบท
ระบบนี้มี `BoxViewer.jsx` ที่แสดงกล่องกระดาษ 3D อยู่แล้ว ปัจจุบันกล่อง Die-cut ใช้ไฟล์ `.glb` ซึ่งมีปัญหาเรื่อง scale เพี้ยนเมื่อปรับขนาด W×H×D
**ให้สร้าง `DieCutBox` component ใหม่โดยใช้ Three.js geometry ล้วนๆ แทนไฟล์ .glb ทั้งหมด**

---

## Dieline Reference (วิเคราะห์จาก SVG จริง)

SVG ต้นฉบับ: `500x300x80mm-folding-box.svg`
viewBox: `0 0 877 858` (1 unit = 1mm)

```
เส้นสีเขียว = Crease line (เส้นพับ) → pivot ตอนพับ
เส้นสีแดง   = Cut line (เส้นตัด)   → ขอบ panel
```

### Layout ภาพรวม (SVG coordinate space, mm)
```
      181       190      687  696
       |         |        |   |
  0   ┌─────────────────────────┐   0
      │       TOP FLAP          │    ← tongue โค้ง R=80mm
  80  └──┬──────────────────┬──┘   80
  86  ───┼──────────────────┼───   86
      │  │                  │  │
  95  │D │   BACK PANEL     │D │   
      │E │    (TOP HALF)    │E │
      │P │    497 × 300mm   │P │
      │T │                  │T │
      │H │                  │H │
      │L │                  │R │
 386  │  │                  │  │  386
 390.5 ──┼──────────────────┼──   390.5
         │  [crease strip]  │
 473.5 ──┼──────────────────┼──   473.5
 0─86    │                  │  791─877
 ┌──┐ ┌──┤   FRONT PANEL    ├──┐ ┌──┐
 │SL│ │DE│    497 × 386mm   │DE│ │SL│  ← SL=Slot strip
 │OT│ │PT│                  │PT│ │OT│     DE=Depth panel
 │  │ │H │                  │H │ │  │
 └──┘ └──┤                  ├──┘ └──┘
 776.5 ──┼──────────────────┼──   776.5
 858  ┌──┴──────────────────┴──┐  858
      │      BOTTOM FLAP       │    ← snap lock
      └────────────────────────┘
```

---

## พิกัดจริงจาก SVG (mm) — ใช้แปลงเป็น Three.js โดยตรง

### Panel Boundaries
```
Panel              X (left→right)     Y (top→bottom)    Size (W×H mm)
──────────────────────────────────────────────────────────────────────
TOP_FLAP           181 → 696          0 → 80            515 × 80
BACK_PANEL         190 → 687          86 → 386           497 × 300
DEPTH_L (top)       95 → 178          86 → 386            83 × 300
DEPTH_R (top)      699 → 782          86 → 386            83 × 300
FRONT_PANEL        190 → 687         390.5 → 776.5       497 × 386
DEPTH_L (main)      95 → 178         472 → 778            83 × 306
DEPTH_R (main)     699 → 782         472 → 778            83 × 306
SLOT_STRIP_L         0 →  86         475 → 775            86 × 300
SLOT_STRIP_R       791 → 877         475 → 775            86 × 300
BOTTOM_FLAP        181 → 696         776.5 → 858         515 × 81.5

Slots (holes ใน DEPTH panels):
  Left  slot 1:  x=178→188.5,  y=525→585   (10.5 × 60mm)
  Left  slot 2:  x=178→188.5,  y=665→725   (10.5 × 60mm)
  Right slot 1:  x=688.5→699,  y=525→585   (10.5 × 60mm)
  Right slot 2:  x=688.5→699,  y=665→725   (10.5 × 60mm)
```

### Top Flap Arc Radii (จาก SVG path จริง)
```
A 80 80 0 0 0  → R=80mm  ← โค้งใหญ่ตรงกลางบน (corner rounds)
A  5  5 0 0 0  → R=5mm   ← โค้งเล็กมุมที่ติดกับ depth panel
A 10 10 0 0 0  → R=10mm  ← โค้งกลางข้าง depth panel
```

---

## กฎการ Scale — แปลงพิกัด SVG → Three.js

SVG ใช้ขนาดคงที่ (500×300×80mm) แต่ **component ต้องรับ props ที่ปรับได้**
ให้คำนวณทุกค่าเป็น **ratio** จากขนาดอ้างอิง แล้ว scale ตาม W/H/D จริง:

```js
// Props: width, height, depth (หน่วย cm)
const w = width  / 10   // scene units
const h = height / 10
const d = depth  / 10
const t = 0.015         // ความหนากระดาษ

// SVG reference dimensions (mm → ratio)
const REF_W = 500, REF_H = 300, REF_D = 80

// แปลงพิกัด SVG เป็น ratio ก่อน แล้ว scale ด้วย w/h/d
// ตัวอย่าง: slot กว้าง 10.5mm จากทั้งหมด 83mm depth panel
// → ratio = 10.5/83 ≈ 0.126 → scene = d * 0.126

const slotW     = d * (10.5 / REF_D)     // scale ตาม D
const slotH     = h * (60  / REF_H)      // scale ตาม H
const slot1Y    = h * ((585 - 390.5) / REF_H)  // offset จาก top ของ front panel
const slot2Y    = h * ((725 - 390.5) / REF_H)

const topFlapH  = d * (80   / REF_D)     // = d * 1.0
const botFlapH  = d * (81.5 / REF_D)     // ≈ d * 1.02

// Arc radii scale ตาม D:
const arcBig    = d * (80  / REF_D)      // R=80mm → scale ตาม D
const arcSmall  = d * (5   / REF_D)      // R=5mm
const arcMid    = d * (10  / REF_D)      // R=10mm

// Guard: ไม่ให้เล็กเกินไป
const slotWMin  = Math.max(slotW, t * 1.5)
const slotHMin  = Math.max(slotH, t * 3)
```

---

## Coordinate Map (ตำแหน่ง Flat Layout บน Three.js XZ plane)

```js
// Three.js: X=ขวา, Z=ลง (SVG Y → Three.js Z), Y=ขึ้น
// กึ่งกลาง (0,0,0) = center ของ FRONT_PANEL
// ทุก panel วางนอนบน Y=0, rotation.x = -Math.PI/2

// Front panel: w × h (scene units)
FRONT_PANEL:       pos = (0,           0,  0)           size = w × h
BACK_PANEL:        pos = (0,           0, -(h + d))     size = w × h   ← อยู่ด้านหลัง

// Depth panels (ซ้าย-ขวา)
DEPTH_L:           pos = (-(w/2+d/2),  0,  d/2)         size = d × (h+d)
DEPTH_R:           pos = (+(w/2+d/2),  0,  d/2)         size = d × (h+d)

// Slot strips (ปีกนอก)
SLOT_STRIP_L:      pos = (-(w/2+d+slotW/2), 0, d/2)    size = slotStripW × h
SLOT_STRIP_R:      pos = (+(w/2+d+slotW/2), 0, d/2)    size = slotStripW × h

// Top panels
TOP_FLAP:          pos = (0, 0, -(h/2 + topFlapH/2))   size = (w+d*0.03) × topFlapH
BACK_TOP_CREASE:   pos = (0, 0, -(h + d + topFlapH/2)) // mirror ด้านหลัง

// Bottom panels
BOTTOM_FLAP:       pos = (0, 0, +(h/2 + botFlapH/2))   size = (w+d*0.03) × botFlapH
```

---

## รายละเอียดแต่ละ Panel

### 1. FRONT PANEL
- ขนาด: `w × h`
- Geometry: `PlaneGeometry`

### 2. BACK PANEL
- ขนาด: `w × h`
- Geometry: `PlaneGeometry`

### 3. DEPTH_L / DEPTH_R (แผ่นข้างซ้าย-ขวา)
- ขนาด: `d × (h + d)` — ครอบทั้ง front และ depth zone
- Geometry: **`ShapeGeometry`**
- มี **2 slots** เจาะเป็น hole:
  ```js
  // Slot position สัมพันธ์กับขอบบนของ depth panel
  slot1: { x: -slotW/2 → +slotW/2,  y: slot1Y → slot1Y+slotH }
  slot2: { x: -slotW/2 → +slotW/2,  y: slot2Y → slot2Y+slotH }
  // slotW = d*(10.5/80), slotH = h*(60/300)
  ```
- step cut ที่มุมทั้ง 4: ขนาด `t × t`

### 4. SLOT_STRIP_L / SLOT_STRIP_R (แถบสล็อตนอก)
- ขนาด: `(86/80 * d) × h`
- Geometry: **`ShapeGeometry`** มีรอยบากแนวนอน 4 ตำแหน่ง (lock tabs)
- ตำแหน่ง Y ของ tab: สัมพันธ์กับ slot ของ depth panel

### 5. TOP FLAP (tongue โค้ง)
- ขนาด: `(w + d*0.03) × topFlapH` โดย `topFlapH = d * 1.0`
- Geometry: **`ShapeGeometry`** วาดจาก SVG path จริง:
  ```js
  const shape = new Shape()
  const fw = w + d * 0.03   // กว้างกว่า front นิดนึง
  const fh = d * 1.0        // ความสูง flap
  const r1 = d * (80/80)    // R=80mm → arc ใหญ่มุมบน
  const r2 = d * (5/80)     // R=5mm  → arc เล็กมุมข้าง
  const r3 = d * (10/80)    // R=10mm → arc กลาง

  shape.moveTo(0, 0)
  shape.lineTo(fw, 0)                         // ขอบล่างตรง (crease line)
  shape.lineTo(fw, fh - r3)
  shape.quadraticCurveTo(fw, fh, fw-r3, fh)  // มุมขวาล่างของ arch
  shape.lineTo(fw * (696-190)/(696-181), fh)
  // arc ใหญ่โค้งขึ้นตรงกลาง
  shape.bezierCurveTo(
    fw*0.75, fh + r1*0.3,
    fw*0.25, fh + r1*0.3,
    fw*(190-181)/(696-181), fh
  )
  shape.lineTo(r3, fh)
  shape.quadraticCurveTo(0, fh, 0, fh-r3)    // มุมซ้ายล่างของ arch
  shape.lineTo(0, 0)
  ```

### 6. BOTTOM FLAP (snap lock)
- ขนาด: `(w + d*0.03) × botFlapH` โดย `botFlapH = d * 1.02`
- Geometry: **`ShapeGeometry`**
- มุมล่างตัดเฉียง 45° ขนาด `d * 0.1`
- ตรงกลางล่างมีแท็บยื่น: กว้าง `w * 0.25`, สูง `d * 0.1`

---

## Material

```js
<meshStandardMaterial
  map={corrugatedMap}    // จาก useCorrugatedTexture()
  roughness={0.85}
  side={DoubleSide}      // ← สำคัญ ต้องเห็นทั้งสองด้าน
/>
```

---

## ขั้นตอนที่ให้ทำ (Phase 1 เท่านั้น)

### ✅ Phase 1: Flat Layout
- วาง panel ทุกชิ้นตาม Coordinate Map
- panel วางนอนบน XZ plane (`rotation.x = -Math.PI/2`)
- **ทุก panel ต้องอยู่บน `Y >= 0`** — ห้ามจมใต้ grid
- **แต่ละ panel ต้อง Y offset ต่างกัน `t * n`** — ป้องกัน Z-fighting:
  ```js
  FRONT_PANEL:    y = t * 0
  BACK_PANEL:     y = t * 1
  DEPTH_L/R:      y = t * 1
  SLOT_STRIP_L/R: y = t * 2
  TOP_FLAP:       y = t * 1
  BOTTOM_FLAP:    y = t * 1
  ```
- ใส่ slider ปรับ W, H, D แบบ real-time — ทุก panel ต้องขยับตามทันที
- ใส่ `OrbitControls`, `gridHelper`, `ContactShadows`

### ❌ Phase 2 (ยังไม่ต้องทำ)
Animation พับกล่อง — รอ review Phase 1 ก่อน

---

## Interface ของ Component

```jsx
<DieCutBox
  width={50}    // cm
  height={30}   // cm
  depth={8}     // cm
/>
```

---

## โครงสร้างไฟล์

```
DieCutBox.jsx
  ├── <FrontPanel />
  ├── <BackPanel />
  ├── <DepthPanel side="left"  />   ← ShapeGeometry + 2 slots
  ├── <DepthPanel side="right" />
  ├── <SlotStrip side="left"   />   ← ShapeGeometry lock tabs
  ├── <SlotStrip side="right"  />
  ├── <TopFlap />                   ← ShapeGeometry arc จาก SVG path
  └── <BottomFlap />                ← ShapeGeometry snap lock
```

---

## หมายเหตุสำคัญ

1. **ห้ามใช้ GLB** — geometry ทั้งหมดสร้างจาก Three.js
2. **ทุก dimension ต้องคำนวณจาก w, h, d เป็น ratio** — ห้าม hardcode ตัวเลขลอย
3. **ใช้ `DoubleSide`** กับทุก material
4. **`useMemo` + deps ครบ** สำหรับ ShapeGeometry ทุกตัว — `[w, d]`, `[d, h, t]` ฯลฯ
5. **pivot point** ของทุก flap ต้องอยู่ที่ขอบ crease (เพื่อ Phase 2)
6. **ป้องกัน Z-fighting** ด้วย Y offset `t * n` ในแต่ละ layer
7. **Guard** slot ไม่ให้เล็กเกินไป: `Math.max(slotW, t*1.5)`
