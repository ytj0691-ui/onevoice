# OneVoice — Live Meeting Decisions

**OneVoice** is a free, open-source real-time voting system for assemblies, boards, and official meetings. The chairperson shares the admin screen via Zoom (or any video call), while participants vote from their mobile phones.

> 총회, 이사회, 정기회의 등에서 실시간 의결을 진행할 수 있는 무료 오픈소스 투표 시스템입니다.

---

## Features

- **Real-time voting** via WebSocket — results update instantly for all participants
- **Bilingual UI** (한국어 / English) with automatic language detection
- **Mobile-first design** — participants vote on their phones
- **Screen-share optimized** — admin dashboard designed for Zoom sharing
- **Simple access** — 6-character access code, no sign-up required
- **Majority rule** — agenda passes when agree > total/2
- **Multiple agendas** — manage sequential votes in a single session

## How It Works

1. **Chair creates a session** → receives an admin code + access code
2. **Chair shares the admin screen** on Zoom and announces the access code
3. **Participants join** by entering the code + their name on mobile
4. **Chair opens voting** on each agenda item
5. **Participants tap** Agree / Disagree / Abstain
6. **Results appear in real-time** on the shared screen

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18 + Vite + Tailwind CSS + shadcn/ui |
| Backend | Express 5 + WebSocket (ws) |
| Database | PostgreSQL + Drizzle ORM |
| Language | TypeScript |
| Font | Pretendard (Korean support) |

---

## Deploy to Render (Free)

### One-Click Deploy

1. Push this repository to GitHub
2. Go to [Render Dashboard](https://dashboard.render.com)
3. Click **"New" → "Blueprint"**
4. Connect your GitHub repo — Render reads `render.yaml` automatically
5. Render will create:
   - A **Web Service** (Node.js, free tier)
   - A **PostgreSQL database** (free tier, 30-day lifespan)
6. Wait for the build to complete — your app is live.

### Manual Deploy

1. **Create a PostgreSQL database** on Render (free plan)
2. **Create a Web Service** with these settings:
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`
   - **Environment Variables:**
     - `NODE_ENV` = `production`
     - `DATABASE_URL` = (copy the Internal Database URL from step 1)
3. Tables are created automatically on first startup.

### Docker Deploy (Alternative)

```bash
docker build -t onevoice .
docker run -p 10000:10000 -e DATABASE_URL="postgresql://..." onevoice
```

---

## Local Development

### Prerequisites

- Node.js 20+
- PostgreSQL (local or remote)

### Setup

```bash
git clone <repo-url>
cd onevoice
npm install
```

### Configure Database

Set the `DATABASE_URL` environment variable:

```bash
export DATABASE_URL="postgresql://localhost:5432/onevoice"
```

Or create a `.env` file (not committed to Git):

```
DATABASE_URL=postgresql://localhost:5432/onevoice
```

### Run

```bash
npm run dev
```

The app starts on `http://localhost:5000` with both the API and frontend served on the same port.

---

## Project Structure

```
├── client/                 # React frontend
│   ├── src/
│   │   ├── pages/          # Home, Admin, AdminSession, Vote
│   │   ├── components/ui/  # shadcn/ui components
│   │   ├── lib/            # queryClient, WebSocket, utils
│   │   └── index.css       # Tailwind + theme variables
│   └── index.html
├── server/
│   ├── index.ts            # Express + HTTP server setup
│   ├── routes.ts           # REST API + WebSocket
│   ├── storage.ts          # PostgreSQL via Drizzle ORM
│   └── static.ts           # Production static file serving
├── shared/
│   └── schema.ts           # Database schema (Drizzle pgTable)
├── render.yaml             # Render.com Blueprint
├── Dockerfile              # Container deployment
└── package.json
```

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check |
| `POST` | `/api/sessions` | Create session |
| `GET` | `/api/sessions/admin/:code` | Get session by admin code |
| `GET` | `/api/sessions/join/:code` | Validate access code |
| `POST` | `/api/sessions/:code/join` | Join as participant |
| `POST` | `/api/sessions/:sessionId/agendas` | Add agenda |
| `POST` | `/api/agendas/:id/start` | Start voting |
| `POST` | `/api/agendas/:id/close` | Close voting |
| `GET` | `/api/agendas/:id/votes` | Get vote counts |
| `POST` | `/api/vote` | Cast a vote |

### WebSocket

Connect to `ws(s)://host/ws?sessionId=<id>` for real-time updates.

---

## License

MIT — Free to use, modify, and distribute.
