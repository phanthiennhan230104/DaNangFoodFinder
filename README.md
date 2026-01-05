# 🍜 DNFF – Intelligent Food Finding System

AI-powered food discovery and recommendation platform for Da Nang.  
Developed by Capstone Team – International School, Duy Tan University.

---

## 🚀 Key Features

- **Smart Search** – Find dishes or restaurants by keywords or natural language (NLQ)  
- **Food Journey Planner** – Plan breakfast–lunch–dinner with route visualization on Google Maps
- **Map & Route View** 
- **Favorites & History** – Save and revisit preferred restaurants  
- **Admin Dashboard** – Manage crawler data, users, and system  
- **Integration** – Google Maps API + Groq API (AI) + Ollama 
- **Role-Based Access Control** – Authentication for User and Admin  

---

## 📋 System Requirements

### Backend
- Python 3.10+
- MySQL 8.0+
- pip (Python package manager)

### Frontend
- Node.js 18+ (LTS recommended)
- npm or yarn

---

## 🛠️ Installation & Setup

### 1️⃣ Clone Repository
```bash
git clone <repository-url>
cd DaNangFoodFinder
```

### 2️⃣ Database Setup

**Create MySQL Database:**
```sql
CREATE DATABASE DaNangFoodFinderDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

**Import Database:**
```bash
mysql -u root -p DaNangFoodFinderDB < database/dnff.sql
```

### 3️⃣ Backend Setup

**Navigate to backend folder:**
```bash
cd backend
```

**Install Python dependencies:**
```bash
pip install -r requirements.txt
```

**Configure Environment Variables:**

Create `.env` file in `backend/` directory:
```env
# Email Configuration
SMTP_EMAIL=your_email@gmail.com
SMTP_APP_PASSWORD=your_app_password

# Django Secret Key
SECRET_KEY=your-secret-key-here

# API Keys
GROQ_API_KEY=your_groq_api_key
GOOGLE_CLIENT_ID=your_google_oauth_client_id

# Database Configuration
DB_NAME=DaNangFoodFinderDB
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_HOST=localhost
DB_PORT=3306
```

**Run Migrations:**
```bash
python manage.py migrate
```

**Start Backend Server:**
```bash
python manage.py runserver
```
Backend will run at `http://localhost:8000/`

---

### 4️⃣ Frontend Setup

**Navigate to frontend folder:**
```bash
cd frontend
```

**Install Node.js dependencies:**
```bash
npm install
```

**Configure Environment Variables:**

Create `.env` file in `frontend/` directory:
```env
VITE_API_URL=http://localhost:8000
VITE_GOOGLE_MAPS_API_KEY=your_google_maps_api_key
```

**Start Frontend Development Server:**
```bash
npm run dev
```
Frontend will run at `http://localhost:5173/`

---

## 📁 Project Structure

```
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
```

---

## 🔑 Sample Accounts

| Role  | Email                         | Password  |
|-------|-------------------------------|-----------|
| Admin | phanthiennhan230104@gmail.com | Nhan2004@ |
| User  | phanthiennhan.dev@gmail.com   | Nhan2004@ |

---

## 👨‍💻 Development Team

**Team Members:**  
Phan Thien Nhan • Do Tran Uyen Chi • Hoang Thi Thao Vy • Pham Van Huy • Nguyen Huu Hung

**Mentor:**  
MSc. Hoang Nguyen Thai – Axon Active Vietnam

---

## 📧 Contact & Support

For questions or issues, please contact:
- Email: phanthiennhan.dev@gmail.com
- University: International School, Duy Tan University

---

## 📜 License

This project is created for academic purposes under  
**Capstone Project 1 – CMU-SE450**  
International School, Duy Tan University (2025)

---

## 🙏 Acknowledgments

- Duy Tan University - International School
- All team members and contributors