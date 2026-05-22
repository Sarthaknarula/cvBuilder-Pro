# cvBuilder Pro 📄

![Node.js](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white)
![Express.js](https://img.shields.io/badge/Express.js-%23404d59.svg?style=for-the-badge&logo=express&logoColor=%2361DAFB)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)
![Docker](https://img.shields.io/badge/docker-%230db7ed.svg?style=for-the-badge&logo=docker&logoColor=white)
![Deployed on Render](https://img.shields.io/badge/Render-%2346E3B7.svg?style=for-the-badge&logo=render&logoColor=white)
![JavaScript](https://img.shields.io/badge/javascript-%23323330.svg?style=for-the-badge&logo=javascript&logoColor=%23F7DF1E)

A full-stack, cloud-hosted application that bridges the gap between easy-to-use visual resume builders and professional LaTeX formatting. Fill out a dynamic GUI form, and the backend seamlessly translates your data into LaTeX, compiles it server-side using a TeX Live engine, and streams a high-quality, ATS-optimized PDF directly to your browser — no Overleaf required.

**[🌐 View Live Application](https://cvbuilder-uzk7.onrender.com)**
*(Hosted on Render's free tier. The initial load may take ~50 seconds if the server is sleeping.)*

---

## ✨ Features

**Resume Builder**
- Visual drag-and-drop section reordering (Experience, Projects, Skills, Education, and custom sections)
- Fully editable section titles and dynamic add/remove for all fields
- Collapsible sections and a resizable split-pane layout (editor + LaTeX preview)
- Live LaTeX source output — Overleaf-compatible for advanced editing

**Authentication & Cloud Saves**
- Google OAuth 2.0 login via Passport.js
- Save, load, rename, and delete multiple resume drafts per user account
- Workspace dashboard with search, sort (newest/oldest/A–Z), and grid/list view toggle

**PDF Compilation**
- Server-side `pdflatex` compilation — no third-party editors
- Compiled PDF streamed directly to the browser for instant download
- Isolated per-request temp directories with automatic cleanup

**Templates**
- Multiple professional LaTeX templates stored in a PostgreSQL database (Neon)
- Template previews rendered in-browser before selection
- Each template is fully mapped to the GUI — the visual form drives the LaTeX output

**UI / UX**
- Dark mode with persistent preference (localStorage)
- Toast notifications for save/load/error feedback
- Naming modal for cloud saves with conflict resolution (upsert on duplicate name)

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Vanilla JS (ES6+), HTML5, CSS3 |
| Backend | Node.js, Express.js |
| Auth | Passport.js, Google OAuth 2.0, express-session |
| Database | PostgreSQL via `pg` (hosted on Neon.tech) |
| PDF Engine | TeX Live (`pdflatex`) via Node.js Child Processes |
| DevOps | Docker, Render (Cloud PaaS) |

---

## 🗺️ Roadmap

- **React migration** — transition Vanilla JS state management to React for better scalability
- **More templates** — additional LaTeX styles (academic, creative, two-column)
- **Resume versioning** — named version history per resume, with diff/restore
- **Cover letter builder** — extend the GUI to companion cover letter generation

---

## 🚀 Local Development

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- A PostgreSQL database (local or cloud — e.g. [Neon](https://neon.tech))
- A local LaTeX installation: [MiKTeX](https://miktex.org/) (Windows) or [MacTeX](https://www.tug.org/mactex/) (macOS), with `pdflatex` on your system PATH
- A Google Cloud project with OAuth 2.0 credentials ([guide](https://developers.google.com/identity/protocols/oauth2))

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Sarthaknarula/cvBuilder.git
   cd cvBuilder
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Create a `.env` file** in the project root:
   ```env
   DATABASE_URL=postgresql://username:password@your-database-host:5432/dbname?sslmode=require
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
| `POST` | `/api/compile-pdf` | None | Compile LaTeX string → PDF download |
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
├── server.js          # Express server, API routes, auth, PDF compilation
├── seed.js            # Database seeding script (templates table)
├── index.html         # Main app shell (selection + builder screens)
├── script.js          # Frontend logic — form state, LaTeX generation, API calls
├── styles.css         # App styles, dark mode, responsive layout
├── Dockerfile         # Container definition with TeX Live
├── .gitignore
└── .dockerignore
```