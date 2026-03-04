# Prompt: สร้าง DieCutBox Component (React Three Fiber)

## บริบท
ระบบนี้มี `BoxViewer.jsx` ที่แสดงกล่องกระดาษ 3D อยู่แล้ว ปัจจุบันกล่อง Die-cut ใช้ไฟล์ `.glb` ซึ่งมีปัญหาเรื่อง scale เพี้ยนเมื่อปรับขนาด W×H×D
**ให้สร้าง `DieCutBox` component ใหม่โดยใช้ Three.js geometry ล้วนๆ แทนไฟล์ .glb ทั้งหมด**

---

## โครงสร้างกล่อง Die-cut (Tuck Top, Snap Lock Bottom)

ขนาดอ้างอิง: W=315mm, H=202mm, D=62mm
ทุก panel คำนวณจาก props `width`, `height`, `depth` (หน่วย: cm → scene unit = /10)

```
const w = width  / 10
const h = height / 10
const d = depth  / 10
const t = 0.015  // ความหนากระดาษ (scene unit)
```

---

## รายละเอียดแต่ละ Panel

### 1. FRONT PANEL (แผ่นหน้าหลัก)
- ขนาด: `w × h`
- ตำแหน่ง: กึ่งกลาง วางตั้ง
- Geometry: `PlaneGeometry`
- หมายเหตุ: เป็น reference panel ที่ panel อื่นยึดตำแหน่งตาม

### 2. BACK PANEL (แผ่นหลัง)
- ขนาด: `w × h`
- ตำแหน่ง: ด้านหลัง Front Panel ห่างออกไป `d` (ความลึก)
- Geometry: `PlaneGeometry`

### 3. LEFT SIDE FLAP (แผ่นข้างซ้าย)
- ขนาด: `d × h`
- ตำแหน่ง: ซ้ายของ Front Panel
- Geometry: **`ShapeGeometry`** — มีรอยตัดมุมเป็นขั้นบันได (step cut) ที่มุมทั้ง 4 เพื่อให้ซ้อนพับได้พอดี
  - Step cut ขนาด: `t × t` ที่ทุกมุม
- มี **2 ช่องสล็อต (slot)** แนวตั้ง สำหรับสอด tongue ของฝาบน:
  - แต่ละ slot: กว้าง `t*1.5`, สูง `d*0.35`
  - ตำแหน่ง: อยู่ที่ x = `d*0.25` และ `d*0.65` ห่างจากขอบบน `h*0.15`

### 4. RIGHT SIDE FLAP (แผ่นข้างขวา)
- เหมือน Left Side Flap ทุกประการ (mirror)

### 5. TOP INNER FLAP (แผ่นด้านในฝาบน)
- ขนาด: `w × (d * 0.85)`
- ตำแหน่ง: บน Front Panel พับออกไปด้านบน
- Geometry: `PlaneGeometry`
- หมายเหตุ: แผ่นนี้อยู่ระหว่าง Front Panel กับ Top Flap

### 6. TOP FLAP — TONGUE (ฝาบน มุมโค้ง)
- ขนาด: `w × (d * 0.95)` — สูงกว่า Top Inner Flap เล็กน้อย
- Geometry: **`ShapeGeometry`** — วาด path ดังนี้:
  - เริ่มจากขอบล่างซ้าย → ขวา (เส้นตรง ความกว้าง `w`)
  - ขึ้นซ้าย-ขวา ตรง (ความสูง `d * 0.6`)
  - **มุมโค้ง (rounded tongue):** ส่วนบนทำเป็น arc โค้งออก
    - ใช้ `QuadraticBezierCurve` หรือ `bezierCurveTo`
    - โค้งเข้าด้านใน radius ≈ `d * 0.15` ที่มุมซ้าย-ขวา
    - ตรงกลางบนโค้งออกมา `d * 0.05`
  - shape นี้เป็น tongue ที่จะสอดเข้า slot ของ Side Flap

### 7. BOTTOM INNER FLAP (แผ่นด้านในฝาล่าง)
- ขนาด: `w × (d * 0.85)`
- ตำแหน่ง: ล่างของ Front Panel
- Geometry: `PlaneGeometry`

