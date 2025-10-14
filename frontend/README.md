# 🍜 DNFF – Intelligent Food Finding System
AI-powered food discovery and recommendation platform for Da Nang.  
Developed by Capstone Team – International School, Duy Tan University.
---
## 🚀 Key Features
- 🔍 **Smart Search** – Find dishes or restaurants by keywords or natural language (NLQ)  
- 🗺️ **Food Journey Planner** – Plan breakfast–lunch–dinner with route visualization on Google Maps  
- ❤️ **Favorites & History** – Save and revisit preferred restaurants  
- ⚙️ **Admin Dashboard** – Manage crawler data, users, and system  
- 🧭 **Integration** – Google Maps API + Groq API (AI) + Ollama 
- 🔐 **Role-Based Access Control** – Authentication for User and Admin  
---
## ⚙️ System Requirements install quickly with:
<pre>
    pip install -r requirements.txt
</pre>
---
<pre>
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.mysql',
        'NAME': 'DaNangFoodFinderDB',
        'USER': 'root', # change to your MySQL username
        'PASSWORD': 'root',  # change to your MySQL password
        'HOST': 'localhost',
        'PORT': '3306',
    }
}</pre>
---
## 📁 Project Structure
<pre>
DNFF/
├── backend/
│   ├── adminpanel/              # Admin management module
│   ├── api/                     # Main API (crawler, data processing, services)
│   ├── authentication/          # Login, register, and role management
│   ├── backend/                 # Django core (settings, urls, wsgi, asgi)
│   ├── manage.py
│   └── requirements.txt
│
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── assets/
│   │   ├── components/          # Reusable UI components
│   │   ├── hooks/
│   │   ├── pages/               # User, Auth, Admin pages
│   │   ├── styles/
│   │   ├── api.js
│   │   ├── App.jsx
│   │   ├── constants.js
│   │   └── main.jsx
│   ├── package.json
│   └── vite.config.js
│
├── database/
│   └── dnff.sql                 # Database initialization file
│
├── docs/                        # Documents (Proposal, ERD, Test Plan, Report)
├── .gitignore
└── README.md
</pre>
---
SAMPLE ACCOUNT
| Role          | Gmail                         | Password     |
| ------------- | ------------------------------| ------------ |
| admin         | phanthiennhan230104@gmail.com | Nhan2004@    |
| user          | phanthiennhan.dev@gmail.com   | Nhan2004@    |
---
## Run Full System
RUN BACKEND
<pre>
    cd backend
    python manage.py migrate
    python manage.py runserver
</pre>
---
RUN FRONTEND
<pre>
    cd frontend
    npm run dev
    Access at http://localhost:5173/
</pre>

👨‍💻 Development Team
Phan Thien Nhan • Do Tran Uyen Chi • Hoang Thi Thao Vy • Pham Van Huy • Nguyen Huu Hung
🎓 Mentor: MSc. Hoang Nguyen Thai – Axon Active Vietnam

📜 License

This project is created for academic purposes under
Capstone Project 1 – CMU-SE450, International School, Duy Tan University (2025).