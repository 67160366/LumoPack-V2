LumoPack Developer Manual

1. ติดตั้งโปรเจคลงเครื่อง

1.1 Clone Project
เปิด Terminal พิมพ์คำสั่ง
     
     git clone https://github.com/Creamchanidapa/LumoPack.git
     
     cd LumoPack
1.2 Setup Frontend (React)
     
     cd frontend
     
     npm install		# ลง Library ที่จำเป็น
     
     npm run dev	# ลองรันดู (ต้องได้หน้าเว็บที่ localhost:5173)
1.3 Setup Backend
เปิด Terminal ใหม่
     
     cd backend
     
     python3 -m venv venv		# สร้างกล่องเก็บ Python
     
     source venv/bin/activate		# เปิดใช้งาน (Windows ใช้: venv\Scripts\activate)
     
     pip install -r requirements.txt	# ลง Library
     
     uvicorn main:app –reload		# ลองรันดู (ต้องได้ localhost:8000)



#  LumoPack-V2

---

##  Features

- **AI Chatbot 14 ขั้นตอน** — แชทบอทผู้เชี่ยวชาญบรรจุภัณฑ์ที่ถามคำถามทีละข้อเพื่อรวบรวม requirement ของลูกค้า
- **3D Box Viewer** — กล่อง 3D แบบ Real-time ที่เปลี่ยนขนาดอัตโนมัติตามที่แชท (React Three Fiber + WebGL)
- **AI Structural Analysis** — วิเคราะห์ความแข็งแรงของกล่องด้วย AI จากน้ำหนักสินค้าและวัสดุที่เลือก
- **Pricing Calculator** — คำนวณราคาอัตโนมัติตามขนาด วัสดุ จำนวน และลูกเล่นพิเศษ
- **Responsive Design** — ใช้งานได้ทั้ง Desktop, Tablet และ Mobile

---

##  Tech Stack

| Layer | เทคโนโลยี |
|---|---|
| **Frontend** | React 18 + Vite + Tailwind CSS v4 |
| **3D Rendering** | React Three Fiber + @react-three/drei |
| **Backend** | FastAPI (Python 3.11) |
| **AI/LLM** | Groq API (LLaMA 3.3 70B) |
| **Deployment** | Render (Backend) + Vercel/Netlify (Frontend) |

---

##  โครงสร้างโปรเจกต์

```
LumoPack-V2/
│
├── backend/                              # FastAPI Backend
│   ├── main.py                           # App หลัก + CORS + Middleware
│   ├── requirements.txt                  # Python dependencies
│   │
│   ├── api/                              # API Endpoints
│   │   ├── chat.py                       # POST /api/chat/message (Chatbot)
│   │   └── pricing.py                    # POST /api/pricing/calculate
│   │
│   ├── services/                         # Business Logic
│   │   ├── chatbot_flow.py               # จัดการ 14 ขั้นตอน + State Machine
│   │   ├── groq_service.py               # เชื่อมต่อ Groq LLM API
│   │   ├── pricing_calculator.py         # คำนวณราคาตาม Requirement
│   │   ├── requirement_validator.py      # ตรวจสอบความครบถ้วนของข้อมูล
│   │   ├── data_extractor.py             # ดึงข้อมูลจากข้อความลูกค้า (NLP)
│   │   └── step_handlers/                # Handler แยกตาม Step Group
│   │       ├── structure_steps.py        # Step 1-6: โครงสร้างกล่อง
│   │       ├── design_steps.py           # Step 7-10: การออกแบบ
│   │       └── finalize_steps.py         # Step 11-14: สรุป + เสนอราคา
│   │
│   ├── models/                           # Data Models (Pydantic)
│   │   ├── chat_state.py                 # Session + Conversation State
│   │   └── requirement.py                # BoxRequirement + DesignRequirement
│   │
│   ├── utils/                            # Utilities
│   │   ├── constants.py                  # ราคาวัสดุ, ตัวเลือก, Config
│   │   └── prompts.py                    # Prompt Templates สำหรับ LLM
│   │
│   └── tests/                            # Unit Tests
│       ├── test_api.py
│       ├── test_chatbot_flow.py
│       ├── test_pricing.py
│       ├── test_chat_state.py
│       ├── test_data_extractor.py
│       ├── test_requirement.py
│       └── test_groq.py
│
├── frontend/                             # React Frontend
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js                    # Vite + API Proxy Config
│   ├── postcss.config.js                 # Tailwind CSS v4
│   │
│   └── src/
│       ├── main.jsx                      # Entry point
│       ├── App.jsx                       # Layout หลัก (3 Panel + Responsive)
│       ├── index.css                     # Tailwind v4 + Theme Config
│       │
│       ├── components/
│       │   ├── Chatbot/
│       │   │   ├── ChatWindow.jsx        # หน้าต่างแชทหลัก
│       │   │   ├── ChatMessage.jsx       # Bubble ข้อความ (User/Bot)
│       │   │   ├── ChatInput.jsx         # ช่องพิมพ์ + ปุ่มส่ง
│       │   │   ├── RequirementSummary.jsx # สรุป Checkpoint (Step 6, 10)
│       │   │   ├── PricingQuote.jsx      # ใบเสนอราคา (Step 12)
│       │   │   └── MockupDisplay.jsx     # แสดง Mockup (Step 11)
│       │   │
│       │   ├── Box3D/
│       │   │   ├── BoxViewer.jsx         # Canvas + Camera + Controls
│       │   │   └── HeatmapBox.jsx        # 3D Box Mesh + Shader
│       │   │
│       │   └── Panels/
│       │       ├── StudioPanel.jsx       # Sliders + AI Simulation
│       │       └── SummaryPanel.jsx      # สรุปข้อมูลที่เก็บได้
│       │
│       ├── contexts/
│       │   └── ChatbotContext.jsx        # Global State (Messages, Dimensions)
│       │
│       ├── services/
│       │   └── api.js                    # API Client (fetch wrapper)
│       │
│       ├── hooks/
│       │   ├── useChatbot.js             # Custom Hook สำหรับ Chat
│       │   └── useBoxDimensions.js       # Custom Hook สำหรับขนาดกล่อง
│       │
│       └── utils/
│           └── constants.js              # Frontend Constants
│
├── .gitignore
└── README.md
```