### 8. BOTTOM FLAP (ฝาล่าง — snap lock)
- ขนาด: `w × (d * 0.95)`
- Geometry: **`ShapeGeometry`** — คล้าย Top Flap แต่มีรูปร่าง snap lock แทน tongue โค้ง:
  - มุมตัดทแยง 45° ขนาด `d*0.1` ที่มุมล่างซ้าย-ขวา
  - ตรงกลางล่างมีแท็บสี่เหลี่ยมเล็กยื่นออกมา: กว้าง `w*0.3`, สูง `d*0.08`

---

## Material

ทุก panel ใช้ material เดียวกัน:
```js
// ใช้ corrugated texture จาก useCorrugatedTexture() hook ที่มีอยู่แล้ว
<meshStandardMaterial
  map={corrugatedMap}
  roughness={0.85}
  side={DoubleSide}   // ← สำคัญ ต้องเห็นทั้งสองด้าน
/>
```

---

## ขั้นตอนที่ให้ทำ (Phase 1 เท่านั้น)

### ✅ Phase 1: Flat Layout (dieline펼친)
แสดง panel ทุกชิ้นในตำแหน่ง "กางออก" บนระนาบ XZ เหมือน dieline 2D แต่เป็น 3D
- วาง Front Panel ที่กึ่งกลาง
- Side Flap กางออกซ้าย-ขวา (rotation.y = 0, rotation.z = 0)
- Top/Bottom Flap กางออกบน-ล่าง (rotation.x = 0)
- ยังไม่ต้องพับ ยังไม่ต้องมี animation
- ใส่ `OrbitControls` ให้หมุนดูได้
- ใส่ `gridHelper` และ `ContactShadows`

### ❌ Phase 2 (ยังไม่ต้องทำ)
Animation พับกล่อง — รอ review Phase 1 ก่อน

---

## Interface ของ Component

```jsx
// ใช้แทน GltfBox ใน BoxViewer.jsx
<DieCutBox
  width={31.5}   // cm
  height={20.2}  // cm
  depth={6.2}    // cm
/>
```

---

## โครงสร้างไฟล์

```
DieCutBox.jsx       ← component หลัก
  ├── <FrontPanel />
  ├── <BackPanel />
  ├── <SideFlap side="left" />
  ├── <SideFlap side="right" />
  ├── <TopInnerFlap />
  ├── <TopFlap />          ← ShapeGeometry tongue โค้ง
  ├── <BottomInnerFlap />
  └── <BottomFlap />       ← ShapeGeometry snap lock
```

---

## กฎการ Scale (สำคัญมาก)

### ✅ ทุกค่าต้องคำนวณจาก w, h, d — ห้าม hardcode ตัวเลขลอย

```js
// ✅ ถูก
const topFlapHeight      = d * 0.95
const topInnerFlapHeight = d * 0.85
const slotHeight         = d * 0.35
const slotOffsetY        = h * 0.15
const stepSize           = t * 2

// ❌ ผิด
const topFlapHeight = 0.59   // ← hardcode!
const slotHeight    = 0.22   // ← hardcode!
```

---

### Slot บน Side Flap — scale ตาม D และ H

```js
// ทั้งหมดนี้ต้อง scale ตามขนาดกล่อง
const slotWidth    = t * 1.5          // ความกว้าง slot (scale ตาม t)
const slotHeight   = d * 0.35         // ความสูง slot (scale ตาม D)
const slotSpacingX = d * 0.4          // ระยะห่างระหว่าง slot 2 อัน (scale ตาม D)
const slot1X       = d * 0.25         // ตำแหน่ง X ของ slot แรก
const slot2X       = d * 0.65         // ตำแหน่ง X ของ slot สอง
const slotTopY     = h * 0.5 - h * 0.15  // ตำแหน่ง Y บนของ slot (ห่างจากขอบบน h*0.15)
```

---

### ShapeGeometry ต้องใช้ useMemo + deps ครบ

