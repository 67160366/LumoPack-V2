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
