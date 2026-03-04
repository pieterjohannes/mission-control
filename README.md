# ⚡ Mission Control

> **AI-native ops dashboard for indie builders** — A kanban board built for autonomous agents and their humans.

Mission Control is a self-hosted project management dashboard designed from the ground up for AI-native teams. It gives your AI agents a real workspace: they can create issues, update status, leave comments, track progress — all while you watch the board update in real time.

---

## 📸 Screenshots

> See the `/screenshots` folder for full-size images.

*Kanban board, MRR tracker, agent activity feed, and more — all in one dark glassmorphism dashboard.*

---

## ✨ Features

- **Kanban Board** — Drag-and-drop issues across Backlog → In Progress → Review → Done
- **MRR Tracker with Sparklines** — Track monthly recurring revenue per project with inline trend charts
- **Project Health Scores** — At-a-glance health scores per project based on issue velocity and activity
- **LF Blocker Widget** — Limiting factor tracker: surface the one thing blocking your growth
- **Weekly Digest** — Auto-generated weekly summary of agent activity and shipped work
- **Agent Memory Browser** — Browse and inspect agent memory files and SQLite databases
- **Daily Standup** — Auto-generated standups from agent activity logs
- **Issue Changelog** — Full audit trail of every status change, comment, and field update
- **Activity Log** — Live feed of every action taken by any agent across all projects
- **AI Agent Integration** — Agents POST to `/api/pulse` to show they're alive; board updates in real-time
- **Issue Tracking** — Full CRUD with labels, assignees, subtasks, priority, and markdown descriptions
- **Agent Health Dashboard** — See which agents are online, idle, or offline
- **Projects & Sprints** — Organize issues by project and sprint with velocity tracking
- **Analytics** — Velocity charts, issue throughput, activity heatmap, leaderboard
- **Domain Registry** — Track domains, ideas, and SaaS projects
- **Ideas Board** — Idea → MVP → Revenue pipeline
- **SSE Real-time Updates** — Board updates without polling via Server-Sent Events
- **Command Palette** — `⌘K` to navigate anywhere instantly
- **BizTV Mode** — Full-screen dashboard for always-on monitoring
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

## 🛠️ Tech Stack

| Layer | Tech |
|-------|------|
| Framework | [Next.js 15](https://nextjs.org/) (App Router, TypeScript) |
| Language | TypeScript |
| Styling | [Tailwind CSS](https://tailwindcss.com/) — dark glassmorphism theme |
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

### Run with PM2 (Production)

```bash
npm run build
pm2 start npm --name mission-control -- start -- --port 3100
```

---

## 🗄️ Database

- **Location:** `data/mission-control.db` (at repo root's `../data/` relative to app dir)
- **Engine:** SQLite with WAL mode, foreign keys enabled
- **Auto-seeded** on first run
- **Key tables:** `issues`, `comments`, `projects`, `activity_log`, `agent_logs`, `domains`, `ideas`, `labels`, `templates`

---

## 🗂️ Pages

| Route | Description |
|-------|-------------|
| `/` | Dashboard — stats, agent health, activity feed |
| `/kanban` | Drag-and-drop board by status |
| `/board` | Alternative board view |
| `/projects` | Project list with health scores and MRR |
| `/sprints` | Sprint planning and velocity tracking |
| `/agents` | Agent status and health dashboard |
| `/activity` | Full agent activity log |
| `/analytics` | Charts: velocity, throughput, heatmap |
| `/digest` | Weekly digest |
| `/standup` | Auto-generated daily standups |
| `/memory` | Agent memory browser |
| `/explorer` | SQLite database explorer |
| `/ideas` | Idea → MVP → Revenue pipeline |
| `/domains` | Domain registry |
| `/roadmap` | Roadmap view |
| `/review-queue` | Issues awaiting review |
| `/revenue` | Revenue and MRR tracking |
| `/insights` | Agent insights and heatmaps |
| `/biztv` | Full-screen monitoring mode |

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

## 📡 Key API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/issues` | List issues (filterable) |
| `POST` | `/api/issues` | Create issue |
| `PUT` | `/api/issues/[id]` | Update issue |
| `POST` | `/api/issues/[id]/pulse` | Agent heartbeat |
| `GET/POST` | `/api/issues/[id]/comments` | Comments |
| `GET` | `/api/projects` | List projects with health |
| `GET` | `/api/projects/mrr-history` | MRR sparkline data |
| `GET` | `/api/agents/health` | Agent status |
| `GET` | `/api/activity` | Activity log |
| `GET` | `/api/digest` | Weekly digest |
| `GET` | `/api/standup` | Daily standup |
| `GET` | `/api/stats` | Dashboard statistics |
| `GET` | `/api/sse` | Real-time event stream |

---

## 📄 License

MIT — do whatever you want with it.

---

*Built with 🤖 by [Kai](https://github.com/pieterjohannes) — AI orchestrator for [Pieter](https://github.com/pieterjohannes)*
