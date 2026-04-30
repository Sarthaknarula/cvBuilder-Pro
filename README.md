# Full-Stack Visual LaTeX CV Builder 📄⚙️

![Node.js](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white)
![Express.js](https://img.shields.io/badge/Express.js-%23404d59.svg?style=for-the-badge&logo=express&logoColor=%2361DAFB)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)
![Docker](https://img.shields.io/badge/docker-%230db7ed.svg?style=for-the-badge&logo=docker&logoColor=white)
![Deployed on Render](https://img.shields.io/badge/Render-%2346E3B7.svg?style=for-the-badge&logo=render&logoColor=white)
![JavaScript](https://img.shields.io/badge/javascript-%23323330.svg?style=for-the-badge&logo=javascript&logoColor=%23F7DF1E)

A full-stack, cloud-hosted application that bridges the gap between easy-to-use visual resume builders and professional LaTeX formatting. 

Users can fill out a dynamic GUI form, and the backend Node.js server seamlessly translates the data into LaTeX, compiles it using an OS-level TeX Live engine, and returns a high-quality, ATS-optimized PDF directly to the browser. 

**[🌐 View Live Application](https://cvbuilder-pro.onrender.com)**
*(Note: Hosted on Render's free tier. If the server is asleep, the initial load may take ~50 seconds).*

## ✨ Core Features

* **Native PDF Compilation:** Bypasses third-party editors like Overleaf entirely. The server compiles the LaTeX code using `pdflatex` and streams the PDF directly to the user.
* **Cloud Database Integration:** Resume templates are securely stored and fetched from a serverless PostgreSQL database (Neon), allowing for scalable template management.
* **Dockerized Infrastructure:** The application is fully containerized, provisioning a Linux environment in the cloud equipped with the massive TeX Live software suite required for LaTeX rendering.
* **Dynamic GUI to LaTeX Mapping:** A complex Vanilla JS frontend captures state, manages drag-and-drop section reordering, and maps visual node hierarchies directly to LaTeX macros.
* **ATS-Optimized Output:** Generates perfectly formatted LaTeX code tailored to pass through automated Applicant Tracking Systems used in software engineering recruiting.

## 🛠️ Technical Architecture

* **Frontend:** Vanilla JavaScript (ES6+), HTML5, CSS3
* **Backend:** Node.js, Express.js
* **Database:** PostgreSQL (Hosted on Neon.tech), `pg` module
* **DevOps:** Docker, Render (Cloud PaaS)
* **Core Engine:** OS-level TeX Live (`pdflatex`) integrated via Node.js Child Processes.

## 🗺️ Roadmap & Future Scope

* **React Migration:** Transition the Vanilla JS frontend state management to React for enhanced scalability.
* **User Authentication:** Implement a secure login (JWT/OAuth) system.
* **Persistent User Profiles:** Update the database schema to allow users to save their progress, store multiple CV versions, and manage custom templates.

## 🚀 Local Development Setup

Because this application relies on a local LaTeX engine and a PostgreSQL database, running it locally requires a few setup steps.

### Prerequisites
* [Node.js](https://nodejs.org/) installed.
* A local PostgreSQL database OR a cloud database connection string.
* A local LaTeX environment (e.g., [MiKTeX](https://miktex.org/) for Windows or MacTeX for macOS) added to your system's PATH.

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Sarthaknarula/cvBuilder.git
   cd cvBuilder
2. **Install dependencies:**
   ```bash
   npm install
3. **Configure Environment Variables:**
   ```Code snippet
   DATABASE_URL=postgresql://username:password@your-database-host:5432/dbname?sslmode=require
4. **Seed the Database:**
   ```bash
   node seed.js
5. **Clone the repository:**
   ```bash
   npm start

### 🐳 Docker Setup
  ```bash
   docker build -t cvbuilder-app .
   docker run -p 3000:3000 -e DATABASE_URL="your_database_string" cvbuilder-app
