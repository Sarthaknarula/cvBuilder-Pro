# cvBuilder Pro 📄

![Node.js](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white)
![Express.js](https://img.shields.io/badge/Express.js-%23404d59.svg?style=for-the-badge&logo=express&logoColor=%2361DAFB)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)
![Redis](https://img.shields.io/badge/redis-%23DD0031.svg?style=for-the-badge&logo=redis&logoColor=white)
![Docker](https://img.shields.io/badge/docker-%230db7ed.svg?style=for-the-badge&logo=docker&logoColor=white)
![Deployed on Render](https://img.shields.io/badge/Render-%2346E3B7.svg?style=for-the-badge&logo=render&logoColor=white)

A full-stack, cloud-hosted application that bridges the gap between easy-to-use visual resume builders and professional LaTeX formatting. Fill out a dynamic GUI form, and the backend seamlessly translates your data into LaTeX, compiles it server-side using a TeX Live engine, and streams a high-quality, ATS-optimized PDF directly to your browser — no Overleaf required.

**[🌐 View Live Application](https://cvbuilder-pro.onrender.com)**
*(Hosted on Render's free tier. The initial load may take ~50 seconds if the server is sleeping.)*

---

## ✨ Features

**Resume Builder**
- Visual drag-and-drop section reordering (Experience, Projects, Skills, Education, and custom sections).
- Fully editable section titles and dynamic add/remove for all fields.
- Collapsible sections and a resizable split-pane layout (editor + LaTeX preview).
- Live LaTeX source output — Overleaf-compatible for advanced editing.

**Authentication & Cloud Saves**
- Google OAuth 2.0 login via Passport.js.
- Save, load, rename, and delete multiple resume drafts per user account.
- Workspace dashboard with search, sort (newest/oldest/A–Z), and grid/list view toggle.

**Enterprise-Grade PDF Compilation (Decoupled)**
- Server-side `pdflatex` compilation powered by a **Redis-backed BullMQ worker queue**.
- CPU-heavy compilation tasks are safely isolated from the Express main thread, preventing event-loop blocking.
- Asynchronous status polling ensures a smooth UI experience while your PDF compiles.
- Isolated per-request temp directories with automatic cleanup.

**Templates**
- Multiple professional LaTeX templates stored in a PostgreSQL database (Neon).
- Template previews rendered in-browser before selection.
- Each template is fully mapped to the GUI — the visual form drives the LaTeX output.

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Vanilla JS (ES6+), HTML5, CSS3 |
| Backend | Node.js, Express.js |
| Message Queue | BullMQ, Valkey / Redis |
| Auth | Passport.js, Google OAuth 2.0, express-session |
| Database | PostgreSQL via `pg` (hosted on Neon.tech) |
| PDF Engine | TeX Live (`pdflatex`) via Node.js Child Processes |
| DevOps | Docker, Artillery (Stress Testing), Render (Cloud PaaS) |

---

## 🚀 Performance & Scalability Benchmarks

**Architecture:** Decoupled CPU-heavy `pdflatex` compilations from the Express API using a **Redis-backed (Valkey) BullMQ worker queue**. This prevents Node.js event-loop blocking (the "Thundering Herd" problem) and guarantees 100% main-thread availability.

**Methodology:** 1.5-minute Artillery stress test simulating a targeted traffic spike (ramping to 10 Requests/Sec) processing concurrent PDF compilations.

### Load Test Results
* **Total Requests (VUs):** 540
* **Peak Throughput:** 10 Req/Sec
* **Success Rate:** 100% (Zero dropped connections)

| Metric | Local Baseline | Cloud Production (Render) |
| :--- | :--- | :--- |
| **Median Latency** | 284 ms | 302 ms |
| **p95 Latency** | 302 ms | 369 ms |
| **Max Latency** | 958 ms | 831 ms |

### Architectural Inference & Conclusion
1. **Enterprise-Grade Fault Tolerance:** The BullMQ worker successfully absorbed 540 simultaneous heavy compilations without interrupting the web server. A monolithic Node app would have crashed with 503 Gateway Timeouts under this CPU stress.
2. **Minimal Network Overhead:** The live cloud median response time was only **~18ms** slower than the local baseline, proving the internal VPC connection between the Express API and Valkey database is highly optimized.
3. **Improved Peak Efficiency:** The maximum latency actually improved in the cloud (831ms vs 958ms locally), indicating Render's Linux container handled the concurrent child-process execution and memory cleanup more efficiently.

---

## 🗺️ Roadmap

- **React migration** — transition Vanilla JS state management to React for better scalability.
- **More templates** — additional LaTeX styles (academic, creative, two-column).
- **Resume versioning** — named version history per resume, with diff/restore.
- **Cover letter builder** — extend the GUI to companion cover letter generation.

---

## 💻 Local Development

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- A PostgreSQL database (local or cloud — e.g. [Neon](https://neon.tech))
- A Redis instance (local or cloud — e.g. Upstash or standard Redis container)
- A local LaTeX installation: [MiKTeX](https://miktex.org/) (Windows) or [MacTeX](https://www.tug.org/mactex/) (macOS), with `pdflatex` on your system PATH
- A Google Cloud project with OAuth 2.0 credentials

### Installation

1. **Clone the repository:**
   ```bash
   git clone [https://github.com/Sarthaknarula/cvBuilder.git](https://github.com/Sarthaknarula/cvBuilder.git)
   cd cvBuilder
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Create a `.env` file** in the project root:
   ```env
   DATABASE_URL=postgresql://username:password@your-database-host:5432/dbname?sslmode=require
   REDIS_URL=redis://default:password@your-redis-host:6379
   SESSION_SECRET=your_random_secret_string
   GOOGLE_CLIENT_ID=your_google_client_id
   GOOGLE_CLIENT_SECRET=your_google_client_secret
   ```

4. **Seed the database** (creates the `templates` and `users` tables and inserts template data):
   ```bash
   node seed.js
   ```

5. **Start the server:**
   ```bash
   npm start
   ```

   The app will be available at `http://localhost:3000`.

---

## 🐳 Docker Setup

```bash
# Build the image (includes TeX Live)
docker build -t cvbuilder-app .

# Run the container
docker run -p 3000:3000 \
  -e DATABASE_URL="your_database_connection_string" \
  -e REDIS_URL="your_redis_connection_string" \
  -e SESSION_SECRET="your_secret" \
  -e GOOGLE_CLIENT_ID="your_google_client_id" \
  -e GOOGLE_CLIENT_SECRET="your_google_client_secret" \
  cvbuilder-app
```

> The Docker image provisions a Linux environment with the full TeX Live suite pre-installed, which is required for `pdflatex` to run on the server.

---

## 📡 API Reference

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/templates` | None | Fetch all resume templates |
| `POST` | `/api/compile-pdf` | None | Queues a compilation job and returns a jobId |
| `GET` | `/api/job-status/:id` | None | Poll compilation status/retrieve PDF blob |
| `GET` | `/auth/google` | — | Initiate Google OAuth flow |
| `GET` | `/auth/google/callback` | — | OAuth callback |
| `GET` | `/api/user` | Session | Get current logged-in user |
| `GET` | `/logout` | Session | Log out and redirect |
| `POST` | `/api/save-resume` | Required | Save or update a resume draft |
| `GET` | `/api/my-resumes` | Required | List all saved resumes for the user |
| `GET` | `/api/load-resume/:id` | Required | Load a specific saved resume |
| `DELETE` | `/api/delete-resume/:id` | Required | Delete a saved resume |

---

## 📁 Project Structure

```
cvBuilder/
├── server.js          # Express server, API routes, auth, BullMQ worker queue for PDF compilation
├── seed.js            # Database seeding script (templates table)
├── index.html         # Main app shell (selection + builder screens)
├── script.js          # Frontend logic — form state, LaTeX generation, API calls
├── styles.css         # App styles, dark mode, responsive layout
├── stress-test.yml    # Artillery configuration for performance load testing
├── README.md          # Project documentation and setup guide
├── Dockerfile         # Container definition with pre-installed TeX Live suite
├── .dockerignore      
└── .gitignore         
```
