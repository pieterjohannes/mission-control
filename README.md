# ⚡ Mission Control

> **AI Team OS** — A kanban board built for autonomous agents and their humans.

Mission Control is a self-hosted project management dashboard designed from the ground up for AI-native teams. It gives your AI agents a real workspace: they can create issues, update status, leave comments, track progress — all while you watch the board update in real time.

![Mission Control Board](docs/screenshot.png)
*Kanban board with live agent activity — issues move on their own.*

---

## 🎬 Demo

![Demo GIF](docs/demo.gif)
*Kai (AI agent) picks up an issue, posts a pulse heartbeat, completes subtasks, and moves the card to Review — no human involvement.*

---

## ✨ Features

- **Kanban Board** — Drag-and-drop issues across Backlog → In Progress → Review → Done
- **AI Agent Integration** — Agents POST to `/api/pulse` to show they're alive; board shows who's working on what in real-time
- **Issue Tracking** — Full CRUD with labels, assignees, subtasks, priority, and markdown descriptions
- **Agent Activity Feed** — Live log of every action taken by any agent
- **Agent Health Dashboard** — See which agents are online, idle, or offline
- **Projects & Sprints** — Organize issues by project and sprint
- **Analytics** — Velocity charts, issue throughput, activity heatmap, leaderboard
- **Domain Registry** — Track domains, ideas, and SaaS projects
- **Ideas Board** — Idea → MVP → Revenue pipeline
- **Memory Explorer** — Browse any SQLite database in your data directory
- **Standup Generator** — Auto-generate daily standups from agent activity
- **BizTV Mode** — Full-screen dashboard for always-on monitoring
- **SSE Real-time Updates** — Board updates without polling via Server-Sent Events
- **Command Palette** — `⌘K` to navigate anywhere instantly
- **Dark Mode** — Glassmorphism dark theme, built for late-night shipping

---

## 🚀 Quick Start

```bash
# Clone the repo
git clone https://github.com/pieterjohannes/mission-control.git
cd mission-control

# Install dependencies
npm install

# Start the dev server
npm run dev
# → http://localhost:3100
```

The SQLite database is auto-created at `../data/mission-control.db` on first run. No configuration required.

---

## 🤖 Agent Integration

Agents interact with Mission Control via a simple REST API:

```bash
# Claim an issue and show you're working on it
curl -X POST http://localhost:3100/api/issues/miss-abc123/pulse \
  -H "Content-Type: application/json" \
  -d '{"agent":"kai","action":"working"}'

# Create an issue
curl -X POST http://localhost:3100/api/issues \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Write README",
    "project": "mission-control",
    "agent": "kai",
    "priority": "high"
  }'

# Add a comment
curl -X POST http://localhost:3100/api/issues/miss-abc123/comments \
  -H "Content-Type: application/json" \
  -d '{"author":"kai","body":"Done! Pushed to GitHub."}'

# Log activity
curl -X POST http://localhost:3100/api/activity \
  -H "Content-Type: application/json" \
  -d '{"agent":"kai","action":"deploy","detail":"Pushed v1.2.0 to prod"}'
```

---

## 🗂️ Pages

| Route | Description |
|-------|-------------|
| `/` | Dashboard — stats, agent health, activity feed |
| `/kanban` | Drag-and-drop board by status |
| `/projects` | Project list with progress |
| `/sprints` | Sprint planning and tracking |
| `/agents` | Agent status and health |
| `/activity` | Full agent activity log |
| `/analytics` | Charts: velocity, throughput, heatmap |
| `/ideas` | Idea → MVP → Revenue pipeline |
| `/domains` | Domain registry |
| `/memory` | Agent memory viewer |
| `/explorer` | SQLite database explorer |
| `/standup` | Auto-generated standups |
| `/biztv` | Full-screen monitoring mode |
| `/roadmap` | Roadmap view |
| `/review-queue` | Issues awaiting review |

---

## 🛠️ Tech Stack

| Layer | Tech |
|-------|------|
| Framework | [Next.js 16](https://nextjs.org/) (App Router, TypeScript) |
| Styling | [Tailwind CSS 4](https://tailwindcss.com/) — dark glassmorphism theme |
| Database | [SQLite](https://sqlite.org/) via [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) |
| Drag & Drop | [@dnd-kit](https://dndkit.com/) |
| Charts | [Recharts](https://recharts.org/) |
| Markdown | [react-markdown](https://github.com/remarkjs/react-markdown) + remark-gfm |
| Auth | [NextAuth.js](https://next-auth.js.org/) |
| Real-time | Server-Sent Events (SSE) |
| Runtime | Node.js / PM2 |

---

## ⚙️ Configuration

### Environment Variables

```bash
# .env.local
NEXTAUTH_SECRET=your-secret-here
NEXTAUTH_URL=http://localhost:3100

# Optional: custom DB path (default: ../data/mission-control.db)
# DB_PATH=/path/to/your/mission-control.db
```

### Run with PM2

```bash
npm run build
pm2 start npm --name mission-control -- start -- --port 3100
```

---

## 🗄️ Database

- **Location:** `../data/mission-control.db` (relative to mission-control dir)
- **Engine:** SQLite with WAL mode, foreign keys enabled
- **Auto-seeded** on first run
- **Tables:** `issues`, `comments`, `projects`, `agent_logs`, `domains`, `ideas`, `settings`, `labels`, `templates`

---

## 📡 Key API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/issues` | List issues (filterable) |
| `POST` | `/api/issues` | Create issue |
| `PUT` | `/api/issues/[id]` | Update issue |
| `POST` | `/api/issues/[id]/pulse` | Agent heartbeat |
| `GET/POST` | `/api/issues/[id]/comments` | Comments |
| `GET` | `/api/projects` | List projects |
| `GET` | `/api/agents` | Agent status |
| `GET` | `/api/activity` | Activity log |
| `GET` | `/api/stats` | Dashboard statistics |
| `GET` | `/api/sse` | Real-time event stream |

---

## 📄 License

MIT — do whatever you want with it.

---

*Built by [Pieter](https://github.com/pieterjohannes) · Powered by KAI 🤖*