---

##  Chatbot Flow (14 ขั้นตอน)

```
┌─────────────────── โครงสร้างกล่อง ───────────────────┐
│ Step 1:  ทักทาย + แนะนำตัว                          
│ Step 2:  ถามประเภทสินค้า (ทั่วไป/Food/เครื่องสำอาง)      
│ Step 3:  ถามประเภทกล่อง + วัสดุ (RSC/Die-cut)         
│ Step 4:  ถาม Inner กันกระแทก (Optional)            
│ Step 5:  ถามขนาด + จำนวนสั่งผลิต                     
│ Step 6:  ✅ Checkpoint 1 — สรุปให้ลูกค้ายืนยัน          
├─────────────────── การออกแบบ ───────────────────────
│ Step 7:  ถาม Mood & Tone (Optional)                   
│ Step 8:  ถามโลโก้ + ตำแหน่ง (Optional)                 
│ Step 9:  ถามลูกเล่นพิเศษ — ปั๊มนูน/ฟอยล์ (Optional)    
│ Step 10: ✅ Checkpoint 2 — สรุปรอบสอง                  
├─────────────────── สรุป + เสนอราคา ───────────────────
│ Step 11: แสดง Mockup กล่อง                             
│ Step 12: แสดงใบเสนอราคา                                
│ Step 13: ยืนยันคำสั่งซื้อ                               
│ Step 14: จบการสนทนา                                    
└──────────────────────────────────────────────────────
```

---

##  วิธี Setup

### ขั้นที่ 1: Clone Project

```bash
git clone https://github.com/<username>/LumoPack-V2.git
cd LumoPack-V2
```

### ขั้นที่ 2: Setup Backend

```bash
cd backend
python -m venv venv

# Windows
venv\Scripts\activate
# macOS/Linux
source venv/bin/activate

pip install -r requirements.txt
```

สร้างไฟล์ `.env` ใน `backend/`:

```env
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxx
MODEL_NAME=llama-3.3-70b-versatile
```

> 💡 สมัคร Groq API Key ฟรีที่ https://console.groq.com

รัน Backend:

```bash
uvicorn main:app --reload
```

✅ เปิด http://localhost:8000/docs จะเห็น API Documentation

### ขั้นที่ 3: Setup Frontend

เปิด Terminal ใหม่:

```bash
cd frontend
npm install
npm run dev
```

✅ เปิด http://localhost:5173 จะเห็นหน้าเว็บ

---

## 🌐 API Endpoints

| Method | Endpoint | คำอธิบาย |
|--------|----------|----------|
| `POST` | `/api/chat/message` | ส่งข้อความ + รับ response จาก AI |
| `GET` | `/api/chat/session/{id}` | ดึงข้อมูล session |
| `POST` | `/api/chat/session/{id}/reset` | Reset session |
| `DELETE` | `/api/chat/session/{id}` | ลบ session |
| `POST` | `/api/pricing/calculate` | คำนวณราคากล่อง |
| `GET` | `/api/pricing/materials` | ดึงรายการวัสดุ |
| `GET` | `/health` | Health check |
| `GET` | `/docs` | Swagger API Docs |

### ตัวอย่าง Request — ส่งข้อความแชท

```bash
curl -X POST http://localhost:8000/api/chat/message \
  -H "Content-Type: application/json" \
  -d '{"message": "สวัสดี", "session_id": null}'
```

### ตัวอย่าง Response

```json
{
  "session_id": "abc-123-def",
  "response": "สวัสดีค่ะ! ยินดีต้อนรับสู่ LumoPack...",
  "current_step": 2,
  "collected_data": {},
  "is_complete": false
}
```

---


Development Status

| Feature | Status |
|---------|--------|
| Backend — API Endpoints | ✅ Done |
| Backend — Chatbot 14 Steps | ✅ Done |
| Backend — Groq LLM Integration | ✅ Done |
| Backend — Pricing Calculator | ✅ Done |
| Frontend — Chat UI | ✅ Done |
| Frontend — 3D Box Viewer | ✅ Done |
| Frontend — Responsive Layout | ✅ Done |
| Frontend — Context + API Service | ✅ Done |
| Integration — Frontend ↔ Backend | 🔄 Testing |
| Integration — 3D Sync with Chat | 🔄 Testing |
| Feature B — 3D Realism + Textures | ❌ Not Started |
| Feature C — Order Flow + Payment | ❌ Not Started |