```js
// Top Flap tongue โค้ง — recalculate ทุกครั้งที่ w หรือ d เปลี่ยน
const tongueShape = useMemo(() => {
  const shape = new Shape()
  const fw = w           // ความกว้างเต็ม
  const fh = d * 0.95    // ความสูงฝา
  const curve = d * 0.15 // radius โค้งที่มุม (scale ตาม D)
  const tipOut = d * 0.05 // ยื่นออกตรงกลาง (scale ตาม D)

  shape.moveTo(0, 0)
  shape.lineTo(fw, 0)
  shape.lineTo(fw, fh - curve)
  shape.quadraticCurveTo(fw, fh, fw - curve, fh + tipOut)   // มุมขวา
  shape.lineTo(fw * 0.5 + fw * 0.1, fh + tipOut * 1.5)     // กลางโค้งออก
  shape.quadraticCurveTo(fw * 0.5, fh + tipOut * 2, fw * 0.5 - fw * 0.1, fh + tipOut * 1.5)
  shape.lineTo(curve, fh + tipOut)
  shape.quadraticCurveTo(0, fh, 0, fh - curve)             // มุมซ้าย
  shape.lineTo(0, 0)

  return shape
}, [w, d])  // ← deps: w และ d เท่านั้น ห้ามลืม

// Side Flap with slots — recalculate ทุกครั้งที่ d หรือ h เปลี่ยน
const sideFlapShape = useMemo(() => {
  const shape = new Shape()
  // ... วาด outline + step cut ที่มุม
  // เจาะ slot 2 อัน เป็น hole
  const slot1 = new Path()
  slot1.moveTo(slot1X, slotTopY)
  slot1.lineTo(slot1X + slotWidth, slotTopY)
  slot1.lineTo(slot1X + slotWidth, slotTopY - slotHeight)
  slot1.lineTo(slot1X, slotTopY - slotHeight)
  slot1.closePath()
  shape.holes.push(slot1)
  // slot2 เหมือนกัน เปลี่ยนแค่ X
  return shape
}, [d, h, t])
```

---

### ความสัมพันธ์ Flap Height กับ D (สรุป)

| Panel | ความสูง | เหตุผล |
|---|---|---|
| Top Flap (tongue) | `d * 0.95` | สอดเข้า slot ได้พอดี |
| Top Inner Flap | `d * 0.85` | สั้นกว่า Top Flap นิดนึง ไม่ชน |
| Bottom Flap | `d * 0.95` | ปิดก้นได้พอดี |
| Bottom Inner Flap | `d * 0.85` | รองรับ Bottom Flap |
| Side Flap (width) | `d` | เท่ากับความลึกกล่องพอดี |

---

### Edge Case ที่ต้องรองรับ

```
// ทดสอบ 3 ขนาดนี้ — ทุก panel ต้องแสดงถูกต้อง ไม่ทับ ไม่หาย
กล่องเล็ก:  width=10, height=8,  depth=3   → slot ต้องไม่เล็กจนมองไม่เห็น
กล่องใหญ่: width=60, height=40, depth=20  → tongue ต้องโค้งสวยสมส่วน
กล่องแบน:  width=30, height=5,  depth=3   → inner flap ต้องไม่ overflow ออกนอก front panel

// Guard ป้องกัน slot เล็กเกินไป
const slotHeight = Math.max(d * 0.35, t * 3)  // ← ต้องใหญ่กว่าความหนาขั้นต่ำ
const slotWidth  = Math.max(t * 1.5,  0.02)   // ← ต้องมองเห็นได้เสมอ
```

---

## หมายเหตุสำคัญ

1. **ห้ามใช้ GLB** — geometry ทั้งหมดสร้างจาก Three.js
2. **ทุก dimension ต้องคำนวณจาก w, h, d** — ห้าม hardcode ตัวเลข
3. **ใช้ `DoubleSide`** กับทุก material เพื่อให้เห็นทั้งสองหน้า
4. **pivot point ของทุก flap** ต้องอยู่ที่ขอบที่ติดกับ Front Panel เสมอ (เพื่อ Phase 2)
5. **`useMemo` + deps ครบ** สำหรับ ShapeGeometry ทุกตัว — ถ้า deps ขาดจะไม่ update เมื่อปรับขนาด
6. **ใส่ guard** ป้องกัน slot/tongue เล็กเกินไปเมื่อ depth น้อยมาก
