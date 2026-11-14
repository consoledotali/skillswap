# SkillSwap ⚡

> **Peer-to-Peer Collaborative Learning & Skill Exchange Platform**  
> SkillSwap connects individuals to exchange skills mutually without monetary barriers—teach what you know, learn what you want.

---

## 📌 Project Overview

SkillSwap empowers users to connect and engage in mutual learning:
- **Skill Matching**: Users define their "Teach" and "Learn" skills on their profiles. The platform automatically suggests complementary matches.
- **Swap Requests**: Propose, track, and manage skill swaps across a structured lifecycle (`PENDING` ➔ `ACCEPTED` ➔ `COMPLETED` / `REJECTED` / `CANCELLED`).
- **Real-Time Communication**: Live one-on-one chat, typing indicators, unread counters, and online presence powered by Socket.IO.
- **Trust & Reputation**: Star ratings and structured reviews upon swap completion calculate user trust scores dynamically.
- **Admin Governance Portal**: Dedicated dashboard for monitoring platform KPIs, moderating users, curating categories/skills, and managing user reports.

---

## 🛠️ Tech Stack

- **Frontend**: React 19, TypeScript, Vite, Socket.IO Client, Lucide React, Sonner (Toasts), Recharts
- **Backend**: Node.js, Express 5, Socket.IO, Prisma ORM 7 (`@prisma/adapter-pg`), bcrypt, JWT
- **Database**: PostgreSQL
- **Authentication**: JWT Access Token + HttpOnly Cookies / Refresh Tokens

---

## 📋 Prerequisites

Ensure the following are installed on your machine before running the application:
1. **Node.js** (v18 or v20+) — [Download Node.js](https://nodejs.org/)
2. **PostgreSQL** (v14+) — Local PostgreSQL installation or a cloud instance (e.g., Supabase, Neon)
3. **npm** (included with Node.js)

---

## 🚀 How to Run the Project (Step-by-Step Guide)

### 1. Database Setup (PostgreSQL)

Ensure your PostgreSQL service is running, and create a new database:
```sql
CREATE DATABASE skillswap_db;
```

---

### 2. Backend (Server) Setup

Open a terminal and navigate to the `server` directory:

```bash
cd server
```

#### A. Install Dependencies:
```bash
npm install
```

#### B. Configure Environment Variables (`.env`):
Create a `.env` file in the `server` directory by copying `.env.example`:
```bash
cp .env.example .env
```

Update `.env` with your PostgreSQL database credentials and a secret key:
```env
PORT=5000
DATABASE_URL="postgresql://postgres:YOUR_POSTGRES_PASSWORD@localhost:5432/skillswap_db?schema=public"
JWT_SECRET="skillswap_super_secret_jwt_key_2025"
JWT_SESSION_EXPIRES_IN="2h"
JWT_REMEMBER_EXPIRES_IN="30d"

CLIENT_URL="http://localhost:5173"
SERVER_PUBLIC_URL="http://localhost:5000"
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
SMTP_HOST=""
```
*(Verify your PostgreSQL username, password, port, and database name).*

#### C. Push Database Schema & Seed Data:
```bash
npm run prisma:generate
npm run prisma:push
npm run seed
```

#### D. Start the Backend Server:
```bash
npm run dev
```
The server will run on: `http://localhost:5000` (Health Check: `http://localhost:5000/api/health`)

---

### 3. Frontend (Client) Setup

Open a new terminal window and navigate to the `client` directory:

```bash
cd client
```

#### A. Install Dependencies:
```bash
npm install
```

#### B. Configure Environment Variables (`.env`):
Create a `.env` file in the `client` directory by copying `.env.example`:
```bash
cp .env.example .env
```

Ensure it contains the following endpoints:
```env
VITE_API_URL="http://localhost:5000/api"
VITE_SOCKET_URL="http://localhost:5000"
```

#### C. Start the Frontend App:
```bash
npm run dev
```
The frontend will run on: `http://localhost:5173`

---

## 🔑 Demo Login Credentials (For Testing)

After running the database seed, you can log in using any of the following accounts:

| Role | Email | Password | Description |
| :--- | :--- | :--- | :--- |
| **Admin** | `admin@skillswap.com` | `Test@123` | Full access to the Admin Portal (`/admin`) |
| **User 1** | `ali@test.com` | `Test@123` | Teaches React.js, JS, Web Dev |
| **User 2** | `sarah@test.com` | `Test@123` | Teaches UI/UX & Graphic Design, wants React & Python |
| **User 3** | `hassan@test.com` | `Test@123` | Teaches Python, wants Design & React |
| **User 4** | `fatima@test.com` | `Test@123` | Teaches UI/UX & Design, wants React & JS |
| **User 5** | `bilal@test.com` | `Test@123` | Teaches Web Development & JS, wants UI/UX |

*Note: You can also register a new account through the Sign Up page.*

---

## 📂 Project Structure

```text
SkillSwap/
├── client/
│   ├── src/
│   │   ├── components/
│   │   ├── context/
│   │   ├── hooks/
│   │   ├── lib/
│   │   ├── pages/
│   │   └── App.tsx
│   ├── .env.example
│   └── package.json
├── server/
│   ├── database/seed.js
│   ├── prisma/schema.prisma
│   ├── src/
│   │   ├── controllers/
│   │   ├── middlewares/
│   │   ├── routes/
│   │   ├── config/
│   │   └── server.js
│   ├── .env.example
│   └── package.json
└── README.md
```

---

## ⚙️ Available Scripts

### Backend (`server/`):
- `npm run dev`: Starts the backend server in development mode with live reload.
- `npm run prisma:studio`: Opens a visual UI in your browser to inspect/edit database records (`http://localhost:5555`).
- `npm run prisma:push`: Synchronizes the Prisma schema with the PostgreSQL database.
- `npm run seed`: Seeds the database with default categories, skills, and demo users.

### Frontend (`client/`):
- `npm run dev`: Starts the Vite development server with Hot Module Replacement (`http://localhost:5173`).
- `npm run build`: Compiles TypeScript and creates an optimized production bundle.
- `npm run preview`: Locally previews the production build.
- `npm run lint`: Performs TypeScript type-checking without emitting files.

---

## ❓ Troubleshooting

1. **Database connection failure**:
   - Ensure the PostgreSQL service is active and running.
   - Verify `DATABASE_URL` in `server/.env` contains the correct username, password, port (typically 5432 or 5433), and database name.
2. **CORS issues**:
   - Ensure `CLIENT_URL` in `server/.env` is set to `http://localhost:5173`.
3. **Port already in use**:
   - If port 5000 or 5173 is occupied by another process, change `PORT` in `server/.env` or specify a different port in Vite.
